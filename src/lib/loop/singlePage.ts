/**
 * The single's own page, /loop/1984: the pure parts, so they are testable
 * without a database.
 *
 * The URL names the song, because a link in a text or a story should read as
 * the song. The page still plays the FEATURED single (the only track the audio
 * rule lets a stranger hear, see audioAccess.ts), so if the owner ever features
 * a different song, /loop/1984 must not play it under this name: it sends the
 * visitor to the poster instead.
 */

export const SINGLE_PATH = "/loop/1984";
export const SINGLE_SLUG = "1984";

export function isThisSingle(title: string | null | undefined): boolean {
  return (title ?? "").trim().toLowerCase() === SINGLE_SLUG;
}

/** What the link says when it is pasted anywhere. */
export function singleMeta(
  single: { title: string; artistName: string; albumTitle: string },
  facts: { dateLabel: string; venue: string },
): { title: string; description: string } {
  return {
    title: `${single.title} · ${single.artistName}`,
    description: `The lead single from ${single.albumTitle}, free to hear. The album plays live ${facts.dateLabel} at ${facts.venue}.`,
  };
}
