import { wrap, layoutFilmCard, layoutFilmChapter } from "@/lib/loop/poster/layout";
import { measure } from "@/lib/loop/brand";

const verse =
  "And the LORD God formed man of the dust of the ground, and breathed into his nostrils the breath of life; and man became a living soul.";

describe("wrap", () => {
  it("never lets a line run past the measure", () => {
    const lines = wrap(verse, 600, { size: 40 });
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(measure(l, { size: 40 })).toBeLessThanOrEqual(600);
    expect(lines.join(" ")).toBe(verse);
  });
  it("keeps a short line whole", () => {
    expect(wrap("A living soul.", 2000, { size: 40 })).toEqual(["A living soul."]);
  });
});

describe("the scripture card", () => {
  const band = { x: 76, y: 115, w: 928, h: 460 };
  it("sets the flip as the headline over the verse and the reference", () => {
    const r = layoutFilmCard({ w: 1080, h: 1920, band, align: "middle", verseRef: "Genesis 2:7", verseText: verse, flip: "Dust, then breath." });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const glyphs = r.list.ops.filter((o) => o.kind === "glyphs");
    const first = glyphs[0];
    const last = glyphs[glyphs.length - 1];
    expect(first.kind === "glyphs" && first.weight).toBe(700);
    expect(last.kind === "glyphs" && last.glyphs.map((g) => g.ch).join("")).toBe("GENESIS 2:7");
    // Everything inside the band.
    for (const o of glyphs) {
      if (o.kind !== "glyphs") continue;
      expect(o.y).toBeGreaterThan(band.y);
      expect(o.y).toBeLessThanOrEqual(band.y + band.h);
    }
  });
  it("lets the verse lead when there is no flip yet", () => {
    const r = layoutFilmCard({ w: 1080, h: 1920, band, align: "middle", verseRef: "Genesis 2:7", verseText: verse, flip: null });
    expect(r.ok && r.list.ops[0].kind === "glyphs" && r.list.ops[0].weight).toBe(500);
  });
  it("refuses rather than overlap when the words cannot fit", () => {
    const r = layoutFilmCard({ w: 1080, h: 1920, band: { x: 0, y: 0, w: 300, h: 40 }, align: "middle", verseRef: "Psalms 119", verseText: verse.repeat(6), flip: "x" });
    expect(r.ok).toBe(false);
  });
});

describe("the chapter card", () => {
  it("lays out a number, a title and a thread", () => {
    const r = layoutFilmChapter({ w: 3840, h: 2160, number: 2, title: "1984", thread: "He learns what the shadow wants." });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.list.ops.length).toBe(3);
  });
});
