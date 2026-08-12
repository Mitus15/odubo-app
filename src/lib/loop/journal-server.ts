import type { LoopEvent } from "@/lib/loop/hub";
import { buildBracket, type Track } from "@/lib/loop/anthem";
import { resolveSeedTracks } from "@/lib/loop/anthem-server";
import { bracketSchedule } from "@/lib/loop/anthem-rounds";
import { voteStore } from "@/lib/loop/votes";
import { getRunOfShow } from "@/lib/loop/content-store";
import {
  getJournalIssue,
  getJournalMoments,
  type JournalIssue,
  type JournalMoment,
} from "@/lib/loop/journal-store";
import type { RunOfShowItem } from "@/lib/loop/content";

/**
 * Assembles one Journal issue. The magazine mostly prints what the event
 * already recorded: the anthem result is re-derived from the same pure
 * `buildBracket` the public bracket uses (never stored), and the night recap
 * is the run of show. Only the editorial frame + Iconic Moments come from the
 * journal's own store.
 */

export type AnthemResult = {
  champion: Track;
  runnerUp: Track | null;
  votesFor: number;
  votesAgainst: number;
};

export type JournalData = {
  issue: JournalIssue | null;
  moments: JournalMoment[];
  anthem: AnthemResult | null;
  runOfShow: RunOfShowItem[];
};

/** The crowned anthem, or null while the bracket hasn't resolved a champion. */
export async function getAnthemResult(event: LoopEvent): Promise<AnthemResult | null> {
  const [seeds, tallies, schedule] = await Promise.all([
    resolveSeedTracks(event.id),
    voteStore.getTallies(event.id),
    bracketSchedule(event),
  ]);
  if (!seeds.length) return null;

  const bracket = buildBracket(seeds, tallies, schedule, Date.now());
  if (!bracket.champion) return null;

  // The final is the last round's only matchup; its tallies are the story.
  const final = bracket.rounds[bracket.rounds.length - 1]?.matchups[0];
  if (!final?.winner) return { champion: bracket.champion, runnerUp: null, votesFor: 0, votesAgainst: 0 };

  const won = final.winner === "a";
  return {
    champion: bracket.champion,
    runnerUp: (won ? final.b : final.a) ?? null,
    votesFor: won ? final.votesA : final.votesB,
    votesAgainst: won ? final.votesB : final.votesA,
  };
}

export async function getJournalData(event: LoopEvent): Promise<JournalData> {
  const [issue, moments, anthem, runOfShow] = await Promise.all([
    getJournalIssue(event.id),
    getJournalMoments(event.id),
    getAnthemResult(event),
    getRunOfShow(event.id),
  ]);
  return { issue, moments, anthem, runOfShow };
}

/** Whether the current volume's issue is live for the public. */
export async function isJournalPublished(eventId: string): Promise<boolean> {
  const issue = await getJournalIssue(eventId);
  return issue?.published ?? false;
}
