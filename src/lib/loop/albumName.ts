/**
 * The album's names (owner, 2026-10-03).
 *
 * SIGNS OF LIFE is the whole work by Mani Odubo: the fourteen songs, the
 * one-take film, Recoolman's flight, the singles, the app on a home screen.
 * It is pressed and released as two records with names of their own:
 *
 *   1. Loop Soul       songs 1 to 9, Welcome to Makunahea (all three singles)
 *   2. Signs of Life   songs 10 to 14, The Other Side to Ghost World
 *
 * The first record is the life, the loop; the second crosses to the other
 * side and ends in the ghost world, where signs of life mean the most, so the
 * whole takes its name from where it lands. One rule keeps it clear: "Signs
 * of Life" on its own means the whole; where the records appear together
 * they are named as a pair, in order.
 *
 * Loop Soul is also the night, a live series that may come back, and keeps
 * its name on the night's pages (PRODUCT_NAME in brand.ts: the pass, the
 * ticket, the door).
 *
 * Every page about the work names it from here, never as a literal. A
 * record's name in the data (D1 `albums.title`, the film branch's songs.json)
 * must match RECORD_NAMES; loopAlbumName.test.ts holds the two together.
 *
 * Its own module, import-free, so client components can read it and nothing
 * restructuring the song list can take it away.
 */
export const ALBUM_NAME = "Signs of Life";

export const RECORD_NAMES = { 1: "Loop Soul", 2: "Signs of Life" } as const;
