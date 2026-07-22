import { hash32 } from "@/lib/loop/anthem";
import { chunkForParams, executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { type TrackResult } from "@/lib/loop/music/itunes";

/**
 * The nomination longlist + upvotes — the crowd's say in WHICH songs reach the
 * bracket. Users suggest real (iTunes-searched) tracks and upvote each other's;
 * a live leaderboard ranks them and admin curates the top into the 8 seeds.
 *
 * Scoped per event so each monthly cycle has its own longlist. The longlist
 * **starts empty** — it's genuinely crowd-built (the admin simulator can also
 * populate it for testing). Backed by D1.
 */

export type Candidate = {
  id: string; // iTunes trackId, or an ANTHEM_TRACKS slug for the house seeds
  title: string;
  artist: string;
  previewUrl: string | null;
  artworkUrl: string | null;
  suggestedBy: string; // voterId, or "house" for the pre-seeds
  createdAt: number;
  hidden: boolean;
};

export type LeaderboardRow = {
  candidate: Candidate;
  votes: number;
  mine: boolean;
};

/** Each voter gets a small, fixed budget of likes per event — makes upvotes
 *  scarce so the leaderboard reflects real favourites, not whoever clicks most. */
export const UPVOTE_LIMIT = 3;

/** The DB's snake_case row → the app's Candidate. */
type CandidateRow = {
  id: string;
  title: string;
  artist: string;
  preview_url: string | null;
  artwork_url: string | null;
  suggested_by: string;
  created_at: number;
  hidden: number;
};

function toCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    previewUrl: row.preview_url,
    artworkUrl: row.artwork_url,
    suggestedBy: row.suggested_by,
    createdAt: row.created_at,
    hidden: row.hidden === 1, // SQLite has no boolean
  };
}

/**
 * Ranked longlist for one voter: votes desc, then a STABLE SEEDED SHUFFLE for
 * ties (not creation order). When dozens of songs are all tied — e.g. 75 unique
 * suggestions each at one vote — ordering by `createdAt` would hand the bracket
 * to whoever suggested fastest (first-mover bias). A per-event hash instead
 * gives every tied song an equal, fixed shot, stable across reloads and
 * identical on client + server (it reuses the bracket's coin-flip primitive).
 *
 * The sort stays in JS on purpose: `hash32` (FNV-1a) has no SQL equivalent, and
 * it must produce byte-identical ordering on both sides of the wire.
 */
export async function leaderboard(eventId: string, voterId: string): Promise<LeaderboardRow[]> {
  const rows = await queryDatabase<CandidateRow & { votes: number; mine: number }>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM candidate_upvotes u
              WHERE u.event_id = c.event_id AND u.candidate_id = c.id) AS votes,
            (SELECT COUNT(*) FROM candidate_upvotes u
              WHERE u.event_id = c.event_id AND u.candidate_id = c.id
                AND u.voter_id = ?2) AS mine
       FROM candidates c
      WHERE c.event_id = ?1`,
    [eventId, voterId],
  );

  const out: LeaderboardRow[] = rows.map((row) => ({
    candidate: toCandidate(row),
    votes: row.votes,
    mine: row.mine > 0,
  }));

  const tieRank = (id: string) => hash32(`${eventId}:${id}`);
  out.sort((x, y) => y.votes - x.votes || tieRank(x.candidate.id) - tieRank(y.candidate.id));
  return out;
}

/** Add a suggested track (dedupe by iTunes id); returns the candidate. */
export async function add(
  eventId: string,
  track: TrackResult,
  voterId: string,
  now: number,
): Promise<Candidate> {
  const existing = await getById(eventId, track.id);
  if (existing) return existing;

  const candidate: Candidate = {
    id: track.id,
    title: track.title,
    artist: track.artist,
    previewUrl: track.previewUrl,
    artworkUrl: track.artworkUrl,
    suggestedBy: voterId,
    createdAt: now,
    hidden: false,
  };

  await executeQuery(
    `INSERT OR IGNORE INTO candidates
       (event_id, id, title, artist, preview_url, artwork_url, suggested_by, created_at, hidden)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)`,
    [
      eventId,
      candidate.id,
      candidate.title,
      candidate.artist,
      candidate.previewUrl,
      candidate.artworkUrl,
      candidate.suggestedBy,
      candidate.createdAt,
    ],
  );

  // A suggester implicitly upvotes their own pick — but only if they have a like
  // to spare, so the 3-like budget is never exceeded by suggesting. The WHERE
  // enforces the budget inside the write itself, so a double-click can't race
  // its way past the limit.
  await executeQuery(
    `INSERT OR IGNORE INTO candidate_upvotes (event_id, candidate_id, voter_id)
     SELECT ?1, ?2, ?3
      WHERE (SELECT COUNT(*) FROM candidate_upvotes
              WHERE event_id = ?1 AND voter_id = ?3) < ?4`,
    [eventId, candidate.id, voterId, UPVOTE_LIMIT],
  );

  return candidate;
}

/** How many likes this voter currently holds across the event's longlist. */
export async function myUpvoteCount(eventId: string, voterId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM candidate_upvotes WHERE event_id = ?1 AND voter_id = ?2`,
    [eventId, voterId],
  );
  return row?.n ?? 0;
}

/**
 * Toggle a voter's like for a candidate. Removing is always allowed; adding is
 * rejected (`ok:false`, no change) once the voter is at `UPVOTE_LIMIT`. Returns
 * the candidate's new vote count plus the voter's total likes used.
 *
 * Two round-trips, not five: one read gathers every fact the decision needs,
 * and the new counts are then derived arithmetically from the single write.
 */
export async function toggleUpvote(
  eventId: string,
  voterId: string,
  candidateId: string,
): Promise<{ ok: boolean; mine: boolean; votes: number; count: number; limit: number }> {
  const before = await queryOne<{ mine: number; votes: number; count: number }>(
    `SELECT (SELECT COUNT(*) FROM candidate_upvotes
              WHERE event_id = ?1 AND candidate_id = ?2 AND voter_id = ?3) AS mine,
            (SELECT COUNT(*) FROM candidate_upvotes
              WHERE event_id = ?1 AND candidate_id = ?2) AS votes,
            (SELECT COUNT(*) FROM candidate_upvotes
              WHERE event_id = ?1 AND voter_id = ?3) AS count`,
    [eventId, candidateId, voterId],
  );

  const mine = (before?.mine ?? 0) > 0;
  const votes = before?.votes ?? 0;
  const count = before?.count ?? 0;

  if (mine) {
    await executeQuery(
      `DELETE FROM candidate_upvotes
        WHERE event_id = ?1 AND candidate_id = ?2 AND voter_id = ?3`,
      [eventId, candidateId, voterId],
    );
    return { ok: true, mine: false, votes: votes - 1, count: count - 1, limit: UPVOTE_LIMIT };
  }

  if (count >= UPVOTE_LIMIT) {
    return { ok: false, mine: false, votes, count, limit: UPVOTE_LIMIT };
  }

  await executeQuery(
    `INSERT OR IGNORE INTO candidate_upvotes (event_id, candidate_id, voter_id)
     VALUES (?1, ?2, ?3)`,
    [eventId, candidateId, voterId],
  );
  return { ok: true, mine: true, votes: votes + 1, count: count + 1, limit: UPVOTE_LIMIT };
}

export async function getById(eventId: string, candidateId: string): Promise<Candidate | null> {
  const row = await queryOne<CandidateRow>(
    `SELECT * FROM candidates WHERE event_id = ?1 AND id = ?2`,
    [eventId, candidateId],
  );
  return row ? toCandidate(row) : null;
}

/**
 * Look several candidates up at once, returned as a map. Resolving the 8 bracket
 * seeds through `getById` would be 8 round-trips; this is one.
 */
export async function getByIds(
  eventId: string,
  candidateIds: string[],
): Promise<Map<string, Candidate>> {
  if (!candidateIds.length) return new Map();

  // Today this only ever gets the 8 bracket seeds, but chunking keeps it correct
  // if a future caller passes a longer list than D1's parameter cap allows.
  const out = new Map<string, Candidate>();
  for (const chunk of chunkForParams(candidateIds, 1)) {
    const placeholders = chunk.map((_, i) => `?${i + 2}`).join(", ");
    const rows = await queryDatabase<CandidateRow>(
      `SELECT * FROM candidates WHERE event_id = ?1 AND id IN (${placeholders})`,
      [eventId, ...chunk],
    );
    for (const row of rows) out.set(row.id, toCandidate(row));
  }
  return out;
}

export async function exists(eventId: string, candidateId: string): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM candidates WHERE event_id = ?1 AND id = ?2`,
    [eventId, candidateId],
  );
  return (row?.n ?? 0) > 0;
}

export async function setHidden(
  eventId: string,
  candidateId: string,
  hidden: boolean,
): Promise<void> {
  await executeQuery(`UPDATE candidates SET hidden = ?3 WHERE event_id = ?1 AND id = ?2`, [
    eventId,
    candidateId,
    hidden ? 1 : 0,
  ]);
}

/** All candidates for an event (used by the admin simulator). */
export async function allCandidates(eventId: string): Promise<Candidate[]> {
  const rows = await queryDatabase<CandidateRow>(
    `SELECT * FROM candidates WHERE event_id = ?1`,
    [eventId],
  );
  return rows.map(toCandidate);
}

/** Whether a voter has already liked a candidate (used by the simulator). */
export async function hasUpvoted(
  eventId: string,
  voterId: string,
  candidateId: string,
): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM candidate_upvotes
      WHERE event_id = ?1 AND candidate_id = ?2 AND voter_id = ?3`,
    [eventId, candidateId, voterId],
  );
  return (row?.n ?? 0) > 0;
}

/** Every (candidateId, voterId) like for an event — one round-trip. */
export async function allUpvotes(
  eventId: string,
): Promise<{ candidateId: string; voterId: string }[]> {
  const rows = await queryDatabase<{ candidate_id: string; voter_id: string }>(
    `SELECT candidate_id, voter_id FROM candidate_upvotes WHERE event_id = ?1`,
    [eventId],
  );
  return rows.map((r) => ({ candidateId: r.candidate_id, voterId: r.voter_id }));
}

/**
 * SIMULATOR ONLY — insert many likes in one write.
 *
 * This deliberately does NOT enforce UPVOTE_LIMIT: the caller
 * (`simulateLikes`) already caps each synthetic voter, and going through
 * `toggleUpvote` instead would cost two D1 round-trips per like — hundreds per
 * run, well past a serverless function's timeout. Never call this from a real
 * user path; use `toggleUpvote`, which enforces the budget.
 */
export async function bulkAddUpvotes(
  eventId: string,
  pairs: { candidateId: string; voterId: string }[],
): Promise<void> {
  if (!pairs.length) return;

  // 2 params per row + the shared event id — D1 allows 100 bound variables total.
  for (const chunk of chunkForParams(pairs, 2)) {
    const values = chunk.map((_, j) => `(?1, ?${j * 2 + 2}, ?${j * 2 + 3})`).join(", ");
    await executeQuery(
      `INSERT OR IGNORE INTO candidate_upvotes (event_id, candidate_id, voter_id)
       VALUES ${values}`,
      [eventId, ...chunk.flatMap((p) => [p.candidateId, p.voterId])],
    );
  }
}

/** Wipe an event's longlist + upvotes (admin simulator "reset"). */
export async function reset(eventId: string): Promise<void> {
  await executeQuery(`DELETE FROM candidate_upvotes WHERE event_id = ?1`, [eventId]);
  await executeQuery(`DELETE FROM candidates WHERE event_id = ?1`, [eventId]);
}
