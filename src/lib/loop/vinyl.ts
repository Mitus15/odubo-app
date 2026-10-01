import { SONGS, albumOfVolume, type Volume } from "./songs";

/**
 * Loop Soul on vinyl: two records, one per album (owner, 2026-09-30;
 * docs/decisions/loop-vinyl.md). Sides run A to D across both, in album order,
 * split so no side runs past about fifteen minutes: bass-heavy music cut
 * longer than that loses level and low end.
 */

export type Side = { side: "A" | "B" | "C" | "D"; volume: Volume; songs: readonly number[] };

/** By album number (songs.json `number`). */
export const SIDES: readonly Side[] = [
  { side: "A", volume: 1, songs: [1, 2, 3, 4, 5] },
  { side: "B", volume: 1, songs: [6, 7, 8, 9] },
  { side: "C", volume: 2, songs: [10, 11] },
  { side: "D", volume: 2, songs: [12, 13, 14] },
];

/** Silence between tracks on a side, as the length estimates assume. */
export const GAP_SECONDS = 2;

export function sideSeconds(side: Side): number {
  const songs = side.songs.map((n) => SONGS.find((s) => s.number === n)!);
  return songs.reduce((t, s) => t + s.seconds, 0) + GAP_SECONDS * (songs.length - 1);
}

/** The record's store product: one per album, each with its own price and ship date. */
export function vinylProduct(volume: Volume) {
  const album = albumOfVolume(volume);
  return {
    handle: `loop-soul-vol-${volume}-vinyl`,
    title: `${album.title}, on vinyl`,
    sides: SIDES.filter((s) => s.volume === volume).map((s) => ({
      side: s.side,
      titles: s.songs.map((n) => SONGS.find((x) => x.number === n)!.title),
    })),
  };
}
