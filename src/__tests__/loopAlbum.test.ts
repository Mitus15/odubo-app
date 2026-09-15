/**
 * @jest-environment node
 *
 * Who may hear the record, and when. Pure rule, no database.
 */
import { decideAlbumAccess, normEmail, parseEarlyTracks } from "@/lib/loop/album";

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

describe("parseEarlyTracks", () => {
  it("defaults to the opening three when never set, and to none when set empty", () => {
    expect(parseEarlyTracks(null)).toEqual([1, 2, 3]);
    expect(parseEarlyTracks("")).toEqual([]);
  });
  it("dedupes, sorts and drops junk", () => {
    expect(parseEarlyTracks("3, 1,1, x, 0, 2")).toEqual([1, 2, 3]);
  });
});

describe("normEmail", () => {
  it("matches the ledger key to the recovery key", () => {
    expect(normEmail(" Jane@Example.COM ")).toBe("jane@example.com");
  });
});
