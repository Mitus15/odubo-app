import { executeQuery, queryOne } from "@/lib/loop/db";
import type { LoopEvent } from "@/lib/loop/hub";

/**
 * Admin-editable event details — overrides layered on top of the seed event so
 * the marketing team can change them from /loop/admin without a deploy. Unlike
 * the phase cookie (a per-browser demo toggle), these are a SERVER-side store so
 * a change shows for every visitor.
 *
 * Scoped per event, backed by D1. `date` is intentionally NOT editable here yet:
 * it drives the anthem schedule (`anthem-rounds.ts`), so it gets its own
 * treatment later.
 *
 * `capacity` IS editable (migration 149). The venue owns that number, not the
 * codebase — it is printed on the poster and counted at the door, and a venue
 * revising it the week of an announcement must not be a code change.
 */

/** The subset of event fields the admin can edit. */
export type EventDetails = Pick<LoopEvent, "theme" | "title" | "venue" | "capacity">;

/** Free-text fields — trimmed, and blank is ignored rather than blanking the display. */
export const EDITABLE_TEXT_FIELDS = ["title", "theme", "venue"] as const;

/**
 * Bounds on capacity. Not arbitrary: this number is the denominator of the
 * public "X of Y left" counter and the ceiling on codes issued, so a fat-finger
 * (0, or 7500) changes what the poster claims and what the door enforces.
 */
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 2000;

/** Parse a capacity from form/JSON input. Returns null when it isn't usable. */
export function parseCapacity(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const n = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isInteger(n) || n < MIN_CAPACITY || n > MAX_CAPACITY) return null;
  return n;
}

/** The saved overrides for an event (empty object if none) — merged in `getCurrentEvent`. */
export async function getEventOverrides(eventId: string): Promise<Partial<EventDetails>> {
  const row = await queryOne<{
    title: string | null;
    theme: string | null;
    venue: string | null;
    capacity: number | null;
  }>(`SELECT title, theme, venue, capacity FROM event_overrides WHERE event_id = ?1`, [eventId]);

  if (!row) return {};

  // Only non-null fields are overrides; a NULL column means "not overridden",
  // so it must be absent from the object rather than present-and-undefined.
  const out: Partial<EventDetails> = {};
  if (row.title) out.title = row.title;
  if (row.theme) out.theme = row.theme;
  if (row.venue) out.venue = row.venue;
  // Validated on the way out as well as in: a value written before the bounds
  // existed, or edited straight in the database, must not become a live
  // capacity of 0 that reads as "sold out" on the poster.
  const capacity = parseCapacity(row.capacity);
  if (capacity !== null) out.capacity = capacity;
  return out;
}

/**
 * Merge a patch of editable fields onto an event's overrides. Only known fields
 * are accepted; blank/whitespace text is ignored (so a field never blanks the
 * display) and an out-of-range capacity is ignored rather than saved — clearing
 * back to the seed default isn't a use case yet.
 */
export async function setEventDetails(
  eventId: string,
  patch: Partial<EventDetails>,
): Promise<void> {
  const current = { ...(await getEventOverrides(eventId)) };

  for (const key of EDITABLE_TEXT_FIELDS) {
    const value = patch[key];
    if (typeof value === "string" && value.trim()) current[key] = value.trim();
  }

  const capacity = parseCapacity(patch.capacity);
  if (capacity !== null) current.capacity = capacity;

  await executeQuery(
    `INSERT INTO event_overrides (event_id, title, theme, venue, capacity)
          VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (event_id) DO UPDATE SET
       title = excluded.title,
       theme = excluded.theme,
       venue = excluded.venue,
       capacity = excluded.capacity`,
    [eventId, current.title ?? null, current.theme ?? null, current.venue ?? null, current.capacity ?? null],
  );
}
