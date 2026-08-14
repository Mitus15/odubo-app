import {
  layoutEventPoster,
  layoutTicket,
  layoutPassCard,
  withBleed,
  qrSrc,
  WORDMARK_SRC,
  ODUBO_SRC,
  SCOTTS_SRC,
  POSTER_SIZES,
  PRINT_BLEED,
  type EventDetails,
  type LayoutDeps,
  type Op,
  type PosterSize,
} from "@/lib/loop/poster/layout";
import { measure, CAP_HEIGHT } from "@/lib/loop/brand";

/**
 * The suite that keeps the two poster renderers from drifting apart again.
 *
 * layout() is pure and synchronous, so every piece can be asserted at every
 * size with no canvas, no sharp, no DOM: no two ops may overlap, every fitted
 * line must fit its measure, and impossible input must come back as a refusal
 * — never as an overlapping render. The module boundary makes sharing
 * possible; THIS file is what makes divergence loud.
 */

const QR = qrSrc("https://example.com/loop");

/** Intrinsic sizes for every asset the layouts reference (real ratios). */
const deps: LayoutDeps = {
  sizes: {
    [WORDMARK_SRC]: { w: 820, h: 561 },
    [ODUBO_SRC]: { w: 1313, h: 1198 },
    [SCOTTS_SRC]: { w: 1885, h: 849 },
    [QR]: { w: 1024, h: 1024 },
    "/loop/figures/crowd.png": { w: 1486, h: 610 },
    "/loop/figures/dance.png": { w: 1385, h: 1200 },
    "/loop/figures/listen.png": { w: 669, h: 1200 },
  },
};

const details: EventDetails = {
  volume: "VOLUME ONE",
  theme: "1984",
  date: "SATURDAY SEPTEMBER 12",
  doors: "DOORS 9PM",
  venue: "SCOTT'S INN & SUITES · KAMLOOPS",
  passes: "60 PASSES",
  price: "$20",
};

type Box = { x1: number; y1: number; x2: number; y2: number; label: string };

/** Conservative bounding boxes per op — glyph runs measured, ascent≈cap. */
function boxes(ops: Op[]): Box[] {
  const out: Box[] = [];
  for (const op of ops) {
    switch (op.kind) {
      case "image":
        out.push({ x1: op.x, y1: op.y, x2: op.x + op.w, y2: op.y + op.h, label: `image:${op.src}` });
        break;
      case "glyphs": {
        if (op.glyphs.length === 0) break;
        const first = op.glyphs[0];
        const last = op.glyphs[op.glyphs.length - 1];
        const lastW = measure(last.ch, { size: op.size, weight: op.weight });
        const text = op.glyphs.map((g) => g.ch).join("");
        out.push({
          x1: first.x,
          y1: op.y - op.size * CAP_HEIGHT,
          x2: last.x + lastW,
          y2: op.y + op.size * 0.06, // hairline of descender slack
          label: `text:${text.slice(0, 24)}`,
        });
        break;
      }
      default:
        break; // rects are backgrounds; rules/arcs are piece-specific
    }
  }
  return out;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

function assertNoOverlap(ops: Op[]): void {
  const bs = boxes(ops);
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      if (overlaps(bs[i], bs[j])) {
        throw new Error(`overlap: [${bs[i].label}] intersects [${bs[j].label}]`);
      }
    }
  }
}

describe("layoutEventPoster", () => {
  const sizes = Object.keys(POSTER_SIZES) as PosterSize[];

  it.each(sizes)("lays out %s with no two elements overlapping", (size) => {
    const r = layoutEventPoster(
      { size, figureSrc: "/loop/figures/crowd.png", qrUrl: "https://example.com/loop", details },
      deps,
    );
    expect(r.ok).toBe(true);
    if (r.ok) assertNoOverlap(r.list.ops);
  });

  it.each(sizes)("fits the slogan inside the measure at %s", (size) => {
    const r = layoutEventPoster(
      { size, figureSrc: null, qrUrl: "https://example.com/loop", details },
      deps,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const slogan = r.list.ops.find(
      (o) => o.kind === "glyphs" && o.glyphs.map((g) => g.ch).join("") === "Come Dance",
    );
    expect(slogan).toBeDefined();
    if (slogan && slogan.kind === "glyphs") {
      const width =
        slogan.glyphs[slogan.glyphs.length - 1].x +
        measure("e", { size: slogan.size, weight: slogan.weight }) -
        slogan.glyphs[0].x;
      expect(width).toBeLessThanOrEqual(r.list.w);
    }
  });

  it("collapses absent detail rows instead of leaving holes", () => {
    const withAll = layoutEventPoster(
      { size: "print", figureSrc: "/loop/figures/dance.png", qrUrl: "https://x.co", details },
      deps,
    );
    const bare = layoutEventPoster(
      { size: "print", figureSrc: "/loop/figures/dance.png", qrUrl: "https://x.co", details: null },
      deps,
    );
    expect(withAll.ok && bare.ok).toBe(true);
    if (!withAll.ok || !bare.ok) return;
    const hero = (r: typeof bare) =>
      r.ok ? (r.list.ops.find((o) => o.kind === "image" && o.src.includes("dance")) as { h: number }) : { h: 0 };
    // No details → the hero gets MORE room, never less.
    expect(hero(bare).h).toBeGreaterThan(hero(withAll).h);
  });

  it("refuses a pathological slogan rather than overlapping", () => {
    const r = layoutEventPoster(
      {
        size: "story",
        figureSrc: "/loop/figures/dance.png",
        slogan: "A ludicrously long slogan that cannot possibly fit on one poster line at any legible size whatsoever",
        qrUrl: "https://x.co",
        details,
      },
      deps,
    );
    // Either it fitted (auto-shrink) with no overlap, or it refused — both are
    // acceptable; a silent overlap is not.
    if (r.ok) assertNoOverlap(r.list.ops);
    else expect(r.error).toMatch(/needs|free/);
  });

  it("refuses when an image's dimensions were not prepared", () => {
    const r = layoutEventPoster(
      { size: "print", figureSrc: "/not/prepared.png", qrUrl: "https://x.co", details },
      deps,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("/not/prepared.png");
  });
});

describe("layoutTicket", () => {
  it("lays out with no overlap and both QR + tear line present", () => {
    const r = layoutTicket(
      {
        qrUrl: "https://example.com/loop",
        figureSrc: "/loop/figures/crowd.png",
        details: { ...details, venue: "SCOTT'S INN · KAMLOOPS" },
      },
      deps,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    assertNoOverlap(r.list.ops);
    expect(r.list.ops.some((o) => o.kind === "rule" && o.dash)).toBe(true);
    expect(r.list.ops.some((o) => o.kind === "image" && o.src.startsWith("qr:"))).toBe(true);
  });

  it("refuses an oversized theme rather than printing over the stub", () => {
    const r = layoutTicket(
      {
        qrUrl: "https://x.co",
        figureSrc: "/loop/figures/crowd.png",
        details: { ...details, theme: "A VERY LONG THEME NAME THAT CANNOT POSSIBLY FIT" },
      },
      deps,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/volume line/);
  });
});

describe("layoutPassCard", () => {
  it("lays out square with no overlap and no QR (store shelf face)", () => {
    const r = layoutPassCard({ figureSrc: "/loop/figures/crowd.png", details }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.list.w).toBe(r.list.h);
    assertNoOverlap(r.list.ops);
    expect(r.list.ops.some((o) => o.kind === "image" && o.src.startsWith("qr:"))).toBe(false);
  });
});

describe("withBleed", () => {
  it("expands by margin+bleed on each side and keeps crop marks in the margin", () => {
    const base = layoutEventPoster(
      { size: "print", figureSrc: "/loop/figures/crowd.png", qrUrl: "https://x.co", details },
      deps,
    );
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const sheet = withBleed(base.list);
    const off = PRINT_BLEED.bleedPx + PRINT_BLEED.marginPx;
    expect(sheet.w).toBe(base.list.w + 2 * off);
    expect(sheet.h).toBe(base.list.h + 2 * off);
    // Crop marks (undashed rules) must never enter the bleed box.
    const M = PRINT_BLEED.marginPx;
    for (const op of sheet.ops) {
      if (op.kind !== "rule" || op.dash) continue;
      const inMarginBand =
        Math.min(op.x1, op.x2) >= sheet.w - M ||
        Math.max(op.x1, op.x2) <= M ||
        Math.min(op.y1, op.y2) >= sheet.h - M ||
        Math.max(op.y1, op.y2) <= M;
      expect(inMarginBand).toBe(true);
    }
  });
});
