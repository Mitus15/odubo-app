import SONGS_JSON from "./film/songs.json";

/**
 * Loop Soul's fourteen songs, in order: the chapters of Recoolman's flight.
 *
 * Two albums carry them (owner, 2026-09-30; docs/decisions/loop-vinyl.md):
 * Loop Soul Vol. 1 is songs 1 to 9 and Vol. 2 is songs 10 to 14, a record
 * each and a release each, Vol. 2 after Vol. 1. The film stays one film:
 * `number` is the song's place in the whole flight, 1 to 14, and never
 * changes (the masters, the beat grid and the chapters hang on it). A song's
 * place on its own album is `trackNumber` below.
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
  /** Which album carries it: Loop Soul Vol. 1 or Vol. 2. */
  volume: Volume;
};

export type Volume = 1 | 2;
export type LoopAlbum = { volume: Volume; albumId: string; title: string };

export const SONGS: readonly Song[] = SONGS_JSON.songs as Song[];
export const ALBUMS: readonly LoopAlbum[] = ([1, 2] as const).map((volume) => ({
  volume,
  ...SONGS_JSON.albums[String(volume) as "1" | "2"],
}));
/** Vol. 1: the album the singles, the early draw and every link made before
 *  the split point at (its id is the one the album always had). */
export const ALBUM_ID: string = ALBUMS[0].albumId;
export const ALBUM_IDS: readonly string[] = ALBUMS.map((a) => a.albumId);

export function albumOfVolume(volume: Volume): LoopAlbum {
  return ALBUMS[volume - 1];
}

export function albumById(albumId: string | null | undefined): LoopAlbum | null {
  return ALBUMS.find((a) => a.albumId === albumId) ?? null;
}

export function albumOfSong(song: Pick<Song, "volume">): LoopAlbum {
  return albumOfVolume(song.volume);
}

/** The song's place on its own album: Vol. 2 starts again at 1. */
export function trackNumber(song: Pick<Song, "number" | "volume">): number {
  return song.number - SONGS.filter((s) => s.volume < song.volume).length;
}

export function songsOf(volume: Volume): Song[] {
  return SONGS.filter((s) => s.volume === volume);
}

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
