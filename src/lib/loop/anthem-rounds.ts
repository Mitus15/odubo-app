import { executeQuery, queryDatabase } from "@/lib/loop/db";
import type { LoopEvent } from "@/lib/loop/hub";

/**
 * The anthem cycle's clock + stage machine, scoped per event so each monthly
 * event runs its own ~1-month cycle automatically (a new eventId starts fresh).
 *
 * The schedule is DERIVED from the event's date, working backwards so the
 * champion is crowned a few days before the night:
 *
 *   cycleStart ─ Nominations(14d) ─▶ Quarterfinals(5d) ─▶ Semifinals(5d) ─▶ Final(4d) ─▶ [event − 3d]
 *
 * Marketing can nudge any cutoff from /admin (Close-now / Extend / set time).
 * Only those OVERRIDES are persisted in D1 — the default schedule stays a pure
 * function of the event date, so the DB records deviations, not the calendar.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Editable cycle shape (days). Total ≈ 28d, ending `leadBefore` before the event. */
export const DURATIONS = {
  nominations: 14,
  qf: 5,
  sf: 5,
  final: 4,
  leadBefore: 3,
} as const;

export type RoundKey = "nominations" | "qf" | "sf" | "final";
export const ROUND_KEYS: RoundKey[] = ["nominations", "qf", "sf", "final"];

export type AnthemStage = "nominating" | "seeding" | "bracket" | "champion";

/** Effective cutoffs (epoch ms) for every gate in the cycle. */
export type EffectiveSchedule = Record<RoundKey, number>;

/** Derive the default cutoffs from the event date (no admin overrides). Pure. */
function derive(event: LoopEvent): EffectiveSchedule {
  const eventMs = new Date(event.date).getTime();
  const final = eventMs - DURATIONS.leadBefore * DAY;
  const sf = final - DURATIONS.final * DAY;
  const qf = sf - DURATIONS.sf * DAY;
  const nominations = qf - DURATIONS.qf * DAY;
  return { nominations, qf, sf, final };
}

async function loadOverrides(eventId: string): Promise<Map<RoundKey, number>> {
  const rows = await queryDatabase<{ round_key: RoundKey; closes_at: number }>(
    `SELECT round_key, closes_at FROM round_overrides WHERE event_id = ?1`,
    [eventId],
  );
  return new Map(rows.map((r) => [r.round_key, r.closes_at]));
}

/**
 * Merge derived defaults with admin overrides, then guard monotonicity so a
 * later gate can never close before an earlier one (an Extend can't break order).
 */
export async function effectiveSchedule(event: LoopEvent): Promise<EffectiveSchedule> {
  const base = derive(event);
  const ov = await loadOverrides(event.id);
  const merged: EffectiveSchedule = {
    nominations: ov.get("nominations") ?? base.nominations,
    qf: ov.get("qf") ?? base.qf,
    sf: ov.get("sf") ?? base.sf,
    final: ov.get("final") ?? base.final,
  };
  // Monotonic guard among the bracket rounds (a round can't close before its
  // predecessor). Nominations is an independent gate — the bracket opens when
  // admin locks seeds, not at the nominations time — so it is intentionally NOT
  // chained here, otherwise force-closing a round early (while nominations is
  // still in the future) would be clamped back.
  merged.sf = Math.max(merged.sf, merged.qf);
  merged.final = Math.max(merged.final, merged.sf);
  return merged;
}

/** The three bracket-round close times in the shape `buildBracket` expects. */
export async function bracketSchedule(event: LoopEvent): Promise<{ closesAt: number[] }> {
  const s = await effectiveSchedule(event);
  return { closesAt: [s.qf, s.sf, s.final] };
}

export async function getSeeds(eventId: string): Promise<string[] | null> {
  const rows = await queryDatabase<{ candidate_id: string }>(
    `SELECT candidate_id FROM bracket_seeds WHERE event_id = ?1 ORDER BY position`,
    [eventId],
  );
  // No rows means "not locked yet" — distinct from a locked-but-empty bracket,
  // which cannot occur (lockSeeds always writes at least one seed).
  return rows.length ? rows.map((r) => r.candidate_id) : null;
}

export async function stageNow(event: LoopEvent, now: number): Promise<AnthemStage> {
  // The two reads are independent — issue them together rather than in series.
  const [seeds, s] = await Promise.all([getSeeds(event.id), effectiveSchedule(event)]);
  if (seeds) return now >= s.final ? "champion" : "bracket";
  return now >= s.nominations ? "seeding" : "nominating";
}

export async function isNominationOpen(event: LoopEvent, now: number): Promise<boolean> {
  return (await stageNow(event, now)) === "nominating";
}

// ── Admin mutations ────────────────────────────────────────────────────────

async function setOverride(eventId: string, key: RoundKey, closesAt: number): Promise<void> {
  await executeQuery(
    `INSERT INTO round_overrides (event_id, round_key, closes_at)
          VALUES (?1, ?2, ?3)
     ON CONFLICT (event_id, round_key) DO UPDATE SET closes_at = excluded.closes_at`,
    [eventId, key, closesAt],
  );
}

/** Close a gate immediately (sets its cutoff to now). */
export async function closeNow(event: LoopEvent, key: RoundKey, now: number): Promise<void> {
  await setOverride(event.id, key, now);
}

/** Push a gate's cutoff out by N minutes from its current effective time. */
export async function extend(event: LoopEvent, key: RoundKey, minutes: number): Promise<void> {
  const current = (await effectiveSchedule(event))[key];
  await setOverride(event.id, key, current + minutes * 60 * 1000);
}

/** Set an explicit cutoff (ISO string) for a gate. */
export async function setClosesAt(eventId: string, key: RoundKey, iso: string): Promise<void> {
  await setOverride(eventId, key, new Date(iso).getTime());
}

/** Lock the bracket's 8 seeds (candidate ids) — opens the bracket. */
export async function lockSeeds(eventId: string, ids: string[]): Promise<void> {
  const seeds = ids.slice(0, 8);
  await executeQuery(`DELETE FROM bracket_seeds WHERE event_id = ?1`, [eventId]);
  if (!seeds.length) return;

  // One INSERT with N value tuples — a round-trip per seed would be silly.
  const values = seeds.map((_, i) => `(?1, ${i}, ?${i + 2})`).join(", ");
  await executeQuery(
    `INSERT INTO bracket_seeds (event_id, position, candidate_id) VALUES ${values}`,
    [eventId, ...seeds],
  );
}

export async function unlockSeeds(eventId: string): Promise<void> {
  await executeQuery(`DELETE FROM bracket_seeds WHERE event_id = ?1`, [eventId]);
  // Clear the bracket-round cutoff overrides too, so re-locking starts a fresh
  // bracket instead of inheriting stale Close-now/Extend times from the last
  // run (which would make rounds look already-closed). Nominations is left
  // intact — it's an independent gate that unlocking doesn't reopen.
  await executeQuery(
    `DELETE FROM round_overrides
      WHERE event_id = ?1 AND round_key IN ('qf', 'sf', 'final')`,
    [eventId],
  );
}

/** Wipe an event's locked seeds + all cutoff overrides (admin simulator "reset"). */
export async function resetEvent(eventId: string): Promise<void> {
  await executeQuery(`DELETE FROM bracket_seeds WHERE event_id = ?1`, [eventId]);
  await executeQuery(`DELETE FROM round_overrides WHERE event_id = ?1`, [eventId]);
}
