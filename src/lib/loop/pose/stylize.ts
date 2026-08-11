/**
 * The Loop Soul duotone engine (pure Canvas, no dependencies).
 *
 * Turns a photo into the Loop Soul poster grade entirely on-device:
 *   1. Subject pixels are mapped through a brand gradient LUT (ink → ink-soft →
 *      deep-clay → sand → bright) biased dark, so the figure reads as a
 *      SILHOUETTE while keeping highlight/shadow detail.
 *   2. A Sobel edge pass draws thin sand CONTOUR LINES over the body
 *      (folds, features, fabric) — the illustrated "line-art" that makes the
 *      reference figures read as posters, not filters.
 *   3. A RIM LIGHT traces the silhouette boundary in bright sand, lifting the
 *      subject off the flat sand field.
 *   4. Background pixels become a flat sand field; edges feather via the
 *      mask's confidence so the cutout isn't hard.
 *
 * This is an APPROXIMATION of the generative reference look in public/figures/
 * (which was illustrated by Gemini and invents detail a filter can't). It's the
 * free, instant, fully-on-device baseline; the generative provider
 * (src/lib/pose/generative.ts) is the exact-match upgrade.
 *
 * The look (palette, ramp/LUT, canonical default params) lives in `palette.ts`
 * so the WebGL video path (`gl-stylize.ts`) reproduces it IDENTICALLY.
 */

import { type RGB, SAND_BRIGHT, LUT, DEFAULTS, VECTOR_DEFAULTS, gammaFor, clamp01, hardenMask } from "./palette";
import { boxBlurField } from "./geometry";
import { buildScene, renderScene } from "./vectorize";

/**
 * "The Redraw" — the primary photo path. Traces the segmentation mask into
 * smooth vector paths and redraws the figure as clean poster art (see
 * vectorize.ts). Falls back to the pixel duotone `stylize()` below when
 * there's no usable mask (segmentation unavailable, empty frame, or the
 * segmenter ate the whole frame).
 */
export function stylizePoster(
  frame: HTMLCanvasElement,
  mask: Float32Array | Uint8Array | null,
): void {
  const { width, height } = frame;
  const n = width * height;
  const useMask = !!mask && mask.length === n;
  if (!useMask) {
    stylize(frame, mask);
    return;
  }

  // Normalise Uint8 masks to 0..1 floats for the tracer.
  let floatMask: Float32Array;
  if (mask instanceof Uint8Array) {
    floatMask = new Float32Array(n);
    for (let i = 0; i < n; i++) floatMask[i] = mask[i] / 255;
  } else {
    floatMask = mask as Float32Array;
  }

  const ctx = frame.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  // The scene must be built from the ORIGINAL pixels, so snapshot the frame
  // before drawing over it.
  const src = document.createElement("canvas");
  src.width = width;
  src.height = height;
  src.getContext("2d")?.drawImage(frame, 0, 0);

  const scene = buildScene(src, width, height, floatMask, width, height, width, height, null);
  if (
    !scene.silhouette ||
    scene.coverage < VECTOR_DEFAULTS.coverageMin ||
    scene.coverage > VECTOR_DEFAULTS.coverageMax
  ) {
    stylize(frame, mask);
    return;
  }
  renderScene(ctx, scene, width, height);
}

export type StylizeOptions = {
  /** 0 → fully shaded; 1 → near-flat silhouette. Default 0.85 (darker silhouette
   *  reads more like a poster; tuned against the reference figures). */
  silhouetteStrength?: number;
  /** Background fill (the sand field). Default sand. */
  background?: RGB;
  /** Sand contour line-art strength (Sobel edges on the subject). 0 → off.
   *  Default 0.3 — enough to describe folds/patterns without turning faces busy. */
  edgeStrength?: number;
  /** Colour of the contour lines. Default sand-bright. */
  edgeColor?: RGB;
  /** Rim-light strength around the silhouette. 0 → off. Default 0.5. */
  rimStrength?: number;
  /** Tone bands for the subject (posterize). 0/1 → smooth. Default 5. */
  posterize?: number;
  /** Edge-preserving pre-smooth radius (px) applied to luminance BEFORE edge
   *  detection, so lines trace shapes not skin/sensor noise. 0 → off. Default 1. */
  preSmooth?: number;
  /** Dilate the contour lines by this radius (px) for deliberate graphic
   *  ink-weight. 0 → hairline. Default 1. */
  edgeWeight?: number;
};

/**
 * Stylize `frame` in place. `mask` is per-pixel subject confidence (0..1,
 * length = width*height). If `mask` is null/mismatched, falls back to a
 * full-frame duotone (no background replacement, no rim) so output is never
 * broken.
 */
export function stylize(
  frame: HTMLCanvasElement,
  mask: Float32Array | Uint8Array | null,
  opts: StylizeOptions = {},
): void {
  const ctx = frame.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  const { width, height } = frame;
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  const n = width * height;

  const strength = clamp01(opts.silhouetteStrength ?? DEFAULTS.silhouetteStrength);
  const gamma = gammaFor(strength); // higher strength → darker subject
  const bg = opts.background ?? DEFAULTS.background;
  const edgeStrength = clamp01(opts.edgeStrength ?? DEFAULTS.edgeStrength);
  const edgeColor = opts.edgeColor ?? DEFAULTS.edgeColor;
  const rimStrength = clamp01(opts.rimStrength ?? DEFAULTS.rimStrength);
  const bands = opts.posterize ?? DEFAULTS.posterize;
  const preSmooth = Math.max(0, Math.round(opts.preSmooth ?? DEFAULTS.preSmooth));
  const edgeWeight = Math.max(0, Math.round(opts.edgeWeight ?? DEFAULTS.edgeWeight));

  const useMask = !!mask && mask.length === n;
  // Mask values may be 0..1 (confidence) or 0..255 (uint). Normalise on read.
  const maxMask = useMask && mask instanceof Uint8Array ? 255 : 1;

  // Precompute per-pixel luminance (0..1) and normalised mask (0..1) fields.
  const lum = new Float32Array(n);
  const conf = new Float32Array(n);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    lum[p] = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    // Harden the segmentation feather into the reference's clean poster cut.
    conf[p] = useMask ? hardenMask((mask as ArrayLike<number>)[p] / maxMask) : 1;
  }

  // Contour line field: detect edges on a PRE-SMOOTHED luminance (so lines trace
  // shapes, not skin/sensor noise), threshold to a 0..1 line intensity, then
  // dilate for graphic ink-weight. Tone-mapping still uses the un-smoothed lum.
  let lineField: Float32Array | null = null;
  if (edgeStrength > 0) {
    const edgeSrc = preSmooth > 0 ? boxBlur(lum, width, height, preSmooth) : lum;
    const lumEdge = sobelMag(edgeSrc, width, height);
    lineField = new Float32Array(n);
    for (let p = 0; p < n; p++) {
      lineField[p] = clamp01((lumEdge[p] / 2 - DEFAULTS.edgeThreshold) / DEFAULTS.edgeRange);
    }
    if (edgeWeight > 0) lineField = dilateField(lineField, width, height, edgeWeight);
  }
  // Mask edges → rim light.
  const maskEdge = useMask && rimStrength > 0 ? sobelMag(conf, width, height) : null;

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    // 1. Duotone the subject through the brand ramp (posterized, dark-biased).
    let tone = Math.pow(lum[p], gamma);
    if (bands > 1) tone = Math.round(tone * (bands - 1)) / (bands - 1);
    const idx = Math.round(tone * 255) * 3;
    let sr = LUT[idx];
    let sg = LUT[idx + 1];
    let sb = LUT[idx + 2];

    // 2. Contour line-art: paint sand where the subject's edges are.
    if (lineField) {
      const line = lineField[p] * edgeStrength * conf[p];
      sr += (edgeColor[0] - sr) * line;
      sg += (edgeColor[1] - sg) * line;
      sb += (edgeColor[2] - sb) * line;
    }

    // 3. Rim light: brighten the silhouette boundary (peaks where the mask flips).
    if (maskEdge) {
      const rim = conf[p] > 0.12 ? clamp01(maskEdge[p] / 2) * rimStrength : 0;
      sr += (SAND_BRIGHT[0] - sr) * rim;
      sg += (SAND_BRIGHT[1] - sg) * rim;
      sb += (SAND_BRIGHT[2] - sb) * rim;
    }

    // 4. Composite subject over the sand field by confidence (feathered edges).
    const m = conf[p];
    d[i] = bg[0] + (sr - bg[0]) * m;
    d[i + 1] = bg[1] + (sg - bg[1]) * m;
    d[i + 2] = bg[2] + (sb - bg[2]) * m;
    d[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

// Box blur now lives in geometry.ts (shared with the vector pipeline).
const boxBlur = boxBlurField;

/** Separable grayscale dilation (local max) — thickens the contour lines. */
function dilateField(field: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return field;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) { const v = field[y * w + xx]; if (v > m) m = v; }
      }
      tmp[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) { const v = tmp[yy * w + x]; if (v > m) m = v; }
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

/** Sobel gradient magnitude of a single-channel field (borders → 0). */
function sobelMag(field: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = field[i - w - 1];
      const tc = field[i - w];
      const tr = field[i - w + 1];
      const ml = field[i - 1];
      const mr = field[i + 1];
      const bl = field[i + w - 1];
      const bc = field[i + w];
      const br = field[i + w + 1];
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

/** Stamp the Loop Soul mark bottom-right (loads the brand SVG; same-origin). */
export async function stampWatermark(frame: HTMLCanvasElement): Promise<void> {
  const ctx = frame.getContext("2d");
  if (!ctx) return;
  const mark = await loadImage("/loop/branding/loop-soul.svg").catch(() => null);
  const pad = Math.round(frame.width * 0.04);
  if (mark) {
    const w = Math.round(frame.width * 0.22);
    const h = (mark.height / mark.width) * w || w * 0.5;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(mark, frame.width - w - pad, frame.height - h - pad, w, h);
    ctx.globalAlpha = 1;
  } else {
    // Fallback: wordmark text in ink.
    ctx.fillStyle = "#2a0f0a";
    ctx.font = `700 ${Math.round(frame.width * 0.045)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("loop soul", frame.width - pad, frame.height - pad);
  }
}

/** Canvas → JPEG Blob (matches odubo's upload format). */
export function toJpegBlob(frame: HTMLCanvasElement, quality = 0.92): Blob {
  const dataUrl = frame.toDataURL("image/jpeg", quality);
  const parts = dataUrl.split(",");
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: "image/jpeg" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
