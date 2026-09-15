import {
  layoutEventPoster,
  layoutLivingPoster,
  layoutTicket,
  layoutPassCard,
  layoutTournament,
  withBleed,
  qrSrc,
  WORDMARK_SRC,
  ODUBO_SRC,
  SCOTTS_SRC,
  POSTER_SIZES,
  LIVING_POSTER_SIZE,
  PRINT_BLEED,
  type EventDetails,
  type LayoutDeps,
  type Op,
  type PosterSize,
  type TournamentArt,
  type TournamentBand,
} from "@/lib/loop/poster/layout";
import { artUrl, closesLine } from "@/lib/loop/poster/copy";
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

// No volume/theme: they came off the artwork on 2026-08-25 and off the type on
// the same day, but this fixture kept setting them and the literal has been a
// type error ever since. The suite below still asserts they never render.
const details: EventDetails = {
  date: "SATURDAY OCTOBER 10",
  doors: "DOORS 6:30 · ALBUM AT 8",
  venue: "SCOTT'S INN & SUITES · KAMLOOPS",
  note: "DRESS CODE · 80s",
  price: "$5",
  record: "AN ALBUM BY MANI ODUBO",
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

  // The record kicker is the album's one claim on the artwork. It is optional
  // because a volume only USUALLY takes its name from a track, so it has to be
  // safe both present and absent, at every size.
  it.each(sizes)("lays out the record line at %s with no overlap", (size) => {
    const r = layoutEventPoster(
      {
        size,
        figureSrc: "/loop/figures/crowd.png",
        qrUrl: "https://example.com/loop",
        details: { ...details, record: "AN ALBUM BY MANI ODUBO" },
      },
      deps,
    );
    expect(r.ok).toBe(true);
    if (r.ok) assertNoOverlap(r.list.ops);
  });

  // The album credit is the identity and takes the big line under the header.
  // Volume and theme are NOT on the event poster at all (removed 2026-08-25) —
  // leading with an edition number made the night read as an instalment.
  it.each(sizes)("puts the album credit above the hero at %s, and prints no volume", (size) => {
    const r = layoutEventPoster(
      {
        size,
        figureSrc: "/loop/figures/crowd.png",
        qrUrl: "https://example.com/loop",
        details: { ...details, record: "AN ALBUM BY MANI ODUBO" },
      },
      deps,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const texts = r.list.ops
      .filter((o) => o.kind === "glyphs")
      .map((o) => (o.kind === "glyphs" ? o.glyphs.map((g) => g.ch).join("") : ""));

    expect(texts).toContain("AN ALBUM BY MANI ODUBO");
    // The volume/theme never appears, in any joined form.
    expect(texts.some((t) => t.includes("VOLUME"))).toBe(false);
    expect(texts.some((t) => t.includes("1984") && !t.includes("DRESS"))).toBe(false);

    const album = r.list.ops.find(
      (o) => o.kind === "glyphs" && o.glyphs.map((g) => g.ch).join("") === "AN ALBUM BY MANI ODUBO",
    );
    const hero = r.list.ops.find((o) => o.kind === "image" && o.src.includes("crowd"));
    if (album?.kind === "glyphs" && hero?.kind === "image") {
      expect(album.y).toBeLessThan(hero.y);
    }
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

  // ── the living poster: a story that has to carry its own way in ──────────
  it("drops the QR on a story but keeps it everywhere else", () => {
    const hasQr = (size: PosterSize) => {
      const r = layoutEventPoster(
        { size, figureSrc: "/loop/figures/dance.png", qrUrl: "https://example.com/loop", details },
        deps,
      );
      expect(r.ok).toBe(true);
      return r.ok && r.list.ops.some((o) => o.kind === "image" && o.src.startsWith("qr:"));
    };
    expect(hasQr("story")).toBe(false);
    expect(hasQr("print")).toBe(true);
    expect(hasQr("feed")).toBe(true);
  });

  it("puts the code on a story when asked, without overlapping the wordmark", () => {
    const r = layoutEventPoster(
      {
        size: "story",
        figureSrc: null,
        qrUrl: "https://example.com/loop",
        showQr: true,
        details,
      },
      deps,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    assertNoOverlap(r.list.ops);
    expect(r.list.ops.some((o) => o.kind === "image" && o.src.startsWith("qr:"))).toBe(true);
    // Asking for the code reverts the header to the print treatment, so the
    // wordmark must leave the centre — that is what makes room for the code.
    const wm = r.list.ops.find((o) => o.kind === "image" && o.src === WORDMARK_SRC) as {
      x: number;
      w: number;
    };
    expect(wm.x + wm.w / 2).toBeLessThan(POSTER_SIZES.story.w / 2);
  });

  it("reports a hero band that the type never reaches into", () => {
    const r = layoutEventPoster(
      {
        size: "story",
        figureSrc: null,
        qrUrl: "https://example.com/loop",
        showQr: true,
        details,
      },
      deps,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hero = r.list.hero;
    expect(hero).toBeDefined();
    if (!hero) return;
    expect(hero.h).toBeGreaterThan(0);
    // The living poster puts video in this box. Anything the engine drew that
    // pokes into it would be sitting on the dancer.
    for (const box of boxes(r.list.ops)) {
      const clear =
        box.y2 <= hero.y || box.y1 >= hero.y + hero.h ||
        box.x2 <= hero.x || box.x1 >= hero.x + hero.w;
      expect(`${box.label}:${clear}`).toBe(`${box.label}:true`);
    }
  });

  it("leaves the hero band empty when there is no figure", () => {
    const r = layoutEventPoster(
      { size: "story", figureSrc: null, qrUrl: "https://x.co", showQr: true, details },
      deps,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const figures = r.list.ops.filter(
      (o) => o.kind === "image" && o.src.includes("/loop/figures/"),
    );
    expect(figures).toHaveLength(0);
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

describe("layoutLivingPoster", () => {
  const spec = { qrUrl: "https://example.com/loop", details };

  it("lays out with no overlap and carries the code, the date and both marks", () => {
    const r = layoutLivingPoster(spec, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    assertNoOverlap(r.list.ops);
    const srcs = r.list.ops.flatMap((o) => (o.kind === "image" ? [o.src] : []));
    expect(srcs).toContain(WORDMARK_SRC);
    expect(srcs).toContain(ODUBO_SRC);
    expect(srcs).toContain(SCOTTS_SRC);
    expect(srcs.some((x) => x.startsWith("qr:"))).toBe(true);
    const text = r.list.ops
      .flatMap((o) => (o.kind === "glyphs" ? [o.glyphs.map((g) => g.ch).join("")] : []))
      .join(" | ");
    expect(text).toContain("SATURDAY OCTOBER 10");
    expect(text).toContain("SCOTT'S INN & SUITES");
  });

  it("reserves a hero band nothing is drawn into", () => {
    const r = layoutLivingPoster(spec, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hero = r.list.hero;
    expect(hero).toBeDefined();
    if (!hero) return;
    // The dancer is fitted to this box by scripts/loop/living-poster.ts. If
    // anything the engine drew reaches into it, the type lands on him — which
    // is exactly the bug this band exists to prevent.
    for (const box of boxes(r.list.ops)) {
      const clear = box.y2 <= hero.y || box.y1 >= hero.y + hero.h;
      expect(`${box.label}:${clear}`).toBe(`${box.label}:true`);
    }
  });

  it("gives the dancer at least a third of the frame", () => {
    const r = layoutLivingPoster(spec, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The whole reason this is not the event poster with a hole in it: that
    // one left the hero 27% of a 9:16 sheet, and a full-body take needs ~48%.
    expect(r.list.hero!.h / LIVING_POSTER_SIZE.h).toBeGreaterThan(0.33);
  });

  it("reads top-down: the record above its feature credit", () => {
    const r = layoutLivingPoster(spec, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const yOf = (needle: string) => {
      const op = r.list.ops.find(
        (o) => o.kind === "glyphs" && o.glyphs.map((g) => g.ch).join("").includes(needle),
      );
      return op && op.kind === "glyphs" ? op.y : NaN;
    };
    // Built bottom-up in places, so this is the assertion that catches an
    // emission order that renders the credit stack upside down.
    expect(yOf("AN ALBUM BY MANI ODUBO")).toBeLessThan(yOf("SATURDAY OCTOBER 10"));
    expect(yOf("SATURDAY OCTOBER 10")).toBeLessThan(yOf("SCOTT'S INN & SUITES"));
  });

  it("drops the slogan on null and defaults it otherwise", () => {
    const has = (slogan: string | null | undefined) => {
      const r = layoutLivingPoster({ ...spec, slogan }, deps);
      expect(r.ok).toBe(true);
      return (
        r.ok &&
        r.list.ops.some(
          (o) => o.kind === "glyphs" && o.glyphs.map((g) => g.ch).join("") === "Come Dance",
        )
      );
    };
    expect(has(undefined)).toBe(true);
    expect(has(null)).toBe(false);
  });

  it("refuses rather than squeezing the hero out with a giant date line", () => {
    const r = layoutLivingPoster(
      {
        ...spec,
        details: { ...details, venue: "A".repeat(400), record: "B".repeat(400) },
      },
      deps,
    );
    if (r.ok) assertNoOverlap(r.list.ops);
    else expect(r.error).toMatch(/hero band|needs/);
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

  it("refuses an oversized credit rather than printing over the stub", () => {
    const r = layoutTicket(
      {
        qrUrl: "https://x.co",
        figureSrc: "/loop/figures/crowd.png",
        details: { ...details, record: "AN EXCEEDINGLY LONG CREDIT LINE THAT CANNOT POSSIBLY FIT" },
      },
      deps,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/record line/);
  });

  // The stub is what a holder keeps in a pocket, so it carries the credit and
  // the one instruction they can still act on before the night.
  it("prints the credit and the dress code on the stub, and never a volume", () => {
    const r = layoutTicket(
      { qrUrl: "https://x.co", figureSrc: "/loop/figures/crowd.png", details },
      deps,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texts = r.list.ops
      .filter((o) => o.kind === "glyphs")
      .map((o) => (o.kind === "glyphs" ? o.glyphs.map((g) => g.ch).join("") : ""));
    expect(texts).toContain("AN ALBUM BY MANI ODUBO");
    expect(texts).toContain("DRESS CODE · 80s");
    expect(texts).toContain("ADMITS ONE");
    expect(texts.some((t) => t.includes("VOLUME"))).toBe(false);
    assertNoOverlap(r.list.ops);
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

describe("layoutTournament", () => {
  const sizes = Object.keys(POSTER_SIZES) as PosterSize[];
  const ART = "https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg";
  const art = (n: number): TournamentArt[] =>
    Array.from({ length: n }, (_, i) => ({
      src: `${ART}?${i}`,
      title: `TRACK ${i + 1}`,
      artist: `ARTIST ${i + 1}`,
    }));
  const tdeps = (n: number): LayoutDeps => ({
    sizes: {
      ...deps.sizes,
      ...Object.fromEntries(art(n).map((a) => [a.src, { w: 600, h: 600 }])),
    },
  });
  const spec = (size: PosterSize, band: TournamentBand) => ({
    size,
    qrUrl: "https://example.com/loop",
    band,
    headline: "QUARTERFINALS",
    sublines: ["LEADING · SEPTEMBER", "VOTING CLOSES IN 2 DAYS"],
    cta: "SCAN TO VOTE",
  });

  const bands: [string, TournamentBand, number][] = [
    ["grid of 12", { kind: "grid", art: art(12), emptyFigureSrc: "/loop/figures/crowd.png" }, 12],
    ["grid of 5 (ragged last row)", { kind: "grid", art: art(5), emptyFigureSrc: "/loop/figures/crowd.png" }, 5],
    ["empty grid (crowd fallback)", { kind: "grid", art: [], emptyFigureSrc: "/loop/figures/crowd.png" }, 0],
    ["seed wall of 8", { kind: "seeds", art: art(8) }, 8],
    [
      "quarterfinal pairs",
      {
        kind: "pairs",
        pairs: [
          { a: art(1)[0], b: art(2)[1], pctA: 0.62 },
          { a: art(3)[2], b: art(4)[3], pctA: null }, // 0–0 → neutral hairline
          { a: art(5)[4], b: null, pctA: null }, // TBD slot
          { a: art(7)[6], b: art(8)[7], pctA: 1 },
        ],
      },
      8,
    ],
    ["the final (one pair)", { kind: "pairs", pairs: [{ a: art(1)[0], b: art(2)[1], pctA: 0.5 }] }, 2],
    ["champion hero", { kind: "hero", art: art(1)[0] }, 1],
    ["champion with no artwork", { kind: "hero", art: { src: "", title: "BILLIE JEAN", artist: "MICHAEL JACKSON" } }, 0],
  ];

  for (const [name, band, n] of bands) {
    it.each(sizes)(`lays out ${name} at %s with no overlap`, (size) => {
      const r = layoutTournament(spec(size, band), tdeps(n));
      expect(r.ok).toBe(true);
      if (r.ok) assertNoOverlap(r.list.ops);
    });
  }

  it("renders a neutral hairline for 0–0, never a filled bar", () => {
    const r = layoutTournament(
      spec("print", { kind: "pairs", pairs: [{ a: art(1)[0], b: art(2)[1], pctA: null }] }),
      tdeps(2),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Exactly one rule op beyond none (the hairline) and no bar rects.
    const rules = r.list.ops.filter((o) => o.kind === "rule");
    expect(rules).toHaveLength(1);
  });

  it("carries the arc (the anthem phrase asks) and a straight headline", () => {
    const r = layoutTournament(spec("print", { kind: "hero", art: art(1)[0] }), tdeps(1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.list.ops.some((o) => o.kind === "arcGlyphs")).toBe(true);
    const straight = r.list.ops.find(
      (o) => o.kind === "glyphs" && o.glyphs.map((g) => g.ch).join("") === "QUARTERFINALS",
    );
    expect(straight).toBeDefined();
  });
});

describe("poster copy helpers", () => {
  it("prints absolute dates and posts relative ones", () => {
    const closes = Date.UTC(2026, 8, 5, 12, 0, 0); // Sept 5
    const printLine = closesLine(closes, "print", closes - 2 * 86_400_000);
    const storyLine = closesLine(closes, "story", closes - 2 * 86_400_000);
    expect(printLine).toMatch(/^CLOSES SEPTEMBER \d/); // absolute — never goes stale
    expect(storyLine).toBe("CLOSES IN 2 DAYS");
  });

  it("upsizes artwork for print only, through the one indirection", () => {
    const url = "https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg";
    expect(artUrl(url, "print")).toContain("/1500x1500bb.");
    expect(artUrl(url, "feed")).toContain("/600x600bb.");
  });

  it("returns an empty string rather than a broken src for missing artwork", () => {
    expect(artUrl(null, "print")).toBe("");
    expect(artUrl("", "feed")).toBe("");
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
