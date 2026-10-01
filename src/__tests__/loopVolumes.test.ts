/**
 * @jest-environment node
 *
 * Loop Soul is two albums: Vol. 1 (songs 1 to 9) and Vol. 2 (songs 10 to 14),
 * a record each and a release each (docs/decisions/loop-vinyl.md).
 */
import { ALBUM_ID, ALBUMS, ALBUM_IDS, SONGS, albumById, albumOfSong, songBySlug, songsOf, trackNumber } from "@/lib/loop/songs";
import { GAP_SECONDS, SIDES, sideSeconds, vinylProduct } from "@/lib/loop/vinyl";
import { earlyRuleFor, earlySetFor, freeTrackNumber, releasedKey } from "@/lib/loop/album";

const VOL_1 = ALBUMS[0];
const VOL_2 = ALBUMS[1];

describe("the two albums", () => {
  it("keeps the album that always existed as Vol. 1", () => {
    expect(VOL_1.albumId).toBe("724666e5-66a8-4229-99ee-d5450076b749");
    expect(ALBUM_ID).toBe(VOL_1.albumId);
    expect(new Set(ALBUM_IDS).size).toBe(2);
    expect(VOL_1.title).toBe("Loop Soul Vol. 1");
    expect(VOL_2.title).toBe("Loop Soul Vol. 2");
  });

  it("puts songs 1 to 9 on Vol. 1 and 10 to 14 on Vol. 2", () => {
    expect(songsOf(1).map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(songsOf(2).map((s) => s.number)).toEqual([10, 11, 12, 13, 14]);
    expect(albumOfSong(songBySlug("ghost-world")!).albumId).toBe(VOL_2.albumId);
    expect(albumById(VOL_2.albumId)?.volume).toBe(2);
    expect(albumById("not-an-album")).toBeNull();
  });

  it("keeps all three singles on Vol. 1", () => {
    for (const slug of ["makunahea", "1984", "newspeak"]) expect(songBySlug(slug)!.volume).toBe(1);
  });

  it("numbers each album from 1, while the film keeps 1 to 14", () => {
    expect(trackNumber(songBySlug("makunahea")!)).toBe(9);
    expect(trackNumber(songBySlug("the-other-side")!)).toBe(1);
    expect(trackNumber(songBySlug("ghost-world")!)).toBe(5);
    expect(SONGS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});

describe("the records", () => {
  it("runs the sides A to D in album order, each record holding exactly its album", () => {
    expect(SIDES.map((s) => s.side)).toEqual(["A", "B", "C", "D"]);
    expect(SIDES.flatMap((s) => s.songs)).toEqual(SONGS.map((s) => s.number));
    for (const v of [1, 2] as const) {
      expect(SIDES.filter((s) => s.volume === v).flatMap((s) => s.songs)).toEqual(songsOf(v).map((s) => s.number));
    }
  });

  it("keeps every side to about fifteen minutes, so the cut stays loud", () => {
    for (const s of SIDES) expect(sideSeconds(s)).toBeLessThanOrEqual(15 * 60);
    // The lengths the owner approved, with the gaps between tracks.
    expect(SIDES.map(sideSeconds)).toEqual([14 * 60 + 46, 12 * 60 + 42, 14 * 60 + 10, 9 * 60 + 47]);
    expect(GAP_SECONDS).toBe(2);
  });

  it("is a store product per album", () => {
    expect(vinylProduct(1).handle).toBe("loop-soul-vol-1-vinyl");
    expect(vinylProduct(2).title).toBe("Loop Soul Vol. 2, on vinyl");
    expect(vinylProduct(2).sides.map((s) => s.side)).toEqual(["C", "D"]);
  });
});

describe("each album is released on its own", () => {
  it("keeps the switch from before the split as Vol. 1's, and gives Vol. 2 its own", () => {
    expect(releasedKey(VOL_1.albumId)).toBe("album_released");
    expect(releasedKey(VOL_2.albumId)).not.toBe("album_released");
  });

  it("deals the early draw from Vol. 1 only", () => {
    const rule = { enabled: true, extra: 2 };
    expect(earlyRuleFor(VOL_1.albumId, rule)).toEqual(rule);
    expect(earlyRuleFor(VOL_2.albumId, rule).enabled).toBe(false);
  });

  // Why Vol. 2 cannot share the draw: renumbered 1 to 5 and without the single,
  // the free-track fallback lands on its second track and the intro rule
  // skips its first, which is a song.
  it("would hand out The Mind Pt 1 free if Vol. 2 had a draw", () => {
    const vol2 = songsOf(2).map((s) => ({ track_number: trackNumber(s), title: s.title, duration: s.seconds }));
    expect(vol2[freeTrackNumber(vol2, null)! - 1].title).toBe("The Mind Pt 1");
    const rule = earlyRuleFor(VOL_2.albumId, { enabled: true, extra: 2 });
    expect(earlySetFor("someone@example.com", vol2, null, rule)).toEqual([]);
  });
});
