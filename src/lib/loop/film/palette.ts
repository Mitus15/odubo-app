/**
 * The film's colourways: one flat field colour per song, and the tones the
 * figure, its shadow and the badge take on it.
 *
 * The cover is the reference. On sand, the figure is INK with SAND_DEEP and
 * SAND_BRIGHT cuts (scripts/loop/video-convert.mjs:50-55). Every other field
 * keeps the SAME relationships: the mid and highlight tones are the cover's
 * distances from sand, measured in OKLCH (a perceptual space) and applied to
 * the new field. So sand reproduces the cover exactly, and a blue field gets a
 * blue with the same depth and the same light, rather than a guess.
 *
 * INK stays INK on every field: the figure is always the same person. The
 * badge is always SAND_BRIGHT, the one bright thing on him, like the white
 * iPod in the 2004 ads.
 *
 * One implementation. The Python pipeline never re-derives these: `film:pull`
 * writes each chapter's resolved palette into story.json.
 */

export type RGB = readonly [number, number, number];

export const INK: RGB = [42, 15, 10];
export const SAND: RGB = [217, 170, 122];
export const SAND_DEEP: RGB = [156, 95, 60];
export const SAND_BRIGHT: RGB = [240, 211, 173];

type Lab = { L: number; a: number; b: number };
export type Lch = { L: number; C: number; h: number };

const toLinear = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255;

function rgbToOklab([r8, g8, b8]: RGB): Lab {
  const r = toLinear(r8), g = toLinear(g8), b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** Linear-light RGB, unclamped, so a caller can test the gamut. */
function oklabToLinear({ L, a, b }: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function toLch(rgb: RGB): Lch {
  const { L, a, b } = rgbToOklab(rgb);
  const C = Math.hypot(a, b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, h };
}

const inGamut = (lin: number[]) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH to sRGB, pulling chroma in (never lightness or hue) until it fits. */
export function fromLch({ L, C, h }: Lch): RGB {
  const rad = (h * Math.PI) / 180;
  let c = Math.max(0, C);
  let lin = oklabToLinear({ L, a: c * Math.cos(rad), b: c * Math.sin(rad) });
  for (let i = 0; i < 40 && !inGamut(lin); i++) {
    c *= 0.93;
    lin = oklabToLinear({ L, a: c * Math.cos(rad), b: c * Math.sin(rad) });
  }
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, fromLinear(Math.min(1, Math.max(0, v))))));
  return [clamp(lin[0]), clamp(lin[1]), clamp(lin[2])];
}

const SAND_LCH = toLch(SAND);
const DEEP_LCH = toLch(SAND_DEEP);
const BRIGHT_LCH = toLch(SAND_BRIGHT);

/** Apply the cover's distance from sand (to deep, or to bright) to a field. */
function relative(field: Lch, target: Lch): Lch {
  return {
    L: field.L + (target.L - SAND_LCH.L),
    C: SAND_LCH.C > 1e-6 ? field.C * (target.C / SAND_LCH.C) : field.C,
    h: (field.h + (target.h - SAND_LCH.h) + 360) % 360,
  };
}

export type Palette = {
  field: RGB;
  /** The figure's body. Constant: he is always the same person. */
  ink: RGB;
  /** The first highlight cut, the cover's SAND_DEEP on sand. */
  mid: RGB;
  /** The brightest cut, the cover's SAND_BRIGHT on sand. */
  highlight: RGB;
  /** His shadow on the ground: the field, a step darker. */
  shadow: RGB;
  /** The badge on his heart. Constant, like the white iPod. */
  badge: RGB;
};

/** How far below the field his ground shadow sits, in OKLab lightness. */
const SHADOW_DROP = 0.1;

export function palette(field: RGB): Palette {
  const f = toLch(field);
  return {
    field,
    ink: INK,
    mid: fromLch(relative(f, DEEP_LCH)),
    highlight: fromLch(relative(f, BRIGHT_LCH)),
    shadow: fromLch({ L: f.L - SHADOW_DROP, C: f.C * 1.05, h: f.h }),
    badge: SAND_BRIGHT,
  };
}

/**
 * The default colourway per chapter: sand's lightness, a little more chroma
 * than sand for the pop-art repeat, and the hue walked once around the wheel
 * across the album, starting from sand. Chapter 1 (Welcome, the dust he is
 * formed from) is sand itself. The owner changes any of them in admin.
 */
export const DEFAULT_CHROMA = 0.11;

export function defaultField(index: number, count = 14): RGB {
  if (index === 0) return SAND;
  const h = (SAND_LCH.h + (index * 360) / count) % 360;
  return fromLch({ L: SAND_LCH.L, C: DEFAULT_CHROMA, h });
}

/**
 * A sibling of a field colour: the same lightness and chroma, the hue turned
 * by `degrees`. The downbeat flip alternates a chapter with its sibling, so the
 * colour moves with the music without leaving the chapter's family.
 */
export const SIBLING_DEGREES = 28;

export function sibling(field: RGB, degrees = SIBLING_DEGREES): RGB {
  const f = toLch(field);
  return fromLch({ ...f, h: (f.h + degrees + 360) % 360 });
}

export function hex(rgb: RGB): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function parseHex(value: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG contrast ratio: the ink figure must read on every field. */
export function contrast(a: RGB, b: RGB): number {
  const lum = (c: RGB) => 0.2126 * toLinear(c[0]) + 0.7152 * toLinear(c[1]) + 0.0722 * toLinear(c[2]);
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
