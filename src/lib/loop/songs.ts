import SONGS_JSON from "./film/songs.json";

/**
 * The album's fourteen songs, in order: the chapters of Recoolman's flight.
 *
 * One list for both runtimes. The film pipeline (Python, scripts/loop/film/)
 * reads the same JSON file this module imports, so a slug, a title or a track
 * id can never mean one thing on the site and another in a render.
 *
 * A slug is a URL (/loop/<slug>) and a posted URL never moves. Titles match
 * D1 `tracks.title` exactly. Which of these are SINGLES, and when each single
 * is out, lives in singles.ts.
 */

export type Song = {
  number: number;
  slug: string;
  title: string;
  /** D1 tracks.id */
  trackId: string;
  /** Length of the master, whole seconds. */
  seconds: number;
  /** The three 35 second pieces between songs. */
  interlude: boolean;
};

export const ALBUM_ID: string = SONGS_JSON.albumId;
export const ALBUM_TITLE: string = SONGS_JSON.albumTitle;
export const SONGS: readonly Song[] = SONGS_JSON.songs;

export function songBySlug(slug: string): Song | null {
  const s = slug.trim().toLowerCase();
  return SONGS.find((x) => x.slug === s) ?? null;
}

export function songByTitle(title: string | null | undefined): Song | null {
  const t = (title ?? "").trim().toLowerCase();
  return SONGS.find((x) => x.title.toLowerCase() === t) ?? null;
}

export function songPath(slug: string): string {
  return `/loop/${slug}`;
}
