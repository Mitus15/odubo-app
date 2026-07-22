import type { Tally } from "@/lib/loop/votes";

/**
 * The Soul Loop Anthem bracket is DERIVED, not stored: given the eight seed
 * tracks, the running vote tallies, the round schedule, and the current time,
 * we compute the rounds, their winners, the votable round, and the champion.
 * This keeps the bracket a pure function — reused identically on client and
 * server so optimistic votes stay instant.
 *
 * Rounds advance by TIME, not by first vote: a round stays open (votes are
 * changeable) until its `closesAt`, then it locks and the leaders advance. A
 * tie at close is broken by a deterministic coin flip so the bracket never
 * stalls and client and server always agree.
 */

export type Track = {
  id: string;
  title: string;
  artist: string;
  previewUrl: string | null;
  artworkUrl: string | null;
};

export type Matchup = {
  id: string;
  a: Track | null;
  b: Track | null;
  votesA: number;
  votesB: number;
  winner: "a" | "b" | null;
  decided: boolean;
  votable: boolean;
};

export type Round = {
  round: number;
  name: string;
  matchups: Matchup[];
  /** Epoch ms when this round locks. */
  closesAt: number;
  /** True once `now >= closesAt` — votes are frozen and winners are resolved. */
  closed: boolean;
};

export type Bracket = {
  rounds: Round[];
  champion: Track | null;
  activeRound: number | null;
  /** Epoch ms the active round closes (null if no open round). */
  activeRoundClosesAt: number | null;
};

/** Per-round close times (epoch ms), already monotonic-guarded upstream. */
export type Schedule = { closesAt: number[] };

const ROUND_NAMES = ["Quarterfinals", "Semifinals", "The Final"];

/**
 * Deterministic 32-bit hash (FNV-1a). The one source of "stable randomness" in
 * the anthem: reproducible on client + server and stable across reloads, so any
 * tie — a bracket coin-flip OR a longlist ordering tie — resolves the same way
 * everywhere without storing a result. Seed with a per-event string to vary it
 * by event while staying stable within one.
 */
export function hash32(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic, reproducible on client + server (FNV-1a → side). */
function coinFlip(matchupId: string): "a" | "b" {
  return hash32(matchupId) % 2 === 0 ? "a" : "b";
}

/**
 * Resolve a matchup's winner. Only closed rounds have winners; an open round
 * shows live tallies but no locked result (so votes stay changeable). At close
 * the leader wins, ties (incl. 0–0) break by coin flip.
 */
function resolve(tally: Tally, matchupId: string, closed: boolean): "a" | "b" | null {
  if (!closed) return null;
  if (tally.a > tally.b) return "a";
  if (tally.b > tally.a) return "b";
  return coinFlip(matchupId);
}

export function buildBracket(
  seeds: Track[],
  votes: Record<string, Tally>,
  schedule: Schedule,
  now: number,
): Bracket {
  const rounds: Round[] = [];
  let feeders: (Track | null)[] = seeds.slice(0, 8);

  for (let r = 0; r < 3; r++) {
    const closesAt = schedule.closesAt[r] ?? Number.POSITIVE_INFINITY;
    const closed = now >= closesAt;
    const matchups: Matchup[] = [];
    for (let i = 0; i < feeders.length; i += 2) {
      const id = `r${r}m${i / 2}`;
      const a = feeders[i] ?? null;
      const b = feeders[i + 1] ?? null;
      const tally = votes[id] ?? { a: 0, b: 0 };
      const formed = Boolean(a && b);
      const winner = formed ? resolve(tally, id, closed) : null;
      matchups.push({
        id,
        a,
        b,
        votesA: tally.a,
        votesB: tally.b,
        winner,
        decided: winner !== null,
        votable: false, // set after we know the active round
      });
    }
    rounds.push({ round: r, name: ROUND_NAMES[r], matchups, closesAt, closed });
    // Winners feed the next round (null until this round closes).
    feeders = matchups.map((m) =>
      m.winner === "a" ? m.a : m.winner === "b" ? m.b : null,
    );
  }

  // Active round = the earliest round that is formed but still open. Because a
  // round only forms once its predecessor has closed (winners fed forward),
  // this is the first open round with a fully-formed matchup.
  let activeRound: number | null = null;
  for (const round of rounds) {
    if (round.closed) continue;
    const hasFormed = round.matchups.some((m) => m.a && m.b);
    if (hasFormed) {
      activeRound = round.round;
      break;
    }
  }

  // Only the active round's fully-formed matchups accept votes.
  if (activeRound !== null) {
    for (const m of rounds[activeRound].matchups) {
      m.votable = Boolean(m.a && m.b);
    }
  }

  const final = rounds[2].matchups[0];
  const champion =
    final && final.winner === "a" ? final.a : final && final.winner === "b" ? final.b : null;

  return {
    rounds,
    champion,
    activeRound,
    activeRoundClosesAt: activeRound !== null ? rounds[activeRound].closesAt : null,
  };
}
