/**
 * What the public may see of the `videos` table, as SQL fragments shared by
 * every public read: the clips feed (/api/clips), the homepage's server-rendered
 * first page (homepageHelpers) and the video page (/media/[videoId]). One rule
 * in one place, so a hidden video cannot stay hidden on one surface and leak on
 * another.
 */

/**
 * A video is public when it is not hidden (`is_public` is 1, or NULL on legacy
 * rows), not archived, and live (`publication_status` NULL on legacy rows
 * counts as live). Fully parenthesised so it can be ANDed onto any WHERE.
 *
 * @param alias the table alias the query gives `videos` ('' for none)
 */
export function publicVideoWhere(alias = 'v'): string {
  const col = alias ? `${alias}.` : '';
  return `((${col}is_public = 1 OR ${col}is_public IS NULL)
         AND COALESCE(${col}status, 'published') != 'archived'
         AND COALESCE(${col}publication_status, 'live') = 'live')`;
}

/**
 * The Signs of Life film's columns on a clip query (migration 168), for a query
 * that calls the clip `v`. A film clip knows its song, its chapter and the
 * scripture card it was cut from. Only an APPROVED card is joined: a draft's
 * words never reach a guest, so its clip simply shows no flip.
 *
 * Mapped onto ClipItem by clipsMapper (`card_flip`, `card_verse_ref`).
 */
export const CLIP_FILM_FIELDS = `v.track_id, v.film_chapter_id, c.flip AS card_flip, c.verse_ref AS card_verse_ref`;
export const CLIP_FILM_JOIN = `LEFT JOIN loop_film_cards c ON c.id = v.card_id AND c.status = 'approved'`;
