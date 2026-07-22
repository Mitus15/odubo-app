import { chunkForParams, executeQuery, queryDatabase } from "@/lib/loop/db";

/**
 * Bracket ballots — one pick per voter, per matchup, changeable until the round
 * closes. Tallies are DERIVED by counting ballots (never stored directly), which
 * is what makes "one vote, change it freely" correct: casting and changing are
 * both the same upsert of `(voterId, matchupId) → side`.
 *
 * Backed by Cloudflare D1. Everything is scoped by `eventId` so each monthly
 * event gets a fresh bracket automatically.
 */

export type Tally = { a: number; b: number };
export type Side = "a" | "b";

export interface VoteStore {
  /** Derived per-matchup tallies for one event: matchupId → {a,b}. */
  getTallies(eventId: string): Promise<Record<string, Tally>>;
  /** One voter's current picks for one event: matchupId → side. */
  getBallots(eventId: string, voterId: string): Promise<Record<string, Side>>;
  /** Cast or change this voter's pick for a matchup (upsert). */
  set(eventId: string, voterId: string, matchupId: string, side: Side): Promise<void>;
  /** Withdraw this voter's pick for a matchup (un-vote). */
  clear(eventId: string, voterId: string, matchupId: string): Promise<void>;
  /** Wipe all ballots for an event (admin simulator "reset"). */
  reset(eventId: string): Promise<void>;
}

class D1VoteStore implements VoteStore {
  async getTallies(eventId: string): Promise<Record<string, Tally>> {
    // The tally IS this GROUP BY — there is no counter column to drift out of
    // sync with the ballots.
    const rows = await queryDatabase<{ matchup_id: string; side: Side; n: number }>(
      `SELECT matchup_id, side, COUNT(*) AS n
         FROM ballots
        WHERE event_id = ?1
        GROUP BY matchup_id, side`,
      [eventId],
    );

    const out: Record<string, Tally> = {};
    for (const row of rows) {
      const tally = (out[row.matchup_id] ??= { a: 0, b: 0 });
      tally[row.side] = row.n;
    }
    return out;
  }

  async getBallots(eventId: string, voterId: string): Promise<Record<string, Side>> {
    const rows = await queryDatabase<{ matchup_id: string; side: Side }>(
      `SELECT matchup_id, side FROM ballots WHERE event_id = ?1 AND voter_id = ?2`,
      [eventId, voterId],
    );

    const out: Record<string, Side> = {};
    for (const row of rows) out[row.matchup_id] = row.side;
    return out;
  }

  async set(eventId: string, voterId: string, matchupId: string, side: Side): Promise<void> {
    // Upsert: casting a vote and changing it are the same write.
    await executeQuery(
      `INSERT INTO ballots (event_id, matchup_id, voter_id, side)
            VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (event_id, matchup_id, voter_id)
       DO UPDATE SET side = excluded.side`,
      [eventId, matchupId, voterId, side],
    );
  }

  async clear(eventId: string, voterId: string, matchupId: string): Promise<void> {
    await executeQuery(
      `DELETE FROM ballots WHERE event_id = ?1 AND matchup_id = ?2 AND voter_id = ?3`,
      [eventId, matchupId, voterId],
    );
  }

  async reset(eventId: string): Promise<void> {
    await executeQuery(`DELETE FROM ballots WHERE event_id = ?1`, [eventId]);
  }
}

export const voteStore: VoteStore = new D1VoteStore();

/**
 * SIMULATOR ONLY — upsert many ballots in one write.
 *
 * A synthetic round is 75 voters × 4 matchups; calling `voteStore.set` for each
 * would be 300 sequential D1 round-trips, past a serverless function's timeout.
 * Real voting always goes through `voteStore.set`, which is the authority that
 * checks the matchup is open.
 */
export async function bulkSetBallots(
  eventId: string,
  entries: { voterId: string; matchupId: string; side: Side }[],
): Promise<void> {
  if (!entries.length) return;

  // 3 params per row + the shared event id — D1 allows 100 bound variables total.
  for (const chunk of chunkForParams(entries, 3)) {
    const values = chunk
      .map((_, j) => `(?1, ?${j * 3 + 2}, ?${j * 3 + 3}, ?${j * 3 + 4})`)
      .join(", ");
    await executeQuery(
      `INSERT INTO ballots (event_id, matchup_id, voter_id, side)
            VALUES ${values}
       ON CONFLICT (event_id, matchup_id, voter_id)
       DO UPDATE SET side = excluded.side`,
      [eventId, ...chunk.flatMap((e) => [e.matchupId, e.voterId, e.side])],
    );
  }
}
