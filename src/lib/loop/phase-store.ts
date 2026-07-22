import { executeQuery, queryOne } from "@/lib/loop/db";
import type { EventPhase } from "@/lib/loop/hub";

/**
 * The active event phase, as a SERVER-side (D1) setting — global to every
 * visitor. This replaces the old per-browser `ls_phase` cookie, whose per-browser
 * scope was a launch-night footgun (see migrations/0002_event_phase.sql): an
 * admin flip to `live` must open the Portal for EVERYONE, not just the admin.
 *
 * Scoped per event, so next month's event auto-starts at its default phase.
 * Presence of a row is an explicit admin choice; absence means "not set" and the
 * caller falls back to NEXT_PUBLIC_DEFAULT_PHASE / the seed default.
 */

const VALID: EventPhase[] = ["pre", "live", "archived"];

/** The stored phase for an event, or null if an admin has never set one. */
export async function getStoredPhase(eventId: string): Promise<EventPhase | null> {
  const row = await queryOne<{ phase: string }>(
    `SELECT phase FROM event_phase WHERE event_id = ?1`,
    [eventId],
  );
  if (row && VALID.includes(row.phase as EventPhase)) return row.phase as EventPhase;
  return null;
}

/** Set the active phase for an event — takes effect for every visitor. */
export async function setStoredPhase(eventId: string, phase: EventPhase): Promise<void> {
  await executeQuery(
    `INSERT INTO event_phase (event_id, phase)
          VALUES (?1, ?2)
     ON CONFLICT (event_id) DO UPDATE SET phase = excluded.phase`,
    [eventId, phase],
  );
}
