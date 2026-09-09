import { executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { isHolder } from "@/lib/loop/event-codes";
import { getSetting, setSetting } from "@/lib/loop/loopSetting";
import type { EventPhase } from "@/lib/loop/hub";
import { CREDIT_EXPR, CREDIT_JOIN } from "@/lib/loop/identity";

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
      // The Wall gallery's join code is the event id uppercased + "VOL" glue —
      // in practice one gallery per volume, looked up by its code.
      [wallCode(eventId)],
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

/** `vol-1` → `LOOPVOL1`, the gallery code provisioned for the volume. */
export function wallCode(eventId: string): string {
  return `LOOP${eventId.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
}

export type BallotState = {
  kind: BallotKind;
  open: boolean;
  /** Voting needs a redeemed code; viewing never does. */
  canVote: boolean;
  options: BallotOption[];
  votesUsed: number;
  voteLimit: number;
};

export async function getBallot(
  kind: BallotKind,
  eventId: string,
  phase: EventPhase,
  voterId: string,
): Promise<BallotState> {
  const scope = ballotScope(eventId, kind);
  const [open, holder, options, used] = await Promise.all([
    isBallotOpen(kind, phase),
    isHolder(eventId, voterId),
    kind === "tracklist"
      ? tracklistOptions(scope, voterId)
      : coverOptions(eventId, scope, voterId),
    myVoteCount(scope, voterId),
  ]);
  return {
    kind,
    open,
    canVote: open && holder,
    options,
    votesUsed: used,
    voteLimit: BALLOT_VOTE_LIMIT,
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
    [wallCode(eventId), m[1]],
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
