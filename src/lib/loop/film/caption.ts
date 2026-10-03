import { storyIssues, type StoryIssue } from "./naming";
import { sharePath } from "../singles";
import { ALBUM_NAME } from "../albumName";

/**
 * The words that go out with a clip. Short, one link, and under every story
 * rule (naming.ts): it never names Him, has no em dash, and carries exactly
 * the one link, the chapter's page on the album's own address, so every clip
 * is a door into the flight.
 */
export const HASHTAGS = "#SignsOfLife #Recoolman #ManiOdubo";

export function clipCaption(c: { flip: string | null; verseRef: string; chapterTitle: string; slug: string; site: string }): string {
  const lines = [c.flip?.trim(), c.verseRef.trim(), "", `${ALBUM_NAME} · ${c.chapterTitle}`, `${c.site.replace(/\/$/, "")}${sharePath(c.slug)}`];
  return lines.filter((l, i) => l !== undefined && (l !== "" || i === 2)).join("\n");
}

/** A chapter link on either address: /signsoflife/<slug>, or /loop/<slug> from before 2026-10-03. */
const CHAPTER_LINK = /\/(?:signsoflife|loop)\/[a-z0-9-]+/;

export function captionIssues(caption: string): StoryIssue[] {
  const issues = storyIssues(caption, { maxLinks: 1 });
  if (!CHAPTER_LINK.test(caption)) issues.push({ code: "links", detail: "A clip's caption links its chapter." });
  return issues;
}
