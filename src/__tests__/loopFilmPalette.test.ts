import {
  palette,
  defaultField,
  contrast,
  toLch,
  fromLch,
  hex,
  parseHex,
  SAND,
  SAND_DEEP,
  SAND_BRIGHT,
  INK,
  type RGB,
} from "@/lib/loop/film/palette";

const near = (a: RGB, b: RGB, tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

describe("the film palette", () => {
  it("reproduces the cover on sand", () => {
    const p = palette(SAND);
    expect(near(p.mid, SAND_DEEP)).toBe(true);
    expect(near(p.highlight, SAND_BRIGHT)).toBe(true);
    expect(p.ink).toEqual(INK);
    expect(p.badge).toEqual(SAND_BRIGHT);
  });

  it("round-trips colours through OKLCH", () => {
    for (const c of [SAND, SAND_DEEP, SAND_BRIGHT, INK, [30, 120, 220] as RGB]) {
      expect(near(fromLch(toLch(c)), c, 1)).toBe(true);
    }
  });

  it("gives Welcome sand and walks the other thirteen around the wheel", () => {
    expect(defaultField(0)).toEqual(SAND);
    const hues = Array.from({ length: 14 }, (_, i) => toLch(defaultField(i)).h);
    const distinct = new Set(hues.map((h) => Math.round(h / 10)));
    expect(distinct.size).toBeGreaterThanOrEqual(12);
  });

  it("keeps the ink figure readable on every default field", () => {
    for (let i = 0; i < 14; i++) {
      expect(contrast(INK, defaultField(i))).toBeGreaterThan(7);
    }
  });

  it("puts the shadow below the field and the highlight above it", () => {
    for (let i = 0; i < 14; i++) {
      const f = defaultField(i);
      const p = palette(f);
      expect(toLch(p.shadow).L).toBeLessThan(toLch(f).L);
      expect(toLch(p.highlight).L).toBeGreaterThan(toLch(f).L);
      expect(toLch(p.mid).L).toBeLessThan(toLch(f).L);
    }
  });

  it("reads and writes hex", () => {
    expect(hex(SAND)).toBe("#d9aa7a");
    expect(parseHex("#d9aa7a")).toEqual(SAND);
    expect(parseHex("nope")).toBeNull();
  });
});
