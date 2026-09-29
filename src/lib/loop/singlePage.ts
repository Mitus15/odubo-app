/**
 * A single's own page, /loop/<slug>: the pure parts, so they are testable
 * without a database.
 *
 * The URL names the song, because a link in a text or a story should read as
 * the song. Which songs have a page, in what order, and when each one is out,
 * lives in singles.ts.
 */
import { singlePath } from "./singles";

/** 1984's link predates the other singles and is printed on flyers. */
export const SINGLE_SLUG = "1984";
export const SINGLE_PATH = singlePath(SINGLE_SLUG);

export function isThisSingle(title: string | null | undefined): boolean {
  return (title ?? "").trim().toLowerCase() === SINGLE_SLUG;
}

/** What the link says when it is pasted anywhere. */
export function singleMeta(
  single: { title: string; artistName: string; albumTitle: string },
  facts: { dateLabel: string; venue: string } | null,
  release: { out: boolean; dateLabel: string | null } = { out: true, dateLabel: null },
): { title: string; description: string } {
  const live = facts ? ` The album plays live ${facts.dateLabel} at ${facts.venue}.` : "";
  const what = release.out
    ? `A single from ${single.albumTitle}, free to hear.`
    : release.dateLabel
      ? `A single from ${single.albumTitle}. Out ${release.dateLabel}.`
      : `A single from ${single.albumTitle}. Coming soon.`;
  return {
    title: `${single.title} · ${single.artistName}`,
    description: `${what}${live}`,
  };
}

/** Share-card title size: long names must fit the column beside the cover. */
export function cardTitleSize(title: string, withCover: boolean): number {
  const n = Math.max(1, title.length);
  return withCover ? Math.min(150, Math.floor(760 / n)) : Math.min(200, Math.floor(1100 / n));
}
