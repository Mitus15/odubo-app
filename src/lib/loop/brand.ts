import { FONT_METRICS } from "./poster/font-metrics";

/**
 * Loop Soul brand constants — the single source both poster renderers read.
 *
 * Deliberately import-light (only the generated metrics table) so the Node
 * poster kit can pull it in through a relative path under tsx without touching
 * any app code. If a value here disagrees with
 * docs/decisions/loop-soul-brand-language.md, the doc wins — fix this file.
 *
 * Before this module existed, the sand/ink hexes were re-declared in ~8 files
 * and the two poster systems disagreed on the slogan's case, the QR's quiet
 * zone, the credit labels, and the typeface. Every one of those was a way for
 * the artwork to drift.
 */

/* ── palette ────────────────────────────────────────────────────────────── */

export const SAND = "#d9aa7a";
export const INK = "#2a0f0a";
export const SAND_BRIGHT = "#f0d3ad";

/* ── the words ──────────────────────────────────────────────────────────── */

/** Mixed case on purpose — the one line in the system that is not caps. */
export const SLOGAN = "Come Dance";

/**
 * The Soul Loop Anthem's phrase — the question the tournament answers. Never
 * "cleaned up" to "What are you dancing to?", never given a question mark, and
 * never promoted back to slogan. Arc it; never arc the slogan.
 */
export const ANTHEM_PHRASE = "What we dancin' to";

export const TRIAD = "MUSIC · MODE · MOVEMENT";

export const CREDIT_PRESENTER = "PRESENTED BY";
export const CREDIT_PARTNER = "IN PARTNERSHIP WITH";

/* ── type ───────────────────────────────────────────────────────────────── */

/**
 * The artwork face. Jost — a free, open-licence Futura interpretation,
 * committed to the repo (public/loop/fonts) so print and app render
 * byte-identically. Two weights only, 500 and 700: the shipped statics are
 * instanced from the variable font at exactly these, and restricting the
 * system to weights that exist as files is what guarantees the two runtimes
 * can't resolve the same line differently.
 */
export const FONT_FAMILY = "Jost";
export type FontWeight = 500 | 700;

/** Cap-height as a fraction of the em — for converting a cap budget to a font size. */
export const CAP_HEIGHT = FONT_METRICS.capHeight;

type AdvanceTable = Record<string, number>;
const maxAdvance: Record<number, number> = {};

function table(weight: FontWeight): AdvanceTable {
  return FONT_METRICS.weights[String(weight) as keyof typeof FONT_METRICS.weights];
}

function widest(weight: FontWeight): number {
  if (!maxAdvance[weight]) {
    maxAdvance[weight] = Math.max(...Object.values(table(weight)));
  }
  return maxAdvance[weight];
}

/**
 * Measure a line, deterministically, in either runtime.
 *
 * Sums per-character advances from the committed table (fractions of an em ×
 * size) plus tracking. Characters the table doesn't know fall back to the
 * widest known advance — a safe over-estimate, preserving the layout's
 * refuse-to-overlap conservatism. No kerning: Jost is geometric and the
 * layout's 8% fill margin absorbs what little there is.
 */
export function measure(
  text: string,
  opts: { size: number; weight?: FontWeight; track?: number },
): number {
  const { size, weight = 500, track = 0 } = opts;
  const adv = table(weight);
  const fallback = widest(weight);
  let em = 0;
  for (const ch of text) em += adv[ch] ?? fallback;
  // Tracking is per-gap in rendering, but per-char here matches how both
  // renderers emit it (letter-spacing applies after every glyph incl. the
  // last in SVG) — consistent with each other is what matters.
  return em * size + text.length * (size * track);
}

/* ── QR ─────────────────────────────────────────────────────────────────── */

/** One quiet zone everywhere — the two systems used to disagree (1 vs 2). */
export const QR_OPTS = {
  margin: 1,
  errorCorrectionLevel: "M" as const,
  color: { dark: INK, light: SAND },
};
