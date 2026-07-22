import { chunkForParams, executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { RUN_OF_SHOW, type RunOfShowItem } from "@/lib/loop/content";

/**
 * Editable Run of Show — the single content list the marketing team controls
 * from /admin (it is both the program and the lineup). Scoped per event (each
 * monthly event has its own), and **default-seeded from `RUN_OF_SHOW`** until an
 * admin saves one, so the editor is never empty and a fresh event starts from
 * the defaults (consistent with the anthem's per-event cycle).
 *
 * Backed by D1.
 */

type RunOfShowRow = {
  id: string;
  time: string;
  title: string;
  detail: string;
  performer: string | null;
  role: string | null;
  instagram: string | null;
};

export async function getRunOfShow(eventId: string): Promise<RunOfShowItem[]> {
  const rows = await queryDatabase<RunOfShowRow>(
    `SELECT id, time, title, detail, performer, role, instagram
       FROM run_of_show WHERE event_id = ?1 ORDER BY position`,
    [eventId],
  );

  if (rows.length) {
    return rows.map((r) => ({
      id: r.id,
      time: r.time,
      title: r.title,
      detail: r.detail,
      // NULL → undefined, so a pure segment (e.g. Doors) carries no performer.
      performer: r.performer ?? undefined,
      role: r.role ?? undefined,
      instagram: r.instagram ?? undefined,
    }));
  }

  // No rows can mean two different things, and conflating them would be a bug:
  // an admin who deliberately deleted every row must NOT have the defaults
  // silently resurrected on the next page load. The marker table tells them apart.
  const saved = await queryOne<{ event_id: string }>(
    `SELECT event_id FROM run_of_show_saved WHERE event_id = ?1`,
    [eventId],
  );
  if (saved) return [];

  return RUN_OF_SHOW.map((r) => ({ ...r }));
}

/** Replace the whole run of show for an event (admin posts the full list). */
export async function setRunOfShow(eventId: string, items: RunOfShowItem[]): Promise<void> {
  const normalised = items.map((r, i) => ({
    id: r.id?.trim() || `row-${i}-${Date.now()}`,
    time: r.time ?? "",
    title: r.title ?? "",
    detail: r.detail ?? "",
    // Performer fields are optional — empty strings collapse to null so a pure
    // segment (e.g. Doors) carries no performer/handle.
    performer: r.performer?.trim() || null,
    role: r.role?.trim() || null,
    instagram: normaliseHandle(r.instagram) ?? null,
  }));

  // A full replace: the admin editor always posts the complete list.
  await executeQuery(`DELETE FROM run_of_show WHERE event_id = ?1`, [eventId]);

  await executeQuery(
    `INSERT OR IGNORE INTO run_of_show_saved (event_id) VALUES (?1)`,
    [eventId],
  );

  if (!normalised.length) return;

  // 7 params per row + the shared event id, and D1 binds at most 100 variables
  // per statement — so a run of show longer than ~14 rows MUST be split across
  // statements. `position` is computed from the row's index in the whole list,
  // not its index within the chunk, or the timeline order would scramble at the
  // chunk boundary.
  let position = 0;
  for (const chunk of chunkForParams(normalised, 7)) {
    const values = chunk
      .map((_, i) => {
        const p = i * 7 + 2;
        return `(?1, ${position + i}, ?${p}, ?${p + 1}, ?${p + 2}, ?${p + 3}, ?${p + 4}, ?${p + 5}, ?${p + 6})`;
      })
      .join(", ");

    await executeQuery(
      `INSERT INTO run_of_show
         (event_id, position, id, time, title, detail, performer, role, instagram)
       VALUES ${values}`,
      [
        eventId,
        ...chunk.flatMap((r) => [
          r.id,
          r.time,
          r.title,
          r.detail,
          r.performer,
          r.role,
          r.instagram,
        ]),
      ],
    );
    position += chunk.length;
  }
}

function normaliseHandle(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const handle = value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return handle || undefined;
}
