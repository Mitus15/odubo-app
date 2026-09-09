import { queryOne } from "./db";
import { getSetting } from "./loopSetting";

/**
 * The single behind the QR.
 *
 * The printed flyer says SCAN FOR THE SINGLE, so this is the one lookup on the
 * site with a piece of paper depending on it. Two rules follow from that:
 *
 * 1. WHICH song it is must be a setting, never a constant. The owner changes
 *    what people hear without a deploy — the same rule the price and the
 *    printed URL already follow (see loopSetting.ts). A constant in the code
 *    and a value in the database eventually disagree, and the disagreement is
 *    discovered by a stranger holding the flyer.
 *
 * 2. It must FAIL LOUD, never quietly substitute. Handing back "some other
 *    track" when the named one is missing is how 90% of a video library ended
 *    up pointing at the wrong URLs for four days — the fallback hid the break.
 *    A missing single logs and returns null; the page then renders no player
 *    at all, which is visibly wrong and gets fixed, instead of playing the
 *    wrong song, which looks fine and never does.
 */

/** Used only when `featured_track` has never been set. */
const DEFAULT_TRACK_TITLE = "1984";

export type FeaturedSingle = {
  title: string;
  albumTitle: string;
  artistName: string;
  /** App-relative; the media route 302s to a presigned R2 URL. */
  audioUrl: string;
  /** Seconds. */
  duration: number;
  durationLabel: string;
  coverUrl: string | null;
};

function label(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function getFeaturedSingle(): Promise<FeaturedSingle | null> {
  const wanted = (await getSetting("featured_track")) ?? DEFAULT_TRACK_TITLE;

  try {
    // Matched on title OR id so the setting can hold either — the owner types a
    // song name, an import writes an id, and both must work.
    const row = await queryOne<{
      title: string;
      album_title: string;
      artist_name: string;
      audio_url: string | null;
      duration: number | null;
      cover_art_url: string | null;
    }>(
      `SELECT t.title, t.audio_url, t.duration,
              a.title AS album_title, a.artist_name, a.cover_art_url
         FROM tracks t
         JOIN albums a ON a.id = t.album_id
        WHERE (t.title = ?1 COLLATE NOCASE OR t.id = ?1)
          AND t.audio_url IS NOT NULL
        ORDER BY t.track_number
        LIMIT 1`,
      [wanted],
    );

    if (!row?.audio_url) {
      console.error(
        `[single] featured_track "${wanted}" resolves to no playable track. ` +
          `The flyer promises a single and the page will render none.`,
      );
      return null;
    }

    return {
      title: row.title,
      albumTitle: row.album_title,
      artistName: row.artist_name,
      audioUrl: row.audio_url,
      duration: row.duration ?? 0,
      durationLabel: label(row.duration ?? 0),
      coverUrl: row.cover_art_url,
    };
  } catch (err) {
    console.error(`[single] lookup failed for "${wanted}":`, err);
    return null;
  }
}
