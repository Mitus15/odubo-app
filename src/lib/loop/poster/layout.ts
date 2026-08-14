import {
  SAND,
  INK,
  SLOGAN,
  ANTHEM_PHRASE,
  TRIAD,
  CREDIT_PRESENTER,
  CREDIT_PARTNER,
  measure,
  CAP_HEIGHT,
  type FontWeight,
} from "../brand";

/**
 * The one poster layout engine — pure, synchronous, no I/O, no DOM, no Node.
 *
 * Before this module there were two poster systems with zero shared code: the
 * Node kit (rows, overlap guard, straight slogan, triad, correct credits) and
 * the browser canvas (inline percentages, no guard, an arc the kit had
 * deliberately abandoned, "VENUE PARTNER" against the locked brand doc). They
 * produced visibly different posters from the same brief — the exact drift the
 * owner noticed. This module is the kit's layout model, extracted; both
 * runtimes now render the same display list through thin renderers.
 *
 * Contract:
 *   layout*(spec, deps) -> { ok: true, list } | { ok: false, error }
 * `deps.sizes` maps every image src the spec references to its intrinsic
 * dimensions — resolving those is the runtimes' only job before layout. Text
 * is measured through the committed font-metrics table (see brand.measure), so
 * a size fitted here is the same size in both runtimes by construction.
 *
 * Text ops carry BAKED per-glyph x positions: neither renderer computes any
 * text placement, so they cannot disagree about tracking, centring, or arcs.
 * `y` is always the alphabetic baseline.
 */

/* ── ops ────────────────────────────────────────────────────────────────── */

export type Glyph = { ch: string; x: number };
export type ArcGlyph = { ch: string; x: number; y: number; /** radians */ rot: number };

export type Op =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: string }
  | { kind: "image"; src: string; x: number; y: number; w: number; h: number; opacity?: number }
  | {
      kind: "glyphs";
      glyphs: Glyph[];
      y: number;
      size: number;
      weight: FontWeight;
      opacity: number;
      fill: string;
    }
  | {
      kind: "arcGlyphs";
      glyphs: ArcGlyph[];
      size: number;
      weight: FontWeight;
      opacity: number;
      fill: string;
    }
  | {
      kind: "rule";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      opacity: number;
      dash?: [number, number];
    };

export type DisplayList = { w: number; h: number; ops: Op[] };
export type LayoutResult = { ok: true; list: DisplayList } | { ok: false; error: string };

export type ImageInfo = { w: number; h: number };
export type LayoutDeps = { sizes: Record<string, ImageInfo> };

/* ── shared sources ─────────────────────────────────────────────────────── */

export const WORDMARK_SRC = "/loop/branding/loop-soul.svg";
export const ODUBO_SRC = "/loop/branding/odubo.svg";
export const SCOTTS_SRC = "/loop/branding/scotts-bw.svg";

/** The QR is an image the runtime generates; layout only places it. */
export const qrSrc = (url: string) => `qr:${url}`;

export const POSTER_SIZES = {
  print: { w: 2400, h: 3300, label: "Print · 8×11in 300dpi" },
  feed: { w: 1080, h: 1350, label: "Feed · 4:5" },
  story: { w: 1080, h: 1920, label: "Story · 9:16" },
} as const;
export type PosterSize = keyof typeof POSTER_SIZES;

export const TICKET_SIZE = { w: 2550, h: 1000 } as const;
export const PASS_CARD_SIZE = { w: 2000, h: 2000 } as const;

/* ── specs ──────────────────────────────────────────────────────────────── */

export type EventDetails = {
  volume?: string;
  theme?: string;
  /** e.g. "SATURDAY SEPTEMBER 12" */
  date?: string;
  /** e.g. "DOORS 9PM" */
  doors?: string;
  venue?: string;
  /** e.g. "60 PASSES" */
  passes?: string;
  /** e.g. "$20" */
  price?: string;
};

export type EventPosterSpec = {
  size: PosterSize;
  /** Figure image URL — brand cut-out, upload, or Wall shot. */
  figureSrc: string | null;
  /** Defaults to the brand slogan. Mixed case stays as given — never upcased. */
  slogan?: string;
  showTriad?: boolean;
  qrUrl: string;
  details?: EventDetails | null;
};

/** One piece of quoted album artwork — the only colour allowed on the poster. */
export type TournamentArt = {
  /** Artwork URL — "" when the track has none (renders a keylined text tile). */
  src: string;
  title: string;
  artist: string;
};

export type TournamentPair = {
  a: TournamentArt | null;
  b: TournamentArt | null;
  /** A's share of the vote, 0..1 — null when NOBODY has voted (neutral bar, never "0% / 0%"). */
  pctA: number | null;
};

export type TournamentBand =
  | { kind: "grid"; art: TournamentArt[]; /** 0 nominations → this figure instead of holes. */ emptyFigureSrc: string }
  | { kind: "seeds"; art: TournamentArt[] }
  | { kind: "pairs"; pairs: TournamentPair[] }
  | { kind: "hero"; art: TournamentArt };

/**
 * The tournament poster — the event poster's sibling, not its twin. Same sand
 * field, margins, wordmark, QR + caption, credits; the middle band carries the
 * tournament's STATE in quoted album artwork, and the arc carries the anthem
 * phrase where the event poster puts its volume line. The arc asks; the
 * headline below the band answers straight.
 */
export type TournamentPosterSpec = {
  size: PosterSize;
  qrUrl: string;
  /** The arced question. Defaults to the brand anthem phrase. */
  arcText?: string;
  band: TournamentBand;
  /** Straight and bold under the band — "14 SONGS NOMINATED", a round name, the champion. */
  headline: string;
  /** Up to two quiet lines under the headline (leader, closing time). */
  sublines?: string[];
  /** QR caption — the stage's call to action. */
  cta: string;
};

export type TicketSpec = {
  qrUrl: string;
  details: EventDetails;
  /** The crowd is the ticket's hero. */
  figureSrc: string;
};

export type PassCardSpec = {
  details: EventDetails;
  figureSrc: string;
};

/* ── text helpers ───────────────────────────────────────────────────────── */

type LineOpts = {
  x: number;
  /** Alphabetic baseline. */
  y: number;
  size: number;
  weight?: FontWeight;
  track?: number;
  anchor?: "start" | "middle" | "end";
  opacity?: number;
  fill?: string;
};

/**
 * Lay one line as baked glyph positions. Tracking is applied after every glyph
 * (matching SVG letter-spacing semantics, and matching what brand.measure
 * counts) so centring maths and measurement always agree.
 */
function line(text: string, opts: LineOpts): Op {
  const { x, y, size, weight = 500, track = 0, anchor = "middle", opacity = 1, fill = INK } = opts;
  const total = measure(text, { size, weight, track });
  let cursor = anchor === "middle" ? x - total / 2 : anchor === "end" ? x - total : x;
  const glyphs: Glyph[] = [];
  for (const ch of text) {
    glyphs.push({ ch, x: cursor });
    cursor += measure(ch, { size, weight }) + size * track;
  }
  return { kind: "glyphs", glyphs, y, size, weight, opacity, fill };
}

/** Largest size at which `text` fills `maxWidth` without exceeding it. */
function fitSize(
  text: string,
  maxWidth: number,
  opts: { weight?: FontWeight; track?: number } = {},
  { fill = 0.92, max = 400, min = 24 } = {},
): number {
  let size = max;
  while (size > min && measure(text, { size, ...opts }) > maxWidth * fill) size -= 2;
  return size;
}

/** The engine's one hard rule: refuse to lay out rather than overlap. */
class LayoutError extends Error {}
function assertFits(what: string, needed: number, budget: number): void {
  if (needed > budget) {
    throw new LayoutError(
      `${what} needs ${Math.round(needed)}px but only ${Math.round(budget)}px is free — ` +
        `shorten the text or drop a line; the layout will not overlap.`,
    );
  }
}

function need(deps: LayoutDeps, src: string): ImageInfo {
  const info = deps.sizes[src];
  if (!info || !info.w || !info.h) {
    throw new LayoutError(`missing image dimensions for "${src}" — prepare() must resolve it first`);
  }
  return info;
}

function run(build: () => DisplayList): LayoutResult {
  try {
    return { ok: true, list: build() };
  } catch (e) {
    if (e instanceof LayoutError) return { ok: false, error: e.message };
    throw e;
  }
}

const R = Math.round;

/* ── the event poster ───────────────────────────────────────────────────── */

/**
 * The kit's row model, verbatim in spirit: rows computed top-down and
 * bottom-up, every optional row collapsing when absent, and the hero given
 * every pixel left in the middle. Weights are the two shipped ones only —
 * lines the kit set at 600 sit at 500 here (the tracked small-caps voice).
 */
export function layoutEventPoster(spec: EventPosterSpec, deps: LayoutDeps): LayoutResult {
  return run(() => {
    const { w: W, h: H } = POSTER_SIZES[spec.size];
    const S = W / 2400;
    const pad = R(240 * S);
    const slogan = spec.slogan ?? SLOGAN;
    const showTriad = spec.showTriad ?? true;
    const d = spec.details ?? null;

    const ops: Op[] = [{ kind: "rect", x: 0, y: 0, w: W, h: H, fill: SAND }];

    // 1. Header — wordmark left, QR right (the two fixed anchors).
    const wm = need(deps, WORDMARK_SRC);
    const wmW = R(560 * S);
    const wmH = R(wmW * (wm.h / wm.w));
    const qrPx = R(300 * S);
    const headTop = pad;
    const headBottom = headTop + Math.max(wmH, qrPx + R(46 * S));
    ops.push({ kind: "image", src: WORDMARK_SRC, x: pad, y: headTop, w: wmW, h: wmH });
    ops.push({ kind: "image", src: qrSrc(spec.qrUrl), x: W - pad - qrPx, y: headTop, w: qrPx, h: qrPx });
    ops.push(
      line("SCAN FOR PASSES", {
        x: W - pad - qrPx / 2,
        y: headTop + qrPx + R(36 * S),
        size: R(24 * S),
        track: 0.24,
        opacity: 0.65,
      }),
    );

    // 2. Sizes that never flex — the air between rows does, these don't.
    const volText = d && (d.volume || d.theme) ? [d.volume, d.theme].filter(Boolean).join("  ·  ") : null;
    const sloganSize = fitSize(slogan, W - pad * 2, { weight: 700, track: 0.02 }, { max: R(300 * S) });
    const triadSize = R(46 * S);
    const dateSize = R(58 * S);

    // 3. Credits row pinned to the bottom margin.
    const od = need(deps, ODUBO_SRC);
    const sc = need(deps, SCOTTS_SRC);
    const odW = R(250 * S);
    const odH = R(odW * (od.h / od.w));
    const scW = R(330 * S);
    const scH = R(scW * (sc.h / sc.w));
    const creditRowH = Math.max(odH, scH);
    const creditBottom = H - pad;
    const creditTop = creditBottom - creditRowH;
    const creditLabelY = creditTop - R(28 * S);

    // 4. The air budget. Six inter-row gaps carry the poster's rhythm; their
    // design values were tuned on 8×11. On squatter formats (feed is 4:5) the
    // fixed rows don't leave the hero its minimum band — so instead of
    // refusing, every gap is shaved by ONE factor, computed exactly from the
    // deficit. Roomy formats get air = 1 and lay out identically to before.
    const GAP = { vol: 250, hero: 90, slogan: 200, triad: 96, details: 80, price: 150 } as const;
    const heroFloor = R(600 * S);
    const fixedDetailDrop =
      (d && (d.passes || d.price) ? R(64 * S) : 0) +
      (d?.venue ? R(72 * S) : 0) +
      (d && (d.date || d.doors) ? dateSize : 0);
    const airPx =
      (GAP.vol + GAP.hero + GAP.slogan + GAP.details + GAP.price + (showTriad ? GAP.triad : 0)) * S;
    const heroMaxAt = (air: number) =>
      creditLabelY -
      R(GAP.price * S * air) -
      fixedDetailDrop -
      R(GAP.details * S * air) -
      (R(GAP.slogan * S * air) + sloganSize + (showTriad ? R(GAP.triad * S * air) + triadSize : 0)) -
      (headBottom + R(GAP.vol * S * air) + R(GAP.hero * S * air));
    const deficit = heroFloor - heroMaxAt(1);
    // +6 overshoot: six gaps round independently, each can round against us.
    const air = deficit <= 0 ? 1 : Math.max(0.55, 1 - (deficit + 6) / airPx);
    const a = (px: number) => R(px * S * air);

    // 5. Volume · theme.
    const volY = headBottom + a(GAP.vol);
    if (volText) {
      ops.push(line(volText, { x: W / 2, y: volY, size: R(52 * S), track: 0.34, opacity: 0.85 }));
    }

    // 6. Detail lines, bottom-anchored above the credits — only present rows
    // take vertical space, so a spare poster (no details) gives it all to the
    // hero instead of leaving a hole.
    let cursorY = creditLabelY - a(GAP.price);
    const detailOps: Op[] = [];
    const priceText = d && (d.passes || d.price) ? [d.passes, d.price].filter(Boolean).join("  ·  ") : null;
    if (priceText) {
      detailOps.push(line(priceText, { x: W / 2, y: cursorY, size: R(38 * S), track: 0.2, opacity: 0.7 }));
      cursorY -= R(64 * S);
    }
    if (d?.venue) {
      detailOps.push(line(d.venue, { x: W / 2, y: cursorY, size: R(42 * S), track: 0.16, opacity: 0.85 }));
      cursorY -= R(72 * S);
    }
    const dateText = d && (d.date || d.doors) ? [d.date, d.doors].filter(Boolean).join("  ·  ") : null;
    if (dateText) {
      detailOps.push(line(dateText, { x: W / 2, y: cursorY, size: dateSize, weight: 700, track: 0.06 }));
      cursorY -= dateSize;
    }

    // 7. The hero — every pixel between the volume line and the type block.
    // The type block reserves the FULL slogan size (cap height + descender
    // headroom for custom lines), though the baseline below hangs off cap
    // height alone.
    const typeBlockH = a(GAP.slogan) + sloganSize + (showTriad ? a(GAP.triad) + triadSize : 0);
    const heroTop = volY + a(GAP.hero);
    const heroMaxH = cursorY - a(GAP.details) - typeBlockH - heroTop;
    const heroMaxW = W - R(110 * S) * 2;
    assertFits("the hero band", heroFloor, heroMaxH);

    let heroBottom = heroTop;
    if (spec.figureSrc) {
      const fig = need(deps, spec.figureSrc);
      const scale = Math.min(heroMaxH / fig.h, heroMaxW / fig.w);
      const fw = R(fig.w * scale);
      const fh = R(fig.h * scale);
      ops.push({
        kind: "image",
        src: spec.figureSrc,
        x: R(W / 2 - fw / 2),
        y: R(heroTop + (heroMaxH - fh) / 2),
        w: fw,
        h: fh,
      });
    }
    heroBottom = heroTop + heroMaxH;

    // 8. Slogan + triad, hung off the hero band. The baseline sits a full cap
    // height below the gap so the letterforms START at heroBottom + gap —
    // baseline-minus-nothing is how the slogan's caps once dug 10px into the
    // hero image.
    const sloganY = heroBottom + a(GAP.slogan) + Math.round(sloganSize * CAP_HEIGHT);
    assertFits("the slogan", measure(slogan, { size: sloganSize, weight: 700, track: 0.02 }), W - pad * 2);
    ops.push(line(slogan, { x: W / 2, y: sloganY, size: sloganSize, weight: 700, track: 0.02 }));
    if (showTriad) {
      ops.push(
        line(TRIAD, { x: W / 2, y: sloganY + a(GAP.triad) + triadSize, size: triadSize, track: 0.42, opacity: 0.75 }),
      );
    }

    ops.push(...detailOps);

    // 9. Credits.
    ops.push(line(CREDIT_PRESENTER, { x: W * 0.33, y: creditLabelY, size: R(24 * S), track: 0.3, opacity: 0.55 }));
    ops.push(line(CREDIT_PARTNER, { x: W * 0.67, y: creditLabelY, size: R(24 * S), track: 0.3, opacity: 0.55 }));
    ops.push({
      kind: "image",
      src: ODUBO_SRC,
      x: R(W * 0.33 - odW / 2),
      y: R(creditTop + (creditRowH - odH) / 2),
      w: odW,
      h: odH,
    });
    ops.push({
      kind: "image",
      src: SCOTTS_SRC,
      x: R(W * 0.67 - scW / 2),
      y: R(creditTop + (creditRowH - scH) / 2),
      w: scW,
      h: scH,
      opacity: 0.85,
    });

    return { w: W, h: H, ops };
  });
}

/* ── the ticket ─────────────────────────────────────────────────────────── */

export function layoutTicket(spec: TicketSpec, deps: LayoutDeps): LayoutResult {
  return run(() => {
    const { w: W, h: H } = TICKET_SIZE;
    const S = W / 2550;
    const pad = R(90 * S);
    const d = spec.details;

    const ops: Op[] = [{ kind: "rect", x: 0, y: 0, w: W, h: H, fill: SAND }];

    const stubX = R(W * 0.7);
    const mainInnerW = stubX - pad * 2;
    const mainCx = pad + mainInnerW / 2;

    // Row A — wordmark top-left, credit columns top-right of the main body.
    const labelSize = R(16 * S);
    const labelTrack = 0.2;
    const wm = need(deps, WORDMARK_SRC);
    const wmW = R(340 * S);
    const wmH = R(wmW * (wm.h / wm.w));
    const wmTop = pad;
    ops.push({ kind: "image", src: WORDMARK_SRC, x: pad, y: wmTop, w: wmW, h: wmH });

    const od = need(deps, ODUBO_SRC);
    const sc = need(deps, SCOTTS_SRC);
    const odW = R(140 * S);
    const odH = R(odW * (od.h / od.w));
    const scW = R(190 * S);
    const scH = R(scW * (sc.h / sc.w));
    const odColW = Math.max(odW, measure(CREDIT_PRESENTER, { size: labelSize, track: labelTrack }));
    const scColW = Math.max(scW, measure(CREDIT_PARTNER, { size: labelSize, track: labelTrack }));
    const creditGap = R(60 * S);
    const creditRowW = odColW + creditGap + scColW;
    const creditLeft = stubX - pad - creditRowW;
    const odCx = creditLeft + odColW / 2;
    const scCx = creditLeft + odColW + creditGap + scColW / 2;
    const creditLabelY = pad + R(22 * S);
    const creditTop = creditLabelY + R(18 * S);
    const creditRowH = Math.max(odH, scH);
    assertFits("the ticket credit block", creditRowW, mainInnerW - wmW - R(80 * S));
    ops.push(line(CREDIT_PRESENTER, { x: odCx, y: creditLabelY, size: labelSize, track: labelTrack, opacity: 0.55 }));
    ops.push(line(CREDIT_PARTNER, { x: scCx, y: creditLabelY, size: labelSize, track: labelTrack, opacity: 0.55 }));
    ops.push({ kind: "image", src: ODUBO_SRC, x: R(odCx - odW / 2), y: R(creditTop + (creditRowH - odH) / 2), w: odW, h: odH });
    ops.push({ kind: "image", src: SCOTTS_SRC, x: R(scCx - scW / 2), y: R(creditTop + (creditRowH - scH) / 2), w: scW, h: scH, opacity: 0.85 });

    const rowABottom = Math.max(wmTop + wmH, creditTop + creditRowH);

    // Slogan spanning the main body.
    const sloganSize = fitSize(SLOGAN, mainInnerW, { weight: 700, track: 0.02 }, { max: R(150 * S) });
    const sloganY = rowABottom + R(120 * S);
    const triadSize = R(30 * S);
    const triadY = sloganY + R(58 * S);
    ops.push(line(SLOGAN, { x: mainCx, y: sloganY, size: sloganSize, weight: 700, track: 0.02 }));
    ops.push(line(TRIAD, { x: mainCx, y: triadY, size: triadSize, track: 0.4, opacity: 0.75 }));

    // The crowd — everything left under the type, standing on the bottom edge.
    const heroTop = triadY + R(50 * S);
    const heroMaxH = H - heroTop;
    assertFits("the ticket hero band", R(300 * S), heroMaxH);
    const fig = need(deps, spec.figureSrc);
    const heroScale = Math.min(mainInnerW / fig.w, heroMaxH / fig.h);
    const heroW = R(fig.w * heroScale);
    const heroH = R(fig.h * heroScale);
    ops.push({ kind: "image", src: spec.figureSrc, x: R(mainCx - heroW / 2), y: H - heroH, w: heroW, h: heroH });

    // The stub.
    ops.push({
      kind: "rule",
      x1: stubX,
      y1: R(50 * S),
      x2: stubX,
      y2: H - R(50 * S),
      width: R(5 * S),
      opacity: 0.45,
      dash: [R(20 * S), R(24 * S)],
    });

    const stubInnerW = W - stubX - pad * 2;
    const sx = stubX + (W - stubX) / 2;
    const volText = [d.volume, d.theme].filter(Boolean).join(" · ");
    const dateText = (d.date ?? "").replace("SATURDAY ", "SAT ");
    const volSize = R(46 * S);
    const dateSize = R(38 * S);
    assertFits("the stub volume line", measure(volText, { size: volSize, weight: 700, track: 0.04 }), stubInnerW);
    assertFits("the stub date line", measure(dateText, { size: dateSize, weight: 700, track: 0.08 }), stubInnerW);
    if (d.venue) {
      assertFits("the stub venue line", measure(d.venue, { size: R(23 * S), track: 0.1 }), stubInnerW);
    }

    const volY = pad + volSize + R(40 * S);
    const dateY = volY + R(80 * S);
    const doorsY = dateY + R(58 * S);
    const venueY = doorsY + R(52 * S);
    const admitsY = venueY + R(105 * S);
    const qrPx = R(200 * S);
    const qrTop = admitsY + R(40 * S);
    const scanY = qrTop + qrPx + R(38 * S);
    assertFits("the ticket stub", scanY, H - pad);

    ops.push(line(volText, { x: sx, y: volY, size: volSize, weight: 700, track: 0.04 }));
    ops.push(line(dateText, { x: sx, y: dateY, size: dateSize, weight: 700, track: 0.08 }));
    if (d.doors) ops.push(line(d.doors, { x: sx, y: doorsY, size: R(29 * S), track: 0.12, opacity: 0.85 }));
    if (d.venue) ops.push(line(d.venue, { x: sx, y: venueY, size: R(23 * S), track: 0.1, opacity: 0.75 }));
    ops.push(line("ADMITS ONE", { x: sx, y: admitsY, size: R(44 * S), weight: 700, track: 0.08 }));
    ops.push({ kind: "image", src: qrSrc(spec.qrUrl), x: R(sx - qrPx / 2), y: qrTop, w: qrPx, h: qrPx });
    ops.push(line("SCAN FOR YOUR CODE", { x: sx, y: scanY, size: labelSize, track: 0.16, opacity: 0.6 }));

    return { w: W, h: H, ops };
  });
}

/* ── the pass card (store shelf face — square, no QR, no price) ─────────── */

export function layoutPassCard(spec: PassCardSpec, deps: LayoutDeps): LayoutResult {
  return run(() => {
    const { w: W, h: H } = PASS_CARD_SIZE;
    const S = W / 2000;
    const pad = R(150 * S);
    const d = spec.details;

    const ops: Op[] = [{ kind: "rect", x: 0, y: 0, w: W, h: H, fill: SAND }];

    const wm = need(deps, WORDMARK_SRC);
    const wmW = R(520 * S);
    const wmH = R(wmW * (wm.h / wm.w));
    const wmTop = pad;
    ops.push({ kind: "image", src: WORDMARK_SRC, x: R(W / 2 - wmW / 2), y: wmTop, w: wmW, h: wmH });

    const volText = [d.volume, d.theme].filter(Boolean).join(" · ");
    const volSize = R(46 * S);
    const volY = wmTop + wmH + R(96 * S);
    if (volText) {
      ops.push(line(volText, { x: W / 2, y: volY, size: volSize, track: 0.3, opacity: 0.85 }));
    }

    const admitsSize = R(78 * S);
    const venueSize = R(34 * S);
    const dateSize = R(44 * S);
    const admitsY = H - pad;
    const venueY = admitsY - R(96 * S);
    const dateY = venueY - R(62 * S);
    const innerW = W - pad * 2;
    const dateText = [
      (d.date ?? "").replace("SATURDAY ", "SAT "),
      d.doors,
    ]
      .filter(Boolean)
      .join(" · ");
    if (dateText) assertFits("the pass card date line", measure(dateText, { size: dateSize, weight: 700, track: 0.06 }), innerW);
    if (d.venue) assertFits("the pass card venue line", measure(d.venue, { size: venueSize, track: 0.12 }), innerW);
    assertFits("the pass card admits line", measure("ADMITS ONE", { size: admitsSize, weight: 700, track: 0.08 }), innerW);

    const heroTop = volY + R(70 * S);
    const heroMaxH = dateY - dateSize - R(90 * S) - heroTop;
    assertFits("the pass card hero band", R(420 * S), heroMaxH);
    const fig = need(deps, spec.figureSrc);
    const heroScale = Math.min(innerW / fig.w, heroMaxH / fig.h);
    const heroW = R(fig.w * heroScale);
    const heroH = R(fig.h * heroScale);
    ops.push({
      kind: "image",
      src: spec.figureSrc,
      x: R(W / 2 - heroW / 2),
      y: R(heroTop + (heroMaxH - heroH) / 2),
      w: heroW,
      h: heroH,
    });

    if (dateText) ops.push(line(dateText, { x: W / 2, y: dateY, size: dateSize, weight: 700, track: 0.06 }));
    if (d.venue) ops.push(line(d.venue, { x: W / 2, y: venueY, size: venueSize, track: 0.12, opacity: 0.8 }));
    ops.push(line("ADMITS ONE", { x: W / 2, y: admitsY, size: admitsSize, weight: 700, track: 0.08 }));

    return { w: W, h: H, ops };
  });
}

/* ── print-with-bleed, as a pure transform ──────────────────────────────── */

export const PRINT_BLEED = {
  /** ≈⅛in @300dpi, rounded up so the artwork lands on a whole pixel. */
  bleedPx: 38,
  /** ¼in of white for the crop marks. */
  marginPx: 75,
  label: "Print + bleed · ⅛in bleed, crop marks",
} as const;

/**
 * Wrap a laid-out piece for the print shop: white mark margin, the field
 * colour extended across the bleed, the artwork at trim, hairline crop marks
 * living ONLY in the margin (never on artwork), and a spec line for the shop.
 * Works for any piece because it's a display-list transform — the kit gains
 * bleed on the ticket and pass card for free.
 */
export function withBleed(list: DisplayList, specLine?: string): DisplayList {
  const { bleedPx: B, marginPx: M } = PRINT_BLEED;
  const off = B + M;
  const W = list.w + 2 * off;
  const H = list.h + 2 * off;

  const shifted: Op[] = list.ops.map((op) => {
    switch (op.kind) {
      case "rect":
        return { ...op, x: op.x + off, y: op.y + off };
      case "image":
        return { ...op, x: op.x + off, y: op.y + off };
      case "glyphs":
        return { ...op, y: op.y + off, glyphs: op.glyphs.map((g) => ({ ...g, x: g.x + off })) };
      case "arcGlyphs":
        return { ...op, glyphs: op.glyphs.map((g) => ({ ...g, x: g.x + off, y: g.y + off })) };
      case "rule":
        return { ...op, x1: op.x1 + off, y1: op.y1 + off, x2: op.x2 + off, y2: op.y2 + off };
    }
  });

  const ops: Op[] = [
    { kind: "rect", x: 0, y: 0, w: W, h: H, fill: "#ffffff" },
    // The field across trim + bleed. The first op of every piece is its field
    // rect, so extending it here is correct bleed for a flat-ground design.
    { kind: "rect", x: M, y: M, w: W - 2 * M, h: H - 2 * M, fill: SAND },
    ...shifted,
  ];

  // Crop marks: two hairlines per corner on the trim lines, margin-only.
  const trimL = off;
  const trimT = off;
  const trimR = W - off;
  const trimB = H - off;
  const len = 55;
  const gap = 8;
  const mark = (x1: number, y1: number, x2: number, y2: number): Op => ({
    kind: "rule",
    x1,
    y1,
    x2,
    y2,
    width: 3,
    opacity: 1,
  });
  for (const x of [trimL, trimR]) {
    ops.push(mark(x, Math.max(4, M - len), x, M - gap));
    ops.push(mark(x, H - M + gap, x, Math.min(H - 4, H - M + len)));
  }
  for (const y of [trimT, trimB]) {
    ops.push(mark(Math.max(4, M - len), y, M - gap, y));
    ops.push(mark(W - M + gap, y, Math.min(W - 4, W - M + len), y));
  }

  ops.push(
    line(specLine ?? `TRIM ${list.w}×${list.h}PX · BLEED ⅛ IN · 300 DPI`, {
      x: W / 2,
      y: H - M / 2 + 8,
      size: 26,
      track: 0.12,
      opacity: 0.55,
    }),
  );

  return { w: W, h: H, ops };
}

/* ── the arc (tournament family device) ─────────────────────────────────── */

/**
 * Lay text along the UPWARD arc — the same quadratic the app's ArcedTagline
 * draws (M20,120 Q160,20 300,120 in its 320-wide viewBox), scaled to the
 * requested width. This is the tournament family's device; the event family
 * never uses it (the arc asks; straight type states).
 */
export function arcLine(
  text: string,
  opts: {
    /** Centre of the arc's box. */
    cx: number;
    /** Baseline y of the arc's END points; the apex rises above. */
    y: number;
    width: number;
    size: number;
    weight?: FontWeight;
    opacity?: number;
    fill?: string;
  },
): Op {
  const { cx, y, width, size, weight = 700, opacity = 1, fill = INK } = opts;
  const scale = width / 320;
  // Control points from ArcedTagline's path, scaled and centred on cx.
  const p0 = { x: cx - 140 * scale, y };
  const p1 = { x: cx, y: y - 100 * scale };
  const p2 = { x: cx + 140 * scale, y };

  const point = (t: number) => {
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return {
      x: a * p0.x + b * p1.x + c * p2.x,
      y: a * p0.y + b * p1.y + c * p2.y,
    };
  };

  // Arc-length table for even spacing.
  const SAMPLES = 200;
  const lengths = [0];
  let prev = point(0);
  for (let i = 1; i <= SAMPLES; i++) {
    const cur = point(i / SAMPLES);
    lengths.push(lengths[i - 1] + Math.hypot(cur.x - prev.x, cur.y - prev.y));
    prev = cur;
  }
  const total = lengths[SAMPLES];
  const tAt = (dist: number) => {
    let lo = 0;
    let hi = SAMPLES;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] < dist) lo = mid + 1;
      else hi = mid;
    }
    return lo / SAMPLES;
  };

  // Shrink to fit the arc rather than pile up at its end.
  let fitted = size;
  let textLen = measure(text, { size: fitted, weight });
  if (textLen > total * 0.92) {
    fitted = Math.floor(size * ((total * 0.92) / textLen));
    textLen = measure(text, { size: fitted, weight });
  }

  const glyphs: ArcGlyph[] = [];
  let cursor = Math.max(0, (total - textLen) / 2);
  for (const ch of text) {
    const w = measure(ch, { size: fitted, weight });
    const t = tAt(cursor + w / 2);
    const at = point(t);
    const before = point(Math.max(0, t - 0.01));
    const after = point(Math.min(1, t + 0.01));
    glyphs.push({ ch, x: at.x, y: at.y, rot: Math.atan2(after.y - before.y, after.x - before.x) });
    cursor += w;
  }

  return { kind: "arcGlyphs", glyphs, size: fitted, weight, opacity, fill };
}

/* ── the tournament poster ──────────────────────────────────────────────── */

/** Cut `text` to fit `maxWidth`, with an ellipsis when it had to. */
function truncate(
  text: string,
  maxWidth: number,
  opts: { size: number; weight?: FontWeight; track?: number },
): string {
  if (measure(text, opts) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && measure(`${t}…`, opts) > maxWidth) t = t.slice(0, -1).trimEnd();
  return `${t}…`;
}

/**
 * One piece of album artwork inside a 1px-rule ink keyline — the only colour
 * allowed on the poster, always quoted, never duotoned. A track without
 * artwork ("" — the DB stores empty string, not null) gets a keylined sand
 * tile carrying its title, so a missing image can never render as a hole or a
 * broken glyph. `art: null` is an undecided slot and reads TBD.
 */
function artTile(
  art: TournamentArt | null,
  box: { x: number; y: number; w: number; h: number },
  k: number,
): Op[] {
  const ops: Op[] = [
    // The keyline is a slightly larger ink rect UNDER the tile — both
    // renderers already know rects and images; no stroke primitive needed.
    { kind: "rect", x: box.x - k, y: box.y - k, w: box.w + 2 * k, h: box.h + 2 * k, fill: INK },
  ];
  if (art?.src) {
    ops.push({ kind: "image", src: art.src, x: box.x, y: box.y, w: box.w, h: box.h });
    return ops;
  }
  ops.push({ kind: "rect", x: box.x, y: box.y, w: box.w, h: box.h, fill: SAND });
  const cx = box.x + box.w / 2;
  const inner = box.w * 0.82;
  if (art) {
    const titleSize = Math.max(14, R(box.w * 0.085));
    const artistSize = Math.max(12, R(box.w * 0.065));
    ops.push(
      line(truncate(art.title, inner, { size: titleSize, weight: 700, track: 0.04 }), {
        x: cx,
        y: box.y + box.h / 2 - titleSize * 0.25,
        size: titleSize,
        weight: 700,
        track: 0.04,
      }),
    );
    ops.push(
      line(truncate(art.artist, inner, { size: artistSize, track: 0.08 }), {
        x: cx,
        y: box.y + box.h / 2 + artistSize * 1.1,
        size: artistSize,
        track: 0.08,
        opacity: 0.7,
      }),
    );
  } else {
    const size = Math.max(14, R(box.w * 0.14));
    ops.push(
      line("TBD", { x: cx, y: box.y + box.h / 2 + size * 0.35, size, weight: 700, track: 0.2, opacity: 0.45 }),
    );
  }
  return ops;
}

export function layoutTournament(spec: TournamentPosterSpec, deps: LayoutDeps): LayoutResult {
  return run(() => {
    const { w: W, h: H } = POSTER_SIZES[spec.size];
    const S = W / 2400;
    const pad = R(240 * S);
    const innerW = W - pad * 2;
    const keyW = Math.max(2, R(4 * S));
    const arcText = spec.arcText ?? ANTHEM_PHRASE;

    const ops: Op[] = [{ kind: "rect", x: 0, y: 0, w: W, h: H, fill: SAND }];

    // Header — identical anchors to the event poster; the caption under the
    // QR carries the stage's CTA instead of SCAN FOR PASSES.
    const wm = need(deps, WORDMARK_SRC);
    const wmW = R(560 * S);
    const wmH = R(wmW * (wm.h / wm.w));
    const qrPx = R(300 * S);
    const headTop = pad;
    const headBottom = headTop + Math.max(wmH, qrPx + R(46 * S));
    ops.push({ kind: "image", src: WORDMARK_SRC, x: pad, y: headTop, w: wmW, h: wmH });
    ops.push({ kind: "image", src: qrSrc(spec.qrUrl), x: W - pad - qrPx, y: headTop, w: qrPx, h: qrPx });
    ops.push(
      line(spec.cta, {
        x: W - pad - qrPx / 2,
        y: headTop + qrPx + R(36 * S),
        size: R(24 * S),
        track: 0.24,
        opacity: 0.65,
      }),
    );

    // The arc — the anthem phrase asks its question where the event poster
    // states its volume line.
    const arcW = R(W * 0.44);
    const arcRise = (100 * arcW) / 320;
    const arcEndY = headBottom + R(120 * S) + R(arcRise);
    ops.push(arcLine(arcText, { cx: W / 2, y: arcEndY, width: arcW, size: R(58 * S), weight: 700 }));

    // Bottom-up: credits, sublines, headline — the band gets what remains.
    const od = need(deps, ODUBO_SRC);
    const sc = need(deps, SCOTTS_SRC);
    const odW = R(250 * S);
    const odH = R(odW * (od.h / od.w));
    const scW = R(330 * S);
    const scH = R(scW * (sc.h / sc.w));
    const creditRowH = Math.max(odH, scH);
    const creditTop = H - pad - creditRowH;
    const creditLabelY = creditTop - R(28 * S);

    const sublines = (spec.sublines ?? []).filter(Boolean).slice(0, 2);
    const subSize = R(40 * S);
    let cursorY = creditLabelY - R(130 * S);
    const textOps: Op[] = [];
    for (let i = sublines.length - 1; i >= 0; i--) {
      const text = truncate(sublines[i], innerW, { size: subSize, track: 0.14 });
      textOps.push(line(text, { x: W / 2, y: cursorY, size: subSize, track: 0.14, opacity: 0.75 }));
      cursorY -= R(64 * S);
    }
    const headSize = fitSize(spec.headline, innerW, { weight: 700, track: 0.02 }, { max: R(170 * S) });
    assertFits("the headline", measure(spec.headline, { size: headSize, weight: 700, track: 0.02 }), innerW);
    textOps.push(line(spec.headline, { x: W / 2, y: cursorY, size: headSize, weight: 700, track: 0.02 }));
    const headTopY = cursorY - Math.round(headSize * CAP_HEIGHT);
    ops.push(...textOps);

    // The band.
    const bandTop = arcEndY + R(110 * S);
    const bandBottom = headTopY - R(140 * S);
    const bandH = bandBottom - bandTop;
    const bandW = innerW;
    assertFits("the tournament band", R(420 * S), bandH);
    ops.push(...bandOps(spec.band, { x: pad, y: bandTop, w: bandW, h: bandH }, S, keyW, deps));

    // Credits — same row as every other piece.
    ops.push(line(CREDIT_PRESENTER, { x: W * 0.33, y: creditLabelY, size: R(24 * S), track: 0.3, opacity: 0.55 }));
    ops.push(line(CREDIT_PARTNER, { x: W * 0.67, y: creditLabelY, size: R(24 * S), track: 0.3, opacity: 0.55 }));
    ops.push({ kind: "image", src: ODUBO_SRC, x: R(W * 0.33 - odW / 2), y: R(creditTop + (creditRowH - odH) / 2), w: odW, h: odH });
    ops.push({ kind: "image", src: SCOTTS_SRC, x: R(W * 0.67 - scW / 2), y: R(creditTop + (creditRowH - scH) / 2), w: scW, h: scH, opacity: 0.85 });

    return { w: W, h: H, ops };
  });
}

/** Lay the stage band inside its box. Pure geometry; every tile keylined. */
function bandOps(
  band: TournamentBand,
  box: { x: number; y: number; w: number; h: number },
  S: number,
  keyW: number,
  deps: LayoutDeps,
): Op[] {
  const ops: Op[] = [];
  const cx = box.x + box.w / 2;

  switch (band.kind) {
    case "grid": {
      const art = band.art;
      if (art.length === 0) {
        // No nominations yet — the crowd holds the space, never a hole.
        const fig = need(deps, band.emptyFigureSrc);
        const scale = Math.min(box.h / fig.h, box.w / fig.w);
        const fw = R(fig.w * scale);
        const fh = R(fig.h * scale);
        ops.push({ kind: "image", src: band.emptyFigureSrc, x: R(cx - fw / 2), y: R(box.y + (box.h - fh) / 2), w: fw, h: fh });
        return ops;
      }
      const cols = Math.min(Math.ceil(Math.sqrt(art.length)), 5);
      const rows = Math.ceil(art.length / cols);
      const gap = R(36 * S);
      const capH = R(52 * S); // caption line + its air
      const tile = Math.floor(
        Math.min((box.w - gap * (cols - 1)) / cols, (box.h - gap * (rows - 1)) / rows - capH),
      );
      const gridH = rows * (tile + capH) + (rows - 1) * gap;
      const y0 = box.y + (box.h - gridH) / 2;
      art.forEach((a, i) => {
        const row = Math.floor(i / cols);
        const inRow = row === rows - 1 ? art.length - row * cols : cols;
        const rowW = inRow * tile + (inRow - 1) * gap;
        const col = i - row * cols;
        const x = R(cx - rowW / 2 + col * (tile + gap));
        const y = R(y0 + row * (tile + capH + gap));
        ops.push(...artTile(a, { x, y, w: tile, h: tile }, keyW));
        const capSize = R(20 * S);
        ops.push(
          line(truncate(a.title, tile, { size: capSize, track: 0.08 }), {
            x: x + tile / 2,
            y: y + tile + R(34 * S),
            size: capSize,
            track: 0.08,
            opacity: 0.7,
          }),
        );
      });
      return ops;
    }

    case "seeds": {
      const art = band.art.slice(0, 8);
      const cols = 4;
      const rows = Math.ceil(art.length / cols);
      const gap = R(44 * S);
      const capH = R(56 * S);
      const tile = Math.floor(
        Math.min((box.w - gap * (cols - 1)) / cols, (box.h - gap * (rows - 1)) / rows - capH),
      );
      const gridW = cols * tile + (cols - 1) * gap;
      const gridH = rows * (tile + capH) + (rows - 1) * gap;
      const x0 = cx - gridW / 2;
      const y0 = box.y + (box.h - gridH) / 2;
      art.forEach((a, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = R(x0 + col * (tile + gap));
        const y = R(y0 + row * (tile + capH + gap));
        ops.push(...artTile(a, { x, y, w: tile, h: tile }, keyW));
        const capSize = R(22 * S);
        ops.push(
          line(truncate(`${i + 1} · ${a.title}`, tile, { size: capSize, weight: 700, track: 0.06 }), {
            x: x + tile / 2,
            y: y + tile + R(38 * S),
            size: capSize,
            weight: 700,
            track: 0.06,
            opacity: 0.8,
          }),
        );
      });
      return ops;
    }

    case "pairs": {
      const pairs = band.pairs;
      const rows = Math.max(1, pairs.length);
      const gap = R(56 * S);
      const rowH = Math.floor((box.h - gap * (rows - 1)) / rows);
      const midW = R(300 * S);
      const capH = R(50 * S);
      const tile = Math.min(rowH - capH, Math.floor((box.w - midW - 2 * R(40 * S)) / 2));
      pairs.forEach((p, i) => {
        const rowTop = box.y + i * (rowH + gap);
        const tileY = R(rowTop + (rowH - capH - tile) / 2);
        const ax = R(cx - midW / 2 - R(40 * S) - tile);
        const bx = R(cx + midW / 2 + R(40 * S));
        ops.push(...artTile(p.a, { x: ax, y: tileY, w: tile, h: tile }, keyW));
        ops.push(...artTile(p.b, { x: bx, y: tileY, w: tile, h: tile }, keyW));
        const capSize = R(20 * S);
        if (p.a) {
          ops.push(
            line(truncate(p.a.title, tile, { size: capSize, track: 0.08 }), {
              x: ax + tile / 2, y: tileY + tile + R(34 * S), size: capSize, track: 0.08, opacity: 0.7,
            }),
          );
        }
        if (p.b) {
          ops.push(
            line(truncate(p.b.title, tile, { size: capSize, track: 0.08 }), {
              x: bx + tile / 2, y: tileY + tile + R(34 * S), size: capSize, track: 0.08, opacity: 0.7,
            }),
          );
        }
        // VS + the vote bar. 0–0 is a neutral hairline — never "0% / 0%".
        const midCy = tileY + tile / 2;
        const vsSize = R(44 * S);
        ops.push(line("VS", { x: cx, y: midCy - R(24 * S), size: vsSize, weight: 700, track: 0.12, opacity: 0.85 }));
        const barW = R(220 * S);
        const barH = Math.max(3, R(10 * S));
        const barY = R(midCy + R(28 * S));
        if (p.pctA == null) {
          ops.push({
            kind: "rule",
            x1: cx - barW / 2, y1: barY + barH / 2, x2: cx + barW / 2, y2: barY + barH / 2,
            width: Math.max(2, R(3 * S)), opacity: 0.3,
          });
        } else {
          const aW = R(barW * Math.min(1, Math.max(0, p.pctA)));
          ops.push({ kind: "rect", x: R(cx - barW / 2), y: barY, w: barW, h: barH, fill: INK });
          // The unfilled side reads as sand through a second, inset rect.
          if (barW - aW > 0) {
            ops.push({
              kind: "rect",
              x: R(cx - barW / 2) + aW, y: barY + Math.max(1, R(2 * S)),
              w: barW - aW, h: barH - 2 * Math.max(1, R(2 * S)),
              fill: SAND,
            });
          }
        }
      });
      return ops;
    }

    case "hero": {
      const side = Math.floor(Math.min(box.w * 0.72, box.h));
      ops.push(
        ...artTile(band.art, { x: R(cx - side / 2), y: R(box.y + (box.h - side) / 2), w: side, h: side }, keyW),
      );
      return ops;
    }
  }
}
