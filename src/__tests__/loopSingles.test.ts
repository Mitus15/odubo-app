import {
  SINGLES,
  parseReleases,
  singleStatuses,
  frontSingle,
  todayPacific,
  releaseLabel,
  fieldPackOfKey,
  singleByFieldPack,
  singleBySlug,
} from "@/lib/loop/singles";
import { singleMeta, cardTitleSize } from "@/lib/loop/singlePage";

describe("the singles", () => {
  it("run in the owner's order: Makunahea, 1984, News Peak", () => {
    expect(SINGLES.map((s) => s.slug)).toEqual(["makunahea", "1984", "newspeak"]);
    expect(singleBySlug("NewsPeak")?.title).toBe("News Peak");
    expect(singleBySlug("album")).toBeNull();
  });

  it("keeps 1984 out and the others coming when nothing is stored", () => {
    const s = singleStatuses(parseReleases(null), "2026-09-29");
    expect(s.map((x) => [x.slug, x.out])).toEqual([["makunahea", false], ["1984", true], ["newspeak", false]]);
  });

  it("releases a single on its date, not before", () => {
    const r = parseReleases(JSON.stringify({ makunahea: "2026-10-16" }));
    expect(singleStatuses(r, "2026-10-15")[0].out).toBe(false);
    expect(singleStatuses(r, "2026-10-16")[0].out).toBe(true);
  });

  it("ignores a malformed date rather than releasing a song", () => {
    const r = parseReleases(JSON.stringify({ newspeak: "soon", makunahea: 5 }));
    expect(r.newspeak).toBeNull();
    expect(r.makunahea).toBeNull();
    expect(parseReleases("not json")["1984"]).toBe("2026-09-08");
  });

  it("sends /loop to the newest single that is out", () => {
    const r = parseReleases(JSON.stringify({ makunahea: "2026-10-16" }));
    expect(frontSingle(singleStatuses(r, "2026-10-01")).slug).toBe("1984");
    expect(frontSingle(singleStatuses(r, "2026-10-20")).slug).toBe("makunahea");
    const none = parseReleases(JSON.stringify({ "1984": null }));
    expect(frontSingle(singleStatuses(none, "2026-10-01")).slug).toBe("makunahea");
  });

  it("drops at midnight Pacific", () => {
    // 06:59 UTC on Oct 16 is still Oct 15 in Kamloops.
    expect(todayPacific(new Date("2026-10-16T06:59:00Z"))).toBe("2026-10-15");
    expect(todayPacific(new Date("2026-10-16T07:00:00Z"))).toBe("2026-10-16");
  });

  it("labels a date without a timezone shift", () => {
    expect(releaseLabel("2026-10-16")).toBe("Oct 16");
    expect(releaseLabel(null)).toBeNull();
  });
});

describe("stem-field packs", () => {
  it("knows a pack key from the shared probe", () => {
    expect(fieldPackOfKey("warehouse/field/newspeak/vox.opus")).toBe("newspeak");
    expect(fieldPackOfKey("warehouse/field/newspeak/pack.json")).toBe("newspeak");
    expect(fieldPackOfKey("warehouse/field/probe.opus")).toBeNull();
    expect(fieldPackOfKey("music/loop-soul/02.m4a")).toBeNull();
  });
  it("belongs to its single", () => {
    expect(singleByFieldPack("newspeak")?.title).toBe("News Peak");
    expect(singleByFieldPack("1984")).toBeNull();
  });
});

describe("a coming single's link", () => {
  const song = { title: "Makunahea", artistName: "Mani Odubo", albumTitle: "Loop Soul" };
  it("says when, and never offers to play", () => {
    expect(singleMeta(song, null, { out: false, dateLabel: "Oct 16" }).description).toBe("A single from Loop Soul. Out Oct 16.");
    expect(singleMeta(song, null, { out: false, dateLabel: null }).description).toBe("A single from Loop Soul. Coming soon.");
  });
  it("fits a long title on the card", () => {
    expect(cardTitleSize("1984", true)).toBe(150);
    // Jost Bold runs about 0.6 em a glyph; the column beside the cover is 458px.
    expect(cardTitleSize("Makunahea", true) * 9 * 0.6).toBeLessThan(458);
  });
});
