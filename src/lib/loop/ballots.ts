import { executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { isHolder } from "@/lib/loop/event-codes";
import { getSetting, setSetting } from "@/lib/loop/loopSetting";
import type { EventPhase } from "@/lib/loop/hub";
import { CREDIT_EXPR, CREDIT_JOIN } from "@/lib/loop/identity";
import { loopGalleryCode } from "@/lib/loop/wall/server";

/**
 * The two member ballots — the tracklist vote and the album-cover vote — on
 * the anthem's voting rails.
 *
 * The anthem already solved every hard part of letting a room vote: HMAC
 * voter cookies, a budgeted-upvote table keyed by (event_id, candidate_id,
 * voter_id), and event codes that mark a voter a holder at redemption. What
 * these ballots add is deliberately almost nothing:
 *
 * - Each ballot is a SCOPED sub-election: votes live in the same
 *   `candidate_upvotes` table under a synthetic event id
 *   (`vol-1#tracklist`, `vol-1#cover`), so they can never collide with the
 *   anthem's own votes and inherit its indexes.
 * - The OPTIONS are never stored. The upvotes table doesn't foreign-key to
 *   `candidates`, so the tracklist derives live from the album's `tracks`
 *   rows and the cover ballot from featured Wall shots. Nothing to seed,
 *   nothing to drift: feature a shot in admin and it is on the ballot;
 *   unfeature it and its votes stop counting.
 * - Voting is CLOSED-CIRCLE: only holders (redeemed event code) may vote.
 *   That is the product's whole shape — the people in the room shape the
 *   record — enforced with the `isHolder` check redemption already writes.
 *
 * Budget matches the anthem's philosophy: scarce likes make the leaderboard
 * reflect real favourites. The leaderboard IS the outcome — a ranking of 13
 * tracks is a running order; the top featured shot is the cover, announced
 * by the owner (the room votes from his shortlist, not the whole Wall).
 */

export type BallotKind = "tracklist" | "cover";

export const BALLOT_VOTE_LIMIT = 3;

/** The Loop Soul album — the one whose running order is being voted.
 *  Same id `scripts/loop/assert_album_identity.ts` asserts against. */
export const LOOP_SOUL_ALBUM_ID = "724666e5-66a8-4229-99ee-d5450076b749";

/** The synthetic event id a ballot's votes are stored under. `#` cannot
 *  appear in a real event id (`vol-1`), so collision is structural, not
 *  conventional. */
export const ballotScope = (eventId: string, kind: BallotKind) =>
  `${eventId}#${kind}`;

/* ── open/closed ─────────────────────────────────────────────────────────── */

/**
 * A ballot is open from the moment the room goes live, through archived,
 * until the owner closes it — voting starts in the room with the reaction
 * still hot (owner's call, 2026-08-27) and stays open for the stragglers.
 * The loop_settings override (`ballot_tracklist` / `ballot_cover` =
 * open|closed) lets admin force either state without a deploy.
 */
export async function isBallotOpen(
  kind: BallotKind,
  phase: EventPhase,
): Promise<boolean> {
  const override = await getSetting(`ballot_${kind}`);
  if (override === "open") return true;
  if (override === "closed") return false;
  return phase !== "pre";
}

export async function setBallotState(
  kind: BallotKind,
  state: "open" | "closed" | null,
): Promise<void> {
  await setSetting(`ballot_${kind}`, state);
}

/* ── options, derived live ───────────────────────────────────────────────── */

export type BallotOption = {
  id: string;
  title: string;
  subtitle: string | null;
  /** Image for the option — album art slot for tracks (none yet), the shot
   *  itself for cover entries. */
  imageSrc: string | null;
  votes: number;
  mine: boolean;
};

type TrackRow = { track_number: number; title: string };
type FeaturedRow = { uid: string; r2_key: string; credit: string | null };
type VoteRow = { candidate_id: string; n: number };

async function voteTallies(scope: string, voterId: string) {
  const [rows, mineRows] = await Promise.all([
    queryDatabase<VoteRow>(
      `SELECT candidate_id, COUNT(*) AS n FROM candidate_upvotes
        WHERE event_id = ?1 GROUP BY candidate_id`,
      [scope],
    ),
    queryDatabase<{ candidate_id: string }>(
      `SELECT candidate_id FROM candidate_upvotes WHERE event_id = ?1 AND voter_id = ?2`,
      [scope, voterId],
    ),
  ]);
  return {
    counts: new Map(rows.map((r) => [r.candidate_id, r.n])),
    mine: new Set(mineRows.map((r) => r.candidate_id)),
  };
}

/** The 13 tracks, ranked by the room. Ties keep album order — stable, and the
 *  album's own sequence is the honest tiebreak. */
async function tracklistOptions(
  scope: string,
  voterId: string,
): Promise<BallotOption[]> {
  const [tracks, { counts, mine }] = await Promise.all([
    queryDatabase<TrackRow>(
      `SELECT track_number, title FROM tracks WHERE album_id = ?1 ORDER BY track_number`,
      [LOOP_SOUL_ALBUM_ID],
    ),
    voteTallies(scope, voterId),
  ]);
  return tracks
    .map((t) => {
      const id = `trk:${t.track_number}`;
      return {
        id,
        title: t.title,
        subtitle: `Track ${t.track_number}`,
        imageSrc: null,
        votes: counts.get(id) ?? 0,
        mine: mine.has(id),
      };
    })
    .sort((a, b) => b.votes - a.votes);
}

/** The owner's shortlist — featured Wall shots — ranked by the room. */
async function coverOptions(
  eventId: string,
  scope: string,
  voterId: string,
): Promise<BallotOption[]> {
  const [shots, { counts, mine }] = await Promise.all([
    queryDatabase<FeaturedRow>(
      // Credit comes from the write-once ledger, not the name typed at upload.
      // Reading `p.user_name` here meant the same photo could be credited one
      // way on the ballot and another in the Journal — and the Journal's is the
      // answer royalties are paid on. See CREDIT_EXPR in lib/loop/identity.
      `SELECT p.uid, p.r2_key, ${CREDIT_EXPR} AS credit
         FROM gallery_photos p JOIN galleries g ON g.id = p.gallery_id
         ${CREDIT_JOIN}
        WHERE g.code = ?1 AND p.featured = 1 AND p.moderated = 1
        ORDER BY p.id DESC`,
      // One gallery per volume, looked up by the code the Wall provisions it under.
      [loopGalleryCode(eventId)],
    ),
    voteTallies(scope, voterId),
  ]);
  return shots
    .map((s) => {
      const id = `pic:${s.uid}`;
      return {
        id,
        title: s.credit ? `Shot by ${s.credit}` : "Untitled shot",
        subtitle: null,
        imageSrc: `/api/loop/gallery/media/${s.r2_key}`,
        votes: counts.get(id) ?? 0,
        mine: mine.has(id),
      };
    })
    .sort((a, b) => b.votes - a.votes);
}

export type BallotState = {
  kind: BallotKind;
  open: boolean;
  /** Voting needs a redeemed code; viewing never does. */
  canVote: boolean;
  options: BallotOption[];
  votesUsed: number;
  voteLimit: number;
  /** The frozen outcome, once declared. Null while the room is still deciding. */
  result: BallotResult | null;
};

export async function getBallot(
  kind: BallotKind,
  eventId: string,
  phase: EventPhase,
  voterId: string,
): Promise<BallotState> {
  const scope = ballotScope(eventId, kind);
  const [open, holder, options, used, result] = await Promise.all([
    isBallotOpen(kind, phase),
    isHolder(eventId, voterId),
    kind === "tracklist"
      ? tracklistOptions(scope, voterId)
      : coverOptions(eventId, scope, voterId),
    myVoteCount(scope, voterId),
    getBallotResult(eventId, kind),
  ]);
  return {
    kind,
    open,
    // A declared result ends the vote whatever the open flag says: a vote cast
    // after the outcome is frozen cannot count, so do not invite it.
    canVote: open && holder && !result,
    options,
    votesUsed: used,
    voteLimit: BALLOT_VOTE_LIMIT,
    result,
  };
}

/* ── voting ──────────────────────────────────────────────────────────────── */

async function myVoteCount(scope: string, voterId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM candidate_upvotes WHERE event_id = ?1 AND voter_id = ?2`,
    [scope, voterId],
  );
  return row?.n ?? 0;
}

/** Is this option actually on the ballot right now? Derived options mean the
 *  check is a live lookup, so a shot unfeatured after being voted for simply
 *  stops being votable — no cleanup pass needed. */
async function optionExists(
  kind: BallotKind,
  eventId: string,
  id: string,
): Promise<boolean> {
  if (kind === "tracklist") {
    const m = id.match(/^trk:(\d+)$/);
    if (!m) return false;
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM tracks WHERE album_id = ?1 AND track_number = ?2`,
      [LOOP_SOUL_ALBUM_ID, Number(m[1])],
    );
    return (row?.n ?? 0) > 0;
  }
  const m = id.match(/^pic:(.+)$/);
  if (!m) return false;
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM gallery_photos p JOIN galleries g ON g.id = p.gallery_id
      WHERE g.code = ?1 AND p.uid = ?2 AND p.featured = 1 AND p.moderated = 1`,
    [loopGalleryCode(eventId), m[1]],
  );
  return (row?.n ?? 0) > 0;
}

export type ToggleResult =
  | { ok: true; voted: boolean; votesUsed: number; voteLimit: number }
  | {
      ok: false;
      reason: "closed" | "not-holder" | "unknown-option" | "budget";
    };

/** Same toggle discipline as the anthem's upvotes: one vote per option,
 *  removable, budget enforced at add time. */
export async function toggleBallotVote(
  kind: BallotKind,
  eventId: string,
  phase: EventPhase,
  voterId: string,
  optionId: string,
): Promise<ToggleResult> {
  if (!(await isBallotOpen(kind, phase)))
    return { ok: false, reason: "closed" };
  if (!(await isHolder(eventId, voterId)))
    return { ok: false, reason: "not-holder" };
  if (!(await optionExists(kind, eventId, optionId))) {
    return { ok: false, reason: "unknown-option" };
  }

  const scope = ballotScope(eventId, kind);
  const existing = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM candidate_upvotes
      WHERE event_id = ?1 AND candidate_id = ?2 AND voter_id = ?3`,
    [scope, optionId, voterId],
  );

  if ((existing?.n ?? 0) > 0) {
    await executeQuery(
      `DELETE FROM candidate_upvotes
        WHERE event_id = ?1 AND candidate_id = ?2 AND voter_id = ?3`,
      [scope, optionId, voterId],
    );
    return {
      ok: true,
      voted: false,
      votesUsed: await myVoteCount(scope, voterId),
      voteLimit: BALLOT_VOTE_LIMIT,
    };
  }

  const used = await myVoteCount(scope, voterId);
  if (used >= BALLOT_VOTE_LIMIT) return { ok: false, reason: "budget" };

  await executeQuery(
    `INSERT OR IGNORE INTO candidate_upvotes (event_id, candidate_id, voter_id)
       VALUES (?1, ?2, ?3)`,
    [scope, optionId, voterId],
  );
  return {
    ok: true,
    voted: true,
    votesUsed: await myVoteCount(scope, voterId),
    voteLimit: BALLOT_VOTE_LIMIT,
  };
}

/* ── the declared result ─────────────────────────────────────────────────── */

/**
 * The outcome of a ballot, once someone has said the word.
 *
 * Standings are derived and live; a result must not be. Options come from
 * featured Wall shots, so unfeaturing a shot after the room has voted would
 * silently rewrite what happened, and ties, a withdrawn shot and the owner's
 * own judgment all need a human in the loop anyway. So the outcome is DECLARED
 * and frozen, never inferred from whoever happens to be top right now.
 *
 * The frozen `winner` is the option id (`pic:<uid>`), not a photo row, so the
 * result survives the shot being unfeatured later: it records what the room
 * decided, which is not the same question as what is currently on the ballot.
 */
export type BallotResult = {
  kind: BallotKind;
  /** Cover: the winning option id. Null on a tracklist result. */
  winner: string | null;
  /** Tracklist: the frozen running order. Null on a cover result. */
  order: string[] | null;
  declaredAt: string;
  note: string | null;
};

export async function getBallotResult(eventId: string, kind: BallotKind): Promise<BallotResult | null> {
  const row = await queryOne<{ result: string; declared_at: string; note: string | null }>(
    `SELECT result, declared_at, note FROM loop_ballot_results WHERE event_id = ?1 AND kind = ?2`,
    [eventId, kind],
  );
  if (!row) return null;
  // A malformed payload must not take the page down: an undeclared result is
  // a far better failure than a 500 on the night the winner is announced.
  let parsed: { winner?: string; order?: string[] } = {};
  try {
    parsed = JSON.parse(row.result) as typeof parsed;
  } catch {
    console.error(`[loop:ballots] unreadable result for ${eventId}/${kind}`);
    return null;
  }
  return {
    kind,
    winner: parsed.winner ?? null,
    order: Array.isArray(parsed.order) ? parsed.order : null,
    declaredAt: row.declared_at,
    note: row.note ?? null,
  };
}

/** Freeze an outcome. Re-declaring overwrites, so the owner can correct a call. */
export async function declareBallotResult(
  eventId: string,
  kind: BallotKind,
  payload: { winner?: string; order?: string[] },
  note: string | null = null,
): Promise<void> {
  await executeQuery(
    `INSERT INTO loop_ballot_results (event_id, kind, result, declared_at, declared_by, note)
          VALUES (?1, ?2, ?3, ?4, 'loop-admin', ?5)
     ON CONFLICT (event_id, kind) DO UPDATE SET
       result = excluded.result, declared_at = excluded.declared_at, note = excluded.note`,
    [eventId, kind, JSON.stringify(payload), new Date().toISOString(), note],
  );
}

export async function clearBallotResult(eventId: string, kind: BallotKind): Promise<void> {
  await executeQuery(`DELETE FROM loop_ballot_results WHERE event_id = ?1 AND kind = ?2`, [eventId, kind]);
}

/**
 * The winning shot, resolved from the FROZEN option id and read from the photo
 * row directly, so an unfeatured winner still renders. Credit prefers the
 * attendee record over the name typed at upload, the answer royalties are paid
 * on. A cover that named the wrong person would be worse than no cover.
 */
export type CoverWinner = {
  uid: string;
  imageSrc: string;
  credit: string | null;
  votes: number;
  declaredAt: string;
  note: string | null;
};

export async function getCoverWinner(eventId: string): Promise<CoverWinner | null> {
  const result = await getBallotResult(eventId, "cover");
  const uid = result?.winner?.match(/^pic:(.+)$/)?.[1];
  if (!result || !uid) return null;
  const [row, tally] = await Promise.all([
    queryOne<{ r2_key: string; user_name: string | null; attendee_name: string | null }>(
      `SELECT p.r2_key, p.user_name, a.display_name AS attendee_name
         FROM gallery_photos p JOIN galleries g ON g.id = p.gallery_id
         LEFT JOIN loop_media_credits c ON c.photo_uid = p.uid
         LEFT JOIN loop_attendees a ON a.id = c.attendee_id
        WHERE g.code = ?1 AND p.uid = ?2`,
      [loopGalleryCode(eventId), uid],
    ),
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM candidate_upvotes WHERE event_id = ?1 AND candidate_id = ?2`,
      [ballotScope(eventId, "cover"), result.winner],
    ),
  ]);
  if (!row) return null;
  return {
    uid,
    imageSrc: `/api/loop/gallery/media/${row.r2_key}`,
    credit: row.attendee_name ?? row.user_name ?? null,
    votes: tally?.n ?? 0,
    declaredAt: result.declaredAt,
    note: result.note,
  };
}
