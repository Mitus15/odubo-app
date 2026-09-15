/**
 * @jest-environment node
 *
 * Who may hear the record, and when. Pure rule, no database.
 */
import { decideAlbumAccess, normEmail } from "@/lib/loop/album";

describe("decideAlbumAccess", () => {
  it("makes an owed person wait until it is out", () => {
    expect(decideAlbumAccess({ released: false, entitled: true, holder: false })).toBe("wait");
    expect(decideAlbumAccess({ released: false, entitled: false, holder: true })).toBe("wait");
  });

  it("plays for an owed person once it is out", () => {
    expect(decideAlbumAccess({ released: true, entitled: true, holder: false })).toBe("listen");
    expect(decideAlbumAccess({ released: true, entitled: false, holder: true })).toBe("listen");
  });

  it("asks everyone else to prove the inbox, out or not", () => {
    expect(decideAlbumAccess({ released: false, entitled: false, holder: false })).toBe("prove");
    expect(decideAlbumAccess({ released: true, entitled: false, holder: false })).toBe("prove");
  });
});

describe("normEmail", () => {
  it("matches the ledger key to the recovery key", () => {
    expect(normEmail(" Jane@Example.COM ")).toBe("jane@example.com");
  });
});
