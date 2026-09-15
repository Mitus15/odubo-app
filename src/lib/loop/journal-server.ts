import type { LoopEvent } from "@/lib/loop/hub";
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
 * already recorded: the night recap is the run of show. Only the editorial
 * frame + Iconic Moments come from the journal's own store.
 */

export type JournalData = {
  issue: JournalIssue | null;
  moments: JournalMoment[];
  runOfShow: RunOfShowItem[];
};

export async function getJournalData(event: LoopEvent): Promise<JournalData> {
  const [issue, moments, runOfShow] = await Promise.all([
    getJournalIssue(event.id),
    getJournalMoments(event.id),
    getRunOfShow(event.id),
  ]);
  return { issue, moments, runOfShow };
}

/** Whether the current volume's issue is live for the public. */
export async function isJournalPublished(eventId: string): Promise<boolean> {
  const issue = await getJournalIssue(eventId);
  return issue?.published ?? false;
}
