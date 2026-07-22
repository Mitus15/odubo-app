/**
 * The Loop Soul look — single source of truth.
 *
 * BOTH renderers derive from this file so a photo (Canvas, `stylize.ts`) and a
 * video frame (WebGL, `gl-stylize.ts`) reproduce the effect IDENTICALLY — that
 * consistency is the whole point of extracting it. Change the look here once.
 *
 * Colours are the exact globals.css @theme tokens.
 */

export type RGB = [number, number, number];

export const INK: RGB = [5, 5, 5]; // #050505
export const INK_SOFT: RGB = [18, 18, 18]; // #121212
export const ELECTRIC_DEEP: RGB = [0, 168, 84]; // #00a854
export const ELECTRIC: RGB = [0, 225, 112]; // #00e170
export const ELECTRIC_BRIGHT: RGB = [43, 255, 143]; // #2bff8f

/** Subject tone ramp: stays dark through the mids (silhouette), greens up only
 *  in the highlights — matching the dark-green-shifted hero figures. */
export const RAMP: { at: number; color: RGB }[] = [
  { at: 0.0, color: INK },
  { at: 0.35, color: INK_SOFT },
  { at: 0.65, color: ELECTRIC_DEEP },
  { at: 0.88, color: ELECTRIC },
  { at: 1.0, color: ELECTRIC_BRIGHT },
];

/** Build a 256-entry RGB LUT from the ramp (row of an RGB texture / Canvas LUT). */
export function buildLUT(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = RAMP[0];
    let b = RAMP[RAMP.length - 1];
    for (let s = 0; s < RAMP.length - 1; s++) {
      if (t >= RAMP[s].at && t <= RAMP[s + 1].at) {
        a = RAMP[s];
        b = RAMP[s + 1];
        break;
      }
    }
    const span = b.at - a.at || 1;
    const f = (t - a.at) / span;
    lut[i * 3] = a.color[0] + (b.color[0] - a.color[0]) * f;
    lut[i * 3 + 1] = a.color[1] + (b.color[1] - a.color[1]) * f;
    lut[i * 3 + 2] = a.color[2] + (b.color[2] - a.color[2]) * f;
  }
  return lut;
}

/** Precomputed LUT (built once at module load) — shared by the Canvas path. */
export const LUT: Uint8ClampedArray = buildLUT();

/** The canonical "B3" Loop Soul look — the tuned defaults both renderers use.
 *  These ARE the signature effect; keep them here so photo == video. */
export const DEFAULTS = {
  /** 0 → fully shaded; 1 → near-flat silhouette. */
  silhouetteStrength: 0.85,
  /** Contour line-art (Sobel edges) strength. 0 → off. */
  edgeStrength: 0.3,
  /** Colour of the contour lines. */
  edgeColor: ELECTRIC_BRIGHT as RGB,
  /** Rim-light strength around the silhouette. 0 → off. */
  rimStrength: 0.5,
  /** Tone bands (posterize). 0/1 → smooth. */
  posterize: 5,
  /** Edge-preserving pre-smooth radius (px) before edge detection. 0 → off. */
  preSmooth: 1,
  /** Dilate the contour lines by this radius (px) for ink-weight. 0 → hairline. */
  edgeWeight: 1,
  /** Background fill (the green field). */
  background: ELECTRIC as RGB,
} as const;

/** silhouetteStrength → tone-curve gamma (shared so both paths darken alike). */
export function gammaFor(silhouetteStrength: number): number {
  return 1 + clamp01(silhouetteStrength) * 1.5;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
