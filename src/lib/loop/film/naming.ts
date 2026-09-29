import { FONT_METRICS } from "@/lib/loop/poster/font-metrics";

/**
 * The rules every word of the Loop Soul story obeys before a guest sees it.
 *
 * 1. He is never named. Everyone knows who we mean (the canon's Loop Soul
 *    section, Game/game/docs/CANON.md, 2026-09-29). The words of a verse make
 *    Him unmistakable; the name never appears in a card, a flip, a chapter, a
 *    world entry, a caption or a hashtag.
 * 2. No em dash, anywhere, in any voice (the owner's rule).
 * 3. A card carries no link at all; a caption carries exactly one.
 * 4. Every character on a card is one the poster engine can measure and draw
 *    (the committed Jost metrics table), or the layout would guess its width.
 *
 * Pure, so the admin page, the publish step and the tests share one rule.
 */

/** The name, and the forms that carry it ("Christian", "Antichrist" too). */
const NAMES = /\b(jesus|messias|messiah|emmanuel|immanuel)\b|christ/i;

export function namesHim(text: string): boolean {
  return NAMES.test(text);
}

const LINK = /\bhttps?:\/\/\S+|\b[a-z0-9-]+\.(com|studio|ca|io|net|org|app)(\/\S*)?/gi;

export function linkCount(text: string): number {
  return (text.match(LINK) ?? []).length;
}

const DRAWABLE = new Set(Object.keys(FONT_METRICS.weights["700"]));

export type StoryIssue =
  | { code: "names-him"; detail: string }
  | { code: "em-dash"; detail: string }
  | { code: "links"; detail: string }
  | { code: "glyph"; detail: string };

export function storyIssues(
  text: string,
  opts: { maxLinks?: number; drawn?: boolean } = {},
): StoryIssue[] {
  const issues: StoryIssue[] = [];
  const maxLinks = opts.maxLinks ?? 0;
  if (namesHim(text)) issues.push({ code: "names-him", detail: "He is never named in Loop Soul." });
  if (text.includes("—")) issues.push({ code: "em-dash", detail: "No em dashes." });
  const links = linkCount(text);
  if (links > maxLinks) {
    issues.push({ code: "links", detail: maxLinks === 0 ? "No links here." : `At most ${maxLinks} link.` });
  }
  if (opts.drawn) {
    const bad = [...new Set([...text].filter((ch) => ch !== "\n" && !DRAWABLE.has(ch)))];
    if (bad.length) issues.push({ code: "glyph", detail: `Cannot be drawn: ${bad.join(" ")}` });
  }
  return issues;
}
