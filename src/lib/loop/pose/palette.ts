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

export const INK: RGB = [42, 15, 10]; // #2a0f0a
export const INK_SOFT: RGB = [61, 26, 18]; // #3d1a12
export const SAND_DEEP: RGB = [156, 95, 60]; // #9c5f3c
export const SAND: RGB = [217, 170, 122]; // #d9aa7a
export const SAND_BRIGHT: RGB = [240, 211, 173]; // #f0d3ad

/** Subject tone ramp for the ENGRAVED look: the figure holds near-solid ink
 *  deep into the mids (a woodcut block, not a shaded portrait) and only true
 *  highlights lift toward the paper — the sand line-work supplies the interior
 *  detail, matching the poster figures (see the DJ reference). */
export const RAMP: { at: number; color: RGB }[] = [
  { at: 0.0, color: INK },
  { at: 0.5, color: INK },
  { at: 0.75, color: INK_SOFT },
  { at: 0.92, color: SAND_DEEP },
  { at: 1.0, color: SAND },
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

/** The canonical Loop Soul look — "the engraving" (v2, tuned against the DJ
 *  poster reference): near-solid ink figure, strong paper-colour line-work
 *  tracing folds and features, flat sand field, no rim glow. These ARE the
 *  signature effect; keep them here so photo == video. */
export const DEFAULTS = {
  /** 0 → fully shaded; 1 → near-flat silhouette. */
  silhouetteStrength: 0.9,
  /** Contour line-art (Sobel edges) strength. 0 → off. */
  edgeStrength: 0.9,
  /** Colour of the contour lines — the FIELD colour, so lines read as paper
   *  cut through the ink (woodcut), not as a glow. */
  edgeColor: SAND as RGB,
  /** Rim-light strength around the silhouette. The reference figures sit flat
   *  on the field with no glow — off. */
  rimStrength: 0,
  /** Tone bands (posterize). 0/1 → smooth. */
  posterize: 3,
  /** Edge-preserving pre-smooth radius (px) before edge detection. 0 → off.
   *  Kept tight — heavier smoothing mushes the cuts the engraving relies on. */
  preSmooth: 1,
  /** Dilate the contour lines by this radius (px) for ink-weight. 0 → hairline. */
  edgeWeight: 1,
  /** Background fill (the sand field). */
  background: SAND as RGB,
  /** Sobel magnitude → line intensity mapping (shared by BOTH engines):
   *  line = clamp((mag/2 - edgeThreshold) / edgeRange). Lower threshold picks
   *  up finer fold lines; smaller range makes lines commit faster — the
   *  engraving wants decisive cuts, not gradients. */
  edgeThreshold: 0.04,
  edgeRange: 0.2,
  /** Subject-mask hardening (smoothstep lo→hi on confidence, shared by BOTH
   *  engines): turns the feathered segmentation edge into the clean poster cut
   *  of the reference. Narrower window = harder cut. */
  maskLo: 0.35,
  maskHi: 0.65,
} as const;

/** Shared confidence-hardening curve (smoothstep between DEFAULTS.maskLo/Hi). */
export function hardenMask(conf: number): number {
  const t = clamp01((conf - DEFAULTS.maskLo) / (DEFAULTS.maskHi - DEFAULTS.maskLo));
  return t * t * (3 - 2 * t);
}

/**
 * "The Redraw" — vector pipeline parameters (see vectorize.ts). The mask is
 * TRACED into smooth closed paths and the figure is redrawn, instead of
 * colourizing pixels — this is what makes the output read as clean poster art
 * on real phone photos. One block, both engines.
 */
export const VECTOR_DEFAULTS = {
  /** Working resolution (long side) for mask tracing. */
  maskWorkRes: 256,
  /** Blur radius (work px) before iso-tracing — seals pinholes, shaves spurs.
   *  Kept at 1: r=2 rounds off shape character (cap brims, jawlines). */
  maskBlurR: 1,
  /** Iso value of the silhouette cut. */
  maskIso: 0.5,
  /** Outer loops smaller than this fraction of frame area are noise blobs. */
  minLoopAreaFrac: 0.01,
  /** Holes smaller than this fraction of frame area are mask pinholes. */
  minHoleAreaFrac: 0.003,
  /** Safety cap on kept outer loops (multiple people still fit). */
  maxOuterLoops: 4,
  /** RDP epsilon (work px). Video's larger value doubles as anti-jitter snap. */
  simplifyEpsPhoto: 1.4,
  simplifyEpsVideo: 2.0,
  /** Chaikin corner-cut iterations. */
  chaikinIters: 2,
  /** Tone-cut working resolution (long side). */
  toneWorkResPhoto: 192,
  toneWorkResVideo: 144,
  /** In-mask luminance quantiles for the cut levels. Kept tight — cuts are
   *  sparse accents (folds, highlights); the figure stays predominantly ink. */
  toneQuantile1: 0.86,
  toneQuantile2: 0.95,
  /**
   * FACE NUANCE. One global threshold across a whole body throws the face
   * away: clothing highlights dominate the histogram, while brow, nose, cheek
   * and lip structure lives in a narrow band a few percent wide and never
   * reaches the cut. So the head gets its OWN quantiles, computed from the
   * head region alone, traced on a finer grid. Without this the style only
   * reads when the lighting is excellent.
   */
  faceQuantile1: 0.62,
  faceQuantile2: 0.88,
  /** Top fraction of the silhouette treated as the head region. */
  faceRegionFrac: 0.3,
  /** Face cuts are far smaller than body cuts, so they need their own floor. */
  minFaceCutAreaFrac: 0.0012,
  maxFaceCutLoops: 20,
  /** The face is traced at a finer working resolution than the body. */
  faceWorkResPhoto: 320,
  faceWorkResVideo: 208,
  /** Gentler simplification inside the face — features are small. */
  faceSimplifyEps: 0.9,
  /** Luminance blur radius (work px) before tone tracing. */
  toneBlurR: 2,
  /** Cut loops smaller than this fraction of the silhouette area are noise. */
  minCutAreaFrac: 0.005,
  maxCutLoops: 12,
  /** Video: recompute tone-cuts every Nth frame (paths reused between). */
  toneEveryN: 2,
  /** EMA weight on the tone threshold (video) — stops exposure "breathing". */
  toneThreshEma: 0.2,
  /** Colours (the engraving idiom: paper cut through ink). */
  ink: INK as RGB,
  cut1: SAND as RGB,
  cut2: SAND_BRIGHT as RGB,
  background: SAND as RGB,
  /** Mask coverage sanity window — outside it the frame is "bad" (fallback). */
  coverageMin: 0.015,
  coverageMax: 0.85,
  /** Video fallback hysteresis (frames). */
  fallbackBadFrames: 15,
  fallbackGoodFrames: 10,
} as const;

/** silhouetteStrength → tone-curve gamma (shared so both paths darken alike). */
export function gammaFor(silhouetteStrength: number): number {
  return 1 + clamp01(silhouetteStrength) * 1.5;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
