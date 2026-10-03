import { albumRoute } from "@/lib/loop/albumAddress";
import { sharePath } from "@/lib/loop/singles";
import { SONGS } from "@/lib/loop/songs";

describe("the album's own address, /signsoflife", () => {
  it("serves the front door, the record and the film from /loop", () => {
    expect(albumRoute("/signsoflife")).toBe("/loop");
    expect(albumRoute("/signsoflife/album")).toBe("/loop/album");
    expect(albumRoute("/signsoflife/film")).toBe("/loop/film");
  });

  it("serves every song's page", () => {
    for (const s of SONGS) expect(albumRoute(`/signsoflife/${s.slug}`)).toBe(`/loop/${s.slug}`);
  });

  it("never serves Loop Soul's own routes, so the admin gate has one door", () => {
    for (const p of ["admin", "admin/login", "admin/door", "store", "code", "press", "legacy", "journal", "p/abc", "d"]) {
      expect(albumRoute(`/signsoflife/${p}`)).toBeNull();
    }
    expect(albumRoute("/signsoflife/1984/extra")).toBeNull();
    expect(albumRoute("/signsoflife/nothing-here")).toBeNull();
  });

  it("leaves every other path alone", () => {
    expect(albumRoute("/loop/1984")).toBeNull();
    expect(albumRoute("/signsoflifex")).toBeNull();
    expect(albumRoute("/")).toBeNull();
  });

  it("is what a shared link says", () => {
    expect(sharePath("1984")).toBe("/signsoflife/1984");
    expect(albumRoute(sharePath("makunahea"))).toBe("/loop/makunahea");
  });
});
