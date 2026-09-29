import { queryDatabase, queryOne } from "@/lib/loop/db";
import { getSetting } from "@/lib/loop/loopSetting";
import { SONGS } from "@/lib/loop/songs";
import { isPublic, listCards, listChapters, listWorld, worldView } from "./store";

/**
 * What a guest may see of the film's story, and nothing else.
 *
 * A chapter is public once it is approved AND revealed. Until then a guest sees
 * its number and title (the tracklist is public) and nothing of its story: a
 * silhouette. World entries follow their chapter. Cards are shown only when
 * approved, and only inside a public chapter. Every read fails soft: a
 * database wobble shows silhouettes, never a draft.
 */

export type PublicCard = { id: string; verseRef: string; verseText: string; flip: string | null };

export type PublicChapter = {
  slug: string;
  number: number;
  title: string;
  field: string;
  public: boolean;
  thread: string | null;
  cards: PublicCard[];
  filmStart: number | null;
};

export type PublicWorldEntry = {
  slug: string;
  shown: boolean;
  /** Only when shown. */
  name: string | null;
  line: string | null;
  /** Where it first appears. */
  chapter: string | null;
  /** A silhouette's length, so an unrevealed name keeps its shape without its letters. */
  nameLength: number;
};

export async function publicChapters(): Promise<PublicChapter[]> {
  try {
    const [chapters, cards] = await Promise.all([listChapters(), listCards()]);
    const bySlug = new Map(chapters.map((c) => [c.slug, c]));
    return SONGS.map((song) => {
      const c = bySlug.get(song.slug);
      const open = !!c && isPublic(c);
      return {
        slug: song.slug,
        number: song.number,
        title: open && c ? c.title : song.title,
        field: c?.field ?? "#d9aa7a",
        public: open,
        thread: open && c ? c.thread : null,
        cards: open
          ? cards
              .filter((k) => k.chapter === song.slug && k.status === "approved")
              .map((k) => ({ id: k.id, verseRef: k.verseRef, verseText: k.verseText, flip: k.flip }))
          : [],
        filmStart: open && c ? c.filmStart : null,
      };
    });
  } catch (err) {
    console.error("[loop:film:public] chapters", err);
    return SONGS.map((s) => ({ slug: s.slug, number: s.number, title: s.title, field: "#d9aa7a", public: false, thread: null, cards: [], filmStart: null }));
  }
}

export async function publicWorld(): Promise<PublicWorldEntry[]> {
  try {
    const [entries, chapters] = await Promise.all([listWorld(), listChapters()]);
    return worldView(entries, chapters).map(({ entry, shown }) => ({
      slug: entry.slug,
      shown,
      name: shown ? entry.name : null,
      line: shown ? entry.line : null,
      chapter: shown ? entry.revealedWith : null,
      nameLength: entry.name.length,
    }));
  } catch (err) {
    console.error("[loop:film:public] world", err);
    return [];
  }
}

export type PublicClip = { id: number; uid: string | null; title: string | null; poster: string | null };

/** The chapter's published clips, by the feed's own rule for "public". */
export async function chapterClips(slug: string): Promise<PublicClip[]> {
  try {
    return await queryDatabase<PublicClip>(
      `SELECT v.id, v.uid, v.title, v.poster_url AS poster
         FROM videos v
        WHERE v.type = 'clip' AND v.film_chapter_id = ?1
          AND ((v.is_public = 1 OR v.is_public IS NULL)
               AND COALESCE(v.status, 'published') != 'archived'
               AND COALESCE(v.publication_status, 'live') = 'live')
        ORDER BY v.clip_index, v.id
        LIMIT 24`,
      [slug],
    );
  } catch {
    return [];
  }
}

export type PublicFilm = {
  uid: string;
  title: string | null;
  poster: string | null;
  markers: { t: number; label: string | null }[];
};

/**
 * The film, once it is set (loop_settings.film_video_uid, written by
 * film:publish or the owner) and public by the feed's rule.
 */
export async function publicFilm(): Promise<PublicFilm | null> {
  try {
    const uid = await getSetting("film_video_uid");
    if (!uid) return null;
    const v = await queryOne<{ id: number; uid: string; title: string | null; poster_url: string | null }>(
      `SELECT id, uid, title, poster_url FROM videos
        WHERE (uid = ?1 OR stream_video_id = ?1)
          AND (is_public = 1 OR is_public IS NULL)
          AND COALESCE(publication_status, 'live') = 'live'
        LIMIT 1`,
      [uid],
    );
    if (!v) return null;
    const markers = await queryDatabase<{ timestamp: number; label: string | null }>(
      `SELECT timestamp, label FROM video_markers WHERE video_id = ?1 ORDER BY timestamp`,
      [v.id],
    );
    return { uid: v.uid, title: v.title, poster: v.poster_url, markers: markers.map((m) => ({ t: m.timestamp, label: m.label })) };
  } catch (err) {
    console.error("[loop:film:public] film", err);
    return null;
  }
}
