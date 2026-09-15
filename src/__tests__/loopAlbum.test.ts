/**
 * @jest-environment node
 *
 * Who may hear the record, and when. Pure rule, no database.
 */
import { dealablePool, decideAlbumAccess, earlySetFor, freeTrackNumber, normEmail } from "@/lib/loop/album";

describe("decideAlbumAccess", () => {
  it("makes an owed person wait until it is out", () => {
    expect(decideAlbumAccess({ released: false, entitled: true, holder: false })).toBe("wait");
    expect(decideAlbumAccess({ released: false, entitled: false, holder: true })).toBe("wait");
  });

  it("plays for an owed person once it is out", () => {
    expect(decideAlbumAccess({ released: true, entitled: true, holder: false })).toBe("listen");
    expect(decideAlbumAccess({ released: true, entitled: false, holder: true })).toBe("listen");
  });

  it("plays the early tracks for an owed person before it is out", () => {
    expect(decideAlbumAccess({ released: false, entitled: true, holder: false, early: true })).toBe("early");
    expect(decideAlbumAccess({ released: false, entitled: false, holder: true, early: true })).toBe("early");
  });

  it("never plays early for someone not owed it", () => {
    expect(decideAlbumAccess({ released: false, entitled: false, holder: false, early: true })).toBe("prove");
  });

  it("asks everyone else to prove the inbox, out or not", () => {
    expect(decideAlbumAccess({ released: false, entitled: false, holder: false })).toBe("prove");
    expect(decideAlbumAccess({ released: true, entitled: false, holder: false })).toBe("prove");
  });
});

// The real Volume 1 shape: an intro, three 35-second interludes, ten songs.
const TRACKS = [
  { track_number: 1, title: "Welcome", duration: 74 },
  { track_number: 2, title: "1984", duration: 294 },
  { track_number: 3, title: "Hallucinogen", duration: 249 },
  { track_number: 4, title: "The No End Theory", duration: 35 },
  { track_number: 5, title: "In The Court", duration: 226 },
  { track_number: 6, title: "News Peak", duration: 334 },
  { track_number: 7, title: "Every Generation", duration: 35 },
  { track_number: 8, title: "Rap", duration: 219 },
  { track_number: 9, title: "Makunahea", duration: 168 },
  { track_number: 10, title: "The Other Side", duration: 331 },
  { track_number: 11, title: "The Mind Pt 1", duration: 517 },
  { track_number: 12, title: "Midnight Marauders", duration: 35 },
  { track_number: 13, title: "The Mind Pt 2", duration: 261 },
  { track_number: 14, title: "Ghost World", duration: 287 },
];
const RULE = { enabled: true, extra: 2 };

describe("freeTrackNumber", () => {
  it("is whatever the front door is playing", () => {
    expect(freeTrackNumber(TRACKS, "1984")).toBe(2);
    expect(freeTrackNumber(TRACKS, "Ghost World")).toBe(14);
  });
  it("falls back to the first track when the setting names nothing", () => {
    expect(freeTrackNumber(TRACKS, null)).toBe(1);
  });
});

describe("dealablePool", () => {
  it("never deals the intro, the interludes, or the free one", () => {
    expect(dealablePool(TRACKS, 2)).toEqual([3, 5, 6, 8, 9, 10, 11, 13, 14]);
  });
});

describe("earlySetFor", () => {
  it("gives the single plus exactly two more", () => {
    const set = earlySetFor("a@b.co", TRACKS, "1984", RULE);
    expect(set).toContain(2);
    expect(set).toHaveLength(3);
  });

  it("never deals the intro or a thirty-five second interlude", () => {
    for (let i = 0; i < 400; i++) {
      const set = earlySetFor(`listener${i}@x.co`, TRACKS, "1984", RULE);
      expect(set).not.toContain(1);
      for (const n of [4, 7, 12]) expect(set).not.toContain(n);
    }
  });

  it("is the same pair every time for one listener, on any device", () => {
    expect(earlySetFor("a@b.co", TRACKS, "1984", RULE)).toEqual(
      earlySetFor("a@b.co", TRACKS, "1984", RULE),
    );
  });

  it("deals different people different pairs", () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => earlySetFor(`p${i}@x.co`, TRACKS, "1984", RULE).join(",")),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("spreads over the whole pool across a room, not just a favourite few", () => {
    const hit = new Set<number>();
    for (let i = 0; i < 300; i++) earlySetFor(`g${i}@x.co`, TRACKS, "1984", RULE).forEach((n) => hit.add(n));
    // every dealable track reachable, plus the free one
    expect([...hit].sort((a, b) => a - b)).toEqual([2, 3, 5, 6, 8, 9, 10, 11, 13, 14]);
  });

  it("gives nothing when the owner turns it off", () => {
    expect(earlySetFor("a@b.co", TRACKS, "1984", { enabled: false, extra: 2 })).toEqual([]);
  });

  it("gives the single alone when the draw is set to zero", () => {
    expect(earlySetFor("a@b.co", TRACKS, "1984", { enabled: true, extra: 0 })).toEqual([2]);
  });
});

describe("normEmail", () => {
  it("matches the ledger key to the recovery key", () => {
    expect(normEmail(" Jane@Example.COM ")).toBe("jane@example.com");
  });
});
