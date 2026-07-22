import type { LoopEvent } from "@/lib/loop/hub";
import { buildBracket, hash32, type Track } from "@/lib/loop/anthem";
import { searchTracks } from "@/lib/loop/music/itunes";
import { bulkSetBallots, voteStore, type Side } from "@/lib/loop/votes";
import {
  add,
  allCandidates,
  allUpvotes,
  bulkAddUpvotes,
  getByIds,
  leaderboard,
  reset as resetCandidates,
  UPVOTE_LIMIT,
  type Candidate,
} from "@/lib/loop/anthem-candidates";
import {
  bracketSchedule,
  closeNow,
  getSeeds,
  lockSeeds,
  resetEvent as resetRounds,
  type RoundKey,
} from "@/lib/loop/anthem-rounds";
import { reset as resetCodes } from "@/lib/loop/event-codes";

/**
 * Admin SESSION SIMULATOR — drives a full Soul Loop Anthem cycle with N
 * synthetic participants (`sim-0…N-1`) so the team can watch the whole mechanism
 * end-to-end (nominate → like → lock 8 → vote QF/SF/Final → champion) without
 * needing N real phones. It only calls the same store primitives real users hit.
 *
 * TEST-ONLY: unauthenticated like the rest of /admin; remove or feature-flag
 * before any deploy, and Reset after simulating so fake data doesn't ship.
 */

const SIM_VOTER = (n: number) => `sim-${n}`;

/** A pool of real funk/soul/disco classics to draw a crowd-built longlist from. */
const SIM_POOL: { title: string; artist: string; query: string }[] = [
  { title: "Billie Jean", artist: "Michael Jackson", query: "Billie Jean Michael Jackson" },
  { title: "Flashlight", artist: "Parliament", query: "Flashlight Parliament" },
  { title: "September", artist: "Earth, Wind & Fire", query: "September Earth Wind Fire" },
  { title: "Ain't Nobody", artist: "Rufus & Chaka Khan", query: "Ain't Nobody Chaka Khan" },
  { title: "Le Freak", artist: "Chic", query: "Le Freak Chic" },
  { title: "Got to Be Real", artist: "Cheryl Lynn", query: "Got to Be Real Cheryl Lynn" },
  { title: "Super Freak", artist: "Rick James", query: "Super Freak Rick James" },
  { title: "Give It to Me Baby", artist: "Rick James", query: "Give It To Me Baby Rick James" },
  { title: "Stayin' Alive", artist: "Bee Gees", query: "Stayin Alive Bee Gees" },
  { title: "Good Times", artist: "Chic", query: "Good Times Chic" },
  { title: "Got to Give It Up", artist: "Marvin Gaye", query: "Got to Give It Up Marvin Gaye" },
  { title: "Boogie Wonderland", artist: "Earth, Wind & Fire", query: "Boogie Wonderland Earth Wind Fire" },
  { title: "Play That Funky Music", artist: "Wild Cherry", query: "Play That Funky Music Wild Cherry" },
  { title: "Brick House", artist: "Commodores", query: "Brick House Commodores" },
  { title: "Funkytown", artist: "Lipps Inc.", query: "Funkytown Lipps Inc" },
  { title: "Don't Stop 'Til You Get Enough", artist: "Michael Jackson", query: "Don't Stop Til You Get Enough Michael Jackson" },
  { title: "I Will Survive", artist: "Gloria Gaynor", query: "I Will Survive Gloria Gaynor" },
  { title: "Car Wash", artist: "Rose Royce", query: "Car Wash Rose Royce" },
  { title: "Rock with You", artist: "Michael Jackson", query: "Rock with You Michael Jackson" },
  { title: "Celebration", artist: "Kool & The Gang", query: "Celebration Kool and the Gang" },
  { title: "Disco Inferno", artist: "The Trammps", query: "Disco Inferno The Trammps" },
  { title: "Lady Marmalade", artist: "Labelle", query: "Lady Marmalade Labelle" },
  { title: "Best of My Love", artist: "The Emotions", query: "Best of My Love The Emotions" },
  { title: "I Wanna Dance with Somebody", artist: "Whitney Houston", query: "I Wanna Dance with Somebody Whitney Houston" },
];

function toTrack(c: Candidate): Track {
  return {
    id: c.id,
    title: c.title,
    artist: c.artist,
    previewUrl: c.previewUrl,
    artworkUrl: c.artworkUrl,
  };
}

async function seedTracks(eventId: string): Promise<Track[]> {
  const ids = await getSeeds(eventId);
  if (!ids) return [];
  const byId = await getByIds(eventId, ids);
  return ids
    .map((id) => byId.get(id) ?? null)
    .filter((c): c is Candidate => c !== null)
    .map(toTrack);
}

/** Weighted random pick (stable per-candidate popularity) excluding `taken`. */
function weightedPick(pool: Candidate[], taken: Set<string>): Candidate | null {
  const choices = pool.filter((c) => !taken.has(c.id));
  if (!choices.length) return null;
  const weights = choices.map((c) => (hash32(c.id) % 90) + 10); // 10..99
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < choices.length; i++) {
    r -= weights[i];
    if (r <= 0) return choices[i];
  }
  return choices[choices.length - 1];
}

/** Wipe the whole anthem cycle for the event → clean slate. */
export async function resetAnthem(eventId: string): Promise<void> {
  await resetCandidates(eventId);
  await voteStore.reset(eventId);
  await resetRounds(eventId);
  await resetCodes(eventId);
}

/** Build a crowd-style longlist from the pool (real iTunes previews). */
export async function populateLonglist(eventId: string): Promise<number> {
  let added = 0;
  for (let i = 0; i < SIM_POOL.length; i++) {
    const results = await searchTracks(SIM_POOL[i].query, 1);
    const hit = results[0];
    if (!hit) continue;
    await add(eventId, hit, SIM_VOTER(i % 75), 1_000 + i);
    added += 1;
  }
  return added;
}

/**
 * Each of `voters` synthetic participants spends up to UPVOTE_LIMIT likes.
 *
 * The picking is decided entirely in memory and written in ONE bulk insert.
 * Routing 75 voters × 3 likes through `toggleUpvote` would be ~450 sequential
 * D1 round-trips — minutes of wall-clock, and well past a serverless timeout.
 * The per-voter budget is still respected: it's the `liked.size < UPVOTE_LIMIT`
 * bound below, seeded from the likes already in the database.
 */
export async function simulateLikes(eventId: string, voters: number): Promise<number> {
  const pool = (await allCandidates(eventId)).filter((c) => !c.hidden);
  if (!pool.length) return 0;

  // One read of every existing like, rather than one per (voter, candidate).
  const existing = await allUpvotes(eventId);
  const likedByVoter = new Map<string, Set<string>>();
  for (const { voterId, candidateId } of existing) {
    const set = likedByVoter.get(voterId) ?? new Set<string>();
    set.add(candidateId);
    likedByVoter.set(voterId, set);
  }

  const fresh: { candidateId: string; voterId: string }[] = [];
  for (let v = 0; v < voters; v++) {
    const voterId = SIM_VOTER(v);
    const liked = likedByVoter.get(voterId) ?? new Set<string>();
    while (liked.size < UPVOTE_LIMIT) {
      const pick = weightedPick(pool, liked);
      if (!pick) break;
      liked.add(pick.id);
      fresh.push({ candidateId: pick.id, voterId });
    }
  }

  await bulkAddUpvotes(eventId, fresh);
  return fresh.length;
}

/** Lock the current leaderboard's top 8 as the bracket seeds. */
export async function lockTop8(eventId: string): Promise<{ ok: boolean; error?: string; seeds?: string[] }> {
  const rows = (await leaderboard(eventId, "sim-admin")).filter((r) => !r.candidate.hidden);
  if (rows.length < 8) {
    return { ok: false, error: `need 8 candidates, have ${rows.length} — populate first` };
  }
  const ids = rows.slice(0, 8).map((r) => r.candidate.id);
  await lockSeeds(eventId, ids);
  return { ok: true, seeds: ids };
}

/** Every participant casts a ballot in each matchup of the active bracket round. */
export async function simulateRoundVotes(
  event: LoopEvent,
  voters: number,
): Promise<{ round: string | null; ballots: number }> {
  const [tracks, tallies, schedule] = await Promise.all([
    seedTracks(event.id),
    voteStore.getTallies(event.id),
    bracketSchedule(event),
  ]);
  if (!tracks.length) return { round: null, ballots: 0 };
  const bracket = buildBracket(tracks, tallies, schedule, Date.now());
  if (bracket.activeRound === null) return { round: null, ballots: 0 };

  const round = bracket.rounds[bracket.activeRound];
  const matchups = round.matchups.filter((m) => m.a && m.b);

  // Decide every ballot in memory, then write them in one go.
  const entries: { voterId: string; matchupId: string; side: Side }[] = [];
  for (const m of matchups) {
    const bias = ((hash32(m.id) % 50) + 25) / 100; // 0.25..0.74 probability of side "a"
    for (let v = 0; v < voters; v++) {
      entries.push({
        voterId: SIM_VOTER(v),
        matchupId: m.id,
        side: Math.random() < bias ? "a" : "b",
      });
    }
  }
  await bulkSetBallots(event.id, entries);
  return { round: round.name, ballots: entries.length };
}

async function championOf(event: LoopEvent): Promise<string | null> {
  const [tracks, tallies, schedule] = await Promise.all([
    seedTracks(event.id),
    voteStore.getTallies(event.id),
    bracketSchedule(event),
  ]);
  if (!tracks.length) return null;
  const bracket = buildBracket(tracks, tallies, schedule, Date.now());
  return bracket.champion?.title ?? null;
}

/** End-to-end: reset → populate → like → lock 8 → vote+close each round → champion. */
export async function runFullSession(event: LoopEvent, voters: number) {
  await resetAnthem(event.id);
  const added = await populateLonglist(event.id);
  const likes = await simulateLikes(event.id, voters);
  const lock = await lockTop8(event.id);
  if (!lock.ok) return { ok: false, error: lock.error };

  const keys: RoundKey[] = ["qf", "sf", "final"];
  const rounds: { round: string | null; ballots: number }[] = [];
  for (const key of keys) {
    rounds.push(await simulateRoundVotes(event, voters));
    await closeNow(event, key, Date.now());
  }

  return { ok: true, added, likes, rounds, champion: await championOf(event) };
}
