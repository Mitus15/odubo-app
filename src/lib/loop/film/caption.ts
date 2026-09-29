import { storyIssues, type StoryIssue } from "./naming";

/**
 * The words that go out with a clip. Short, one link, and under every story
 * rule (naming.ts): it never names Him, has no em dash, and carries exactly
 * the one link, the chapter's page, so every clip is a door into the flight.
 */
export const HASHTAGS = "#LoopSoul #Recoolman #ManiOdubo";

export function clipCaption(c: { flip: string | null; verseRef: string; chapterTitle: string; slug: string; site: string }): string {
  const lines = [c.flip?.trim(), c.verseRef.trim(), "", `Loop Soul · ${c.chapterTitle}`, `${c.site.replace(/\/$/, "")}/loop/${c.slug}`];
  return lines.filter((l, i) => l !== undefined && (l !== "" || i === 2)).join("\n");
}

export function captionIssues(caption: string): StoryIssue[] {
  const issues = storyIssues(caption, { maxLinks: 1 });
  if (!/\/loop\/[a-z0-9-]+/.test(caption)) issues.push({ code: "links", detail: "A clip's caption links its chapter." });
  return issues;
}
