import { executeQuery, queryOne } from "@/lib/loop/db";
import type { LoopEvent } from "@/lib/loop/hub";

/**
 * Admin-editable event details (theme, title/volume, venue) — overrides layered
 * on top of the seed event so the marketing team can rename the volume + theme
 * per cycle from /admin. Unlike the phase cookie (a per-browser demo toggle),
 * these are a SERVER-side store so a change shows for every visitor.
 *
 * Scoped per event, backed by D1. `date` is intentionally NOT editable here yet:
 * it drives the anthem schedule (`anthem-rounds.ts`), so it gets its own
 * treatment later.
 */

/** The subset of event fields the admin can edit. */
export type EventDetails = Pick<LoopEvent, "theme" | "title" | "venue">;
export const EDITABLE_EVENT_FIELDS: (keyof EventDetails)[] = ["title", "theme", "venue"];

/** The saved overrides for an event (empty object if none) — merged in `getCurrentEvent`. */
export async function getEventOverrides(eventId: string): Promise<Partial<EventDetails>> {
  const row = await queryOne<{
    title: string | null;
    theme: string | null;
    venue: string | null;
  }>(`SELECT title, theme, venue FROM event_overrides WHERE event_id = ?1`, [eventId]);

  if (!row) return {};

  // Only non-null fields are overrides; a NULL column means "not overridden",
  // so it must be absent from the object rather than present-and-undefined.
  const out: Partial<EventDetails> = {};
  if (row.title) out.title = row.title;
  if (row.theme) out.theme = row.theme;
  if (row.venue) out.venue = row.venue;
  return out;
}

/**
 * Merge a patch of editable fields onto an event's overrides. Only known fields
 * are accepted; blank/whitespace values are ignored (so a field never blanks the
 * display) — clearing back to the seed default isn't a use case yet.
 */
export async function setEventDetails(
  eventId: string,
  patch: Partial<EventDetails>,
): Promise<void> {
  const current = { ...(await getEventOverrides(eventId)) };
  for (const key of EDITABLE_EVENT_FIELDS) {
    const value = patch[key];
    if (typeof value === "string" && value.trim()) current[key] = value.trim();
  }

  await executeQuery(
    `INSERT INTO event_overrides (event_id, title, theme, venue)
          VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (event_id) DO UPDATE SET
       title = excluded.title,
       theme = excluded.theme,
       venue = excluded.venue`,
    [eventId, current.title ?? null, current.theme ?? null, current.venue ?? null],
  );
}
