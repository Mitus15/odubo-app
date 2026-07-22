import { cookies } from "next/headers";
import type { LoopEvent } from "@/lib/loop/hub";
import { findPreview } from "@/lib/loop/music/itunes";
import { buildBracket, type Bracket, type Track } from "@/lib/loop/anthem";
import { voteStore } from "@/lib/loop/votes";
import { VOTER_COOKIE, verifyVoter } from "@/lib/loop/anthem-identity";
import {
  bracketSchedule,
  effectiveSchedule,
  getSeeds,
  stageNow,
  type AnthemStage,
  type EffectiveSchedule,
} from "@/lib/loop/anthem-rounds";
import {
  getByIds,
  leaderboard,
  myUpvoteCount,
  UPVOTE_LIMIT,
  type LeaderboardRow,
} from "@/lib/loop/anthem-candidates";
import { canSuggest as canSuggestFor, gateMode, type GateMode } from "@/lib/loop/event-codes";
import { ANTHEM_TRACKS } from "@/lib/loop/content";

/** Resolve the current request's verified anonymous voter id (set by middleware). */
export async function currentVoterId(): Promise<string> {
  const store = await cookies();
  const id = await verifyVoter(store.get(VOTER_COOKIE)?.value);
  return id ?? "anonymous";
}

/** The eight (or fewer) locked seeds resolved to playable tracks. */
export async function resolveSeedTracks(eventId: string): Promise<Track[]> {
  const ids = await getSeeds(eventId);
  if (!ids) return [];

  // One batched lookup, then map back in SEED ORDER — the bracket's structure
  // depends on the order, so we must not fall back to whatever order D1 returns.
  const byId = await getByIds(eventId, ids);
  return ids
    .map((id): Track | null => {
      const c = byId.get(id);
      if (!c) return null;
      return {
        id: c.id,
        title: c.title,
        artist: c.artist,
        previewUrl: c.previewUrl,
        artworkUrl: c.artworkUrl,
      };
    })
    .filter((t): t is Track => t !== null);
}

/** Resolve the legacy fixed seed list — used only as a demo fallback. */
export async function resolveTracks(): Promise<Track[]> {
  return Promise.all(
    ANTHEM_TRACKS.map(async (t): Promise<Track> => {
      const preview = await findPreview(t.query);
      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        previewUrl: preview?.previewUrl ?? null,
        artworkUrl: preview?.artworkUrl ?? null,
      };
    }),
  );
}

export type AnthemState = {
  eventId: string;
  stage: AnthemStage;
  serverNow: number;
  schedule: EffectiveSchedule;
  /** Who may suggest a song: `open` (anyone) or `ticket` (pass-holders only). */
  gate: GateMode;
  /** Whether THIS voter may suggest right now (open mode, or a redeemed holder). */
  canSuggest: boolean;
  /** Ranked nomination longlist (hidden candidates excluded — public-safe). */
  leaderboard: LeaderboardRow[];
  /** Likes this voter has used, and the per-voter cap. */
  myUpvotes: number;
  upvoteLimit: number;
  /** The locked bracket seeds (null until admin locks them). */
  seeds: Track[] | null;
  /** Derived bracket (null while still nominating / seeding). */
  bracket: Bracket | null;
  /** Live tallies for the bracket (raw input, so the client can re-derive). */
  tallies: Record<string, { a: number; b: number }>;
  /** This voter's current bracket picks: matchupId → side. */
  myBallots: Record<string, "a" | "b">;
};

/**
 * One payload that powers the whole anthem client for the active monthly event:
 * stage, schedule, leaderboard, seeds, derived bracket, and this voter's picks.
 */
export async function getAnthemState(event: LoopEvent, voterId: string): Promise<AnthemState> {
  const now = Date.now();

  // These reads don't depend on each other, so they go out together. Awaiting
  // them one by one would stack six D1 round-trips on every page load.
  const [stage, schedule, rows, gate, canSuggest, myUpvotes] = await Promise.all([
    stageNow(event, now),
    effectiveSchedule(event),
    leaderboard(event.id, voterId),
    gateMode(event.id),
    canSuggestFor(event.id, voterId),
    myUpvoteCount(event.id, voterId),
  ]);

  const publicRows = rows.filter((r) => !r.candidate.hidden);

  let seeds: Track[] | null = null;
  let bracket: Bracket | null = null;
  let tallies: Record<string, { a: number; b: number }> = {};
  let myBallots: Record<string, "a" | "b"> = {};

  if (stage === "bracket" || stage === "champion") {
    const [resolved, t, ballots, bracketAt] = await Promise.all([
      resolveSeedTracks(event.id),
      voteStore.getTallies(event.id),
      voteStore.getBallots(event.id, voterId),
      bracketSchedule(event),
    ]);
    seeds = resolved;
    tallies = t;
    myBallots = ballots;
    bracket = buildBracket(seeds, tallies, bracketAt, now);
  }

  return {
    eventId: event.id,
    stage,
    serverNow: now,
    schedule,
    gate,
    canSuggest,
    leaderboard: publicRows,
    myUpvotes,
    upvoteLimit: UPVOTE_LIMIT,
    seeds,
    bracket,
    tallies,
    myBallots,
  };
}
