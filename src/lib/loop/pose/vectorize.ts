/**
 * "The Redraw" — the vector pipeline that makes Pose Studio output look DRAWN.
 *
 * The segmentation mask is traced into smooth closed paths (marching squares →
 * closed-loop RDP → Chaikin) and the figure is redrawn as: flat sand field →
 * one solid-ink silhouette (evenodd, holes included) → sand "cut" shapes for
 * the brightest interior regions (negative-space linocut cuts, traced the same
 * way so they carry the same hand). Pixel noise, blobby mask edges and
 * scratchy Sobel lines — the failure modes of the pixel filter on real phone
 * photos — never reach the canvas.
 *
 * Shared by the photo path (stylize.ts → stylizePoster) and the video engine
 * (video-engine.ts, per-frame). All tunables live in palette.VECTOR_DEFAULTS.
 */

import {
  boxBlurField,
  chaikinClosed,
  downsampleField,
  marchingSquares,
  simplifyClosed,
  type Loop,
} from "./geometry";
import { VECTOR_DEFAULTS, type RGB } from "./palette";

export type VectorizeOptions = Partial<typeof VECTOR_DEFAULTS>;

export type VectorScene = {
  /** Silhouette path in canvas coords (evenodd — holes are subpaths). */
  silhouette: Path2D | null;
  /** Interior cut shapes, drawn clipped to the silhouette. */
  cuts: { path: Path2D; color: RGB }[];
  /** Fraction of work-res mask pixels ≥ iso — drives fallback decisions. */
  coverage: number;
};

/** Per-session temporal state for the video path (tone threshold EMA). */
export type ToneState = { t1: number | null; t2: number | null };
export function createToneState(): ToneState {
  return { t1: null, t2: null };
}

type SilhouetteResult = {
  path: Path2D | null;
  coverage: number;
  /** The blurred work-res field + dims — reused by the tone lane. */
  field: Float32Array;
  fw: number;
  fh: number;
};

/**
 * Mask → one clean silhouette Path2D (canvas coords) + coverage.
 * `mw`/`mh` are the mask's own dimensions (any res); `cw`/`ch` the canvas.
 */
export function extractSilhouette(
  mask: Float32Array,
  mw: number,
  mh: number,
  cw: number,
  ch: number,
  opts: VectorizeOptions = {},
): SilhouetteResult {
  const o = { ...VECTOR_DEFAULTS, ...opts };

  const small = downsampleField(mask, mw, mh, o.maskWorkRes);
  const field = boxBlurField(small.data, small.width, small.height, o.maskBlurR);
  const fw = small.width;
  const fh = small.height;

  let above = 0;
  for (let i = 0; i < field.length; i++) if (field[i] >= o.maskIso) above++;
  const coverage = above / field.length;

  const frameArea = fw * fh;
  const eps = opts.simplifyEpsVideo !== undefined ? o.simplifyEpsVideo : o.simplifyEpsPhoto;

  const loops = marchingSquares(field, fw, fh, o.maskIso);

  // Outer-vs-hole via containment PARITY (even depth = outer, odd = hole) —
  // sign-agnostic, so border-touching loops with flipped winding can't break
  // classification. Path2D "evenodd" rendering doesn't care about direction
  // either; only the size thresholds differ between outers and holes.
  const candidates = loops.filter(
    (l) => Math.abs(l.area) >= frameArea * o.minHoleAreaFrac,
  );
  const depth = candidates.map((l, i) => {
    let d = 0;
    for (let j = 0; j < candidates.length; j++) {
      if (i !== j && pointInLoop(l.pts[0], l.pts[1], candidates[j].pts)) d++;
    }
    return d;
  });
  const outers = candidates
    .filter((l, i) => depth[i] % 2 === 0 && Math.abs(l.area) >= frameArea * o.minLoopAreaFrac)
    .sort((a, b) => Math.abs(b.area) - Math.abs(a.area))
    .slice(0, o.maxOuterLoops);
  const outerSet = new Set(outers);
  const holes = candidates.filter((l, i) => {
    if (depth[i] % 2 !== 1) return false;
    // Keep only holes that sit inside a KEPT outer.
    return candidates.some(
      (p) => outerSet.has(p) && pointInLoop(l.pts[0], l.pts[1], p.pts),
    );
  });
  if (outers.length === 0) return { path: null, coverage, field, fw, fh };

  const sx = cw / fw;
  const sy = ch / fh;
  const path = new Path2D();
  for (const loop of [...outers, ...holes]) {
    addLoop(path, smoothLoop(loop, eps, o.chaikinIters), sx, sy);
  }
  return { path, coverage, field, fw, fh };
}

/**
 * Interior tone-cuts: quantize smoothed in-mask luminance at quantile
 * thresholds and trace the bright regions as smooth sand shapes. Regions are
 * area integrals of the image — inherently robust to the pixel noise that made
 * Sobel lines scratchy.
 */
export function extractToneCuts(
  frame: CanvasImageSource,
  frameW: number,
  frameH: number,
  silhouette: SilhouetteResult,
  cw: number,
  ch: number,
  state: ToneState | null,
  opts: VectorizeOptions = {},
): { path: Path2D; color: RGB }[] {
  const o = { ...VECTOR_DEFAULTS, ...opts };
  const workRes =
    opts.toneWorkResVideo !== undefined ? o.toneWorkResVideo : o.toneWorkResPhoto;

  // Downsample the frame into a small offscreen canvas and read luminance.
  const scale = workRes / Math.max(frameW, frameH);
  const tw = Math.max(1, Math.round(frameW * scale));
  const th = Math.max(1, Math.round(frameH * scale));
  const off = getToneCanvas(tw, th);
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(frame, 0, 0, tw, th);
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, tw, th);
  } catch {
    return [];
  }

  const n = tw * th;
  const lum = new Float32Array(n);
  const d = img.data;
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    lum[p] = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  }
  const blurred = boxBlurField(lum, tw, th, o.toneBlurR);

  // Outside the silhouette → sentinel far below any iso, so isolines close
  // along the silhouette boundary on their own.
  const { field: mfield, fw: mfw, fh: mfh } = silhouette;
  let inMaskCount = 0;
  const hist = new Float32Array(64);
  for (let y = 0; y < th; y++) {
    const my = Math.min(mfh - 1, Math.round((y * mfh) / th));
    for (let x = 0; x < tw; x++) {
      const mx = Math.min(mfw - 1, Math.round((x * mfw) / tw));
      const p = y * tw + x;
      if (mfield[my * mfw + mx] < o.maskIso) {
        blurred[p] = -1;
      } else {
        inMaskCount++;
        const bin = Math.min(63, Math.max(0, Math.floor(blurred[p] * 64)));
        hist[bin]++;
      }
    }
  }
  if (inMaskCount < 32) return [];

  // Quantile thresholds from the in-mask histogram (adaptive to exposure).
  const q = (frac: number): number => {
    const target = inMaskCount * frac;
    let acc = 0;
    for (let b = 0; b < 64; b++) {
      acc += hist[b];
      if (acc >= target) return (b + 0.5) / 64;
    }
    return 1;
  };
  let t1 = q(o.toneQuantile1);
  let t2 = q(o.toneQuantile2);
  if (state) {
    // EMA the thresholds so video cuts don't breathe with auto-exposure.
    state.t1 = state.t1 === null ? t1 : state.t1 + (t1 - state.t1) * o.toneThreshEma;
    state.t2 = state.t2 === null ? t2 : state.t2 + (t2 - state.t2) * o.toneThreshEma;
    t1 = state.t1;
    t2 = state.t2;
  }

  const levels: { iso: number; color: RGB }[] =
    opts.toneWorkResVideo !== undefined
      ? [{ iso: t1, color: o.cut1 }] // video: single level
      : [
          { iso: t1, color: o.cut1 },
          { iso: t2, color: o.cut2 },
        ];

  const silhouetteArea = inMaskCount;
  const sx = cw / tw;
  const sy = ch / th;
  const eps =
    opts.toneWorkResVideo !== undefined
      ? VECTOR_DEFAULTS.simplifyEpsVideo
      : 1.3;

  const out: { path: Path2D; color: RGB }[] = [];
  for (const level of levels) {
    const loops = marchingSquares(blurred, tw, th, level.iso)
      .filter((l) => Math.abs(l.area) >= silhouetteArea * o.minCutAreaFrac)
      .sort((a, b) => Math.abs(b.area) - Math.abs(a.area))
      .slice(0, o.maxCutLoops);
    if (loops.length === 0) continue;
    const path = new Path2D();
    for (const loop of loops) {
      addLoop(path, smoothLoop(loop, eps, o.chaikinIters), sx, sy);
    }
    out.push({ path, color: level.color });
  }
  return out;
}

/**
 * The face, traced on its own terms. A body-wide histogram buries facial
 * structure — brow, nose, cheek, lip all sit within a couple of percent of
 * each other while a lit shoulder owns the top of the range — so the head
 * region gets its own quantiles and a finer grid. This is what makes the
 * engraving read as a person in ordinary venue light instead of only under
 * perfect lighting.
 */
export function extractFaceCuts(
  frame: CanvasImageSource,
  frameW: number,
  frameH: number,
  silhouette: SilhouetteResult,
  cw: number,
  ch: number,
  opts: VectorizeOptions = {},
): { path: Path2D; color: RGB }[] {
  const o = { ...VECTOR_DEFAULTS, ...opts };
  const isVideo = opts.toneWorkResVideo !== undefined;
  const workRes = isVideo ? o.faceWorkResVideo : o.faceWorkResPhoto;

  // Head band: the top slice of the silhouette's own bounding box, not of the
  // frame — a figure low in frame still gets its face found.
  const { field: mfield, fw: mfw, fh: mfh } = silhouette;
  let top = mfh;
  let bottom = -1;
  let left = mfw;
  let right = -1;
  for (let y = 0; y < mfh; y++) {
    for (let x = 0; x < mfw; x++) {
      if (mfield[y * mfw + x] >= o.maskIso) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < top) return [];
  const bandBottom = top + (bottom - top) * o.faceRegionFrac;

  const scale = workRes / Math.max(frameW, frameH);
  const tw = Math.max(1, Math.round(frameW * scale));
  const th = Math.max(1, Math.round(frameH * scale));
  const off = getFaceCanvas(tw, th);
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(frame, 0, 0, tw, th);
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, tw, th);
  } catch {
    return [];
  }

  const n = tw * th;
  const lum = new Float32Array(n);
  const d = img.data;
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    lum[p] = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  }
  // Blur radius 1 only: heavier smoothing erases the very detail we're after.
  const blurred = boxBlurField(lum, tw, th, 1);

  // Mask to the head band; everything else is sentinel.
  let count = 0;
  const hist = new Float32Array(64);
  for (let y = 0; y < th; y++) {
    const my = Math.min(mfh - 1, Math.round((y * mfh) / th));
    const inBand = my >= top && my <= bandBottom;
    for (let x = 0; x < tw; x++) {
      const mx = Math.min(mfw - 1, Math.round((x * mfw) / tw));
      const p = y * tw + x;
      if (!inBand || mfield[my * mfw + mx] < o.maskIso) {
        blurred[p] = -1;
      } else {
        count++;
        hist[Math.min(63, Math.max(0, Math.floor(blurred[p] * 64)))]++;
      }
    }
  }
  if (count < 64) return [];

  const q = (frac: number): number => {
    const target = count * frac;
    let acc = 0;
    for (let b = 0; b < 64; b++) {
      acc += hist[b];
      if (acc >= target) return (b + 0.5) / 64;
    }
    return 1;
  };

  const levels: { iso: number; color: RGB }[] = isVideo
    ? [{ iso: q(o.faceQuantile1), color: o.cut1 }]
    : [
        { iso: q(o.faceQuantile1), color: o.cut1 },
        { iso: q(o.faceQuantile2), color: o.cut2 },
      ];

  const sx = cw / tw;
  const sy = ch / th;
  const out: { path: Path2D; color: RGB }[] = [];
  for (const level of levels) {
    const loops = marchingSquares(blurred, tw, th, level.iso)
      .filter((l) => Math.abs(l.area) >= count * o.minFaceCutAreaFrac)
      .sort((a, b) => Math.abs(b.area) - Math.abs(a.area))
      .slice(0, o.maxFaceCutLoops);
    if (loops.length === 0) continue;
    const path = new Path2D();
    for (const loop of loops) {
      addLoop(path, smoothLoop(loop, o.faceSimplifyEps, o.chaikinIters), sx, sy);
    }
    out.push({ path, color: level.color });
  }
  return out;
}

/** Full scene for one frame (photo: both tone levels; video passes video opts). */
export function buildScene(
  frame: CanvasImageSource,
  frameW: number,
  frameH: number,
  mask: Float32Array,
  mw: number,
  mh: number,
  cw: number,
  ch: number,
  state: ToneState | null,
  opts: VectorizeOptions = {},
): VectorScene {
  const sil = extractSilhouette(mask, mw, mh, cw, ch, opts);
  if (!sil.path) return { silhouette: null, cuts: [], coverage: sil.coverage };
  const cuts = extractToneCuts(frame, frameW, frameH, sil, cw, ch, state, opts);
  // Face last so its finer cuts draw over the broad body ones.
  const face = extractFaceCuts(frame, frameW, frameH, sil, cw, ch, opts);
  return { silhouette: sil.path, cuts: [...cuts, ...face], coverage: sil.coverage };
}

/** Draw a scene: sand field → ink silhouette → clipped cuts. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: VectorScene,
  cw: number,
  ch: number,
  opts: { mirror?: boolean; background?: RGB } = {},
): void {
  const o = VECTOR_DEFAULTS;
  const bg = opts.background ?? o.background;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (opts.mirror) ctx.setTransform(-1, 0, 0, 1, cw, 0);

  ctx.fillStyle = css(bg);
  ctx.fillRect(0, 0, cw, ch);

  if (scene.silhouette) {
    ctx.fillStyle = css(o.ink);
    ctx.fill(scene.silhouette, "evenodd");

    if (scene.cuts.length > 0) {
      ctx.save();
      ctx.clip(scene.silhouette, "evenodd");
      for (const cut of scene.cuts) {
        ctx.fillStyle = css(cut.color);
        ctx.fill(cut.path, "evenodd");
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

/* ────────────────────────────── internals ────────────────────────────── */

/** Ray-crossing point-in-polygon (closed loop, [x0,y0,x1,y1,…]). */
function pointInLoop(px: number, py: number, pts: Float32Array): boolean {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1];
    const xj = pts[j * 2], yj = pts[j * 2 + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function smoothLoop(loop: Loop, eps: number, chaikinIters: number): Float32Array {
  return chaikinClosed(simplifyClosed(loop.pts, eps), chaikinIters);
}

function addLoop(path: Path2D, pts: Float32Array, sx: number, sy: number): void {
  const n = pts.length / 2;
  if (n < 3) return;
  path.moveTo(pts[0] * sx, pts[1] * sy);
  for (let i = 1; i < n; i++) {
    path.lineTo(pts[i * 2] * sx, pts[i * 2 + 1] * sy);
  }
  path.closePath();
}

function css(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Reused offscreen canvas for tone downsampling (readback-friendly). */
let toneCanvas: HTMLCanvasElement | null = null;
function getToneCanvas(w: number, h: number): HTMLCanvasElement {
  if (!toneCanvas) toneCanvas = document.createElement("canvas");
  if (toneCanvas.width !== w) toneCanvas.width = w;
  if (toneCanvas.height !== h) toneCanvas.height = h;
  return toneCanvas;
}

/** Separate canvas for the face pass — it runs at a different resolution, and
 *  sharing one would thrash the size on every frame. */
let faceCanvas: HTMLCanvasElement | null = null;
function getFaceCanvas(w: number, h: number): HTMLCanvasElement {
  if (!faceCanvas) faceCanvas = document.createElement("canvas");
  if (faceCanvas.width !== w) faceCanvas.width = w;
  if (faceCanvas.height !== h) faceCanvas.height = h;
  return faceCanvas;
}
