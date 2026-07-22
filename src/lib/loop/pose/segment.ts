/**
 * On-device subject segmentation — MediaPipe Selfie Segmenter via
 * @mediapipe/tasks-vision. The model + WASM are SELF-HOSTED under /public/models
 * (copied from the npm package at build), so this runs entirely in the browser:
 * nothing leaves the device, no API key, no per-image cost, works offline.
 *
 * `segmentSubject` returns a per-pixel foreground confidence mask (0..1, length
 * = width*height) aligned to the input canvas, or `null` if the model can't be
 * loaded / fails — in which case the caller (stylize) degrades to a full-frame
 * duotone, so the feature never produces a broken image.
 */

import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

const WASM_PATH = "/loop/models/wasm";
const MODEL_PATH = "/loop/models/selfie_segmenter.tflite";

let segmenter: ImageSegmenter | null = null;
let initPromise: Promise<ImageSegmenter | null> | null = null;

/** Lazily create the segmenter once; resolves null (not throws) on failure. */
function ensureSegmenter(): Promise<ImageSegmenter | null> {
  if (segmenter) return Promise.resolve(segmenter);
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      segmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      return segmenter;
    } catch (err) {
      console.warn("[pose] segmenter init failed — using duotone fallback", err);
      return null;
    }
  })();
  return initPromise;
}

/** Warm the model up front (e.g. while the camera starts) so capture is snappy. */
export function preloadSegmenter(): void {
  void ensureSegmenter();
}

/**
 * Segment the subject in `source`. Returns a Float32 foreground-confidence mask
 * (0..1) of length width*height, or null if segmentation is unavailable.
 */
export async function segmentSubject(
  source: HTMLCanvasElement,
): Promise<Float32Array | null> {
  const seg = await ensureSegmenter();
  if (!seg) return null;
  try {
    const result = seg.segment(source);
    const masks = result.confidenceMasks;
    if (!masks || masks.length === 0) {
      result.close();
      return null;
    }
    // Selfie segmenter → single foreground-confidence mask; if a model returns
    // [background, foreground], the last entry is the foreground.
    const fg = masks[masks.length - 1];
    const view = fg.getAsFloat32Array();
    const out = new Float32Array(view.length);
    out.set(view); // copy before closing the underlying mask
    result.close();
    return out;
  } catch (err) {
    console.warn("[pose] segmentation failed — using duotone fallback", err);
    return null;
  }
}

/* ─────────────────────────── VIDEO mode (live filter) ─────────────────────── */

// A SEPARATE segmenter instance: running mode is fixed per instance, so the
// live-video path can't reuse the IMAGE one above.
let videoSeg: ImageSegmenter | null = null;
let videoInit: Promise<ImageSegmenter | null> | null = null;

function ensureVideoSegmenter(): Promise<ImageSegmenter | null> {
  if (videoSeg) return Promise.resolve(videoSeg);
  if (videoInit) return videoInit;
  videoInit = (async () => {
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      videoSeg = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: "VIDEO",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      return videoSeg;
    } catch (err) {
      console.warn("[pose] video segmenter init failed — filter runs maskless", err);
      return null;
    }
  })();
  return videoInit;
}

export function preloadVideoSegmenter(): void {
  void ensureVideoSegmenter();
}

// Temporal smoothing (EMA) state — a running average of the mask kills the
// per-frame edge flicker that makes cheap segmentation look bad on video.
let emaPrev: Float32Array | null = null;

/** Call when a new session/source starts so the EMA doesn't blend across cuts. */
export function resetVideoMask(): void {
  emaPrev = null;
}

export type VideoMask = { data: Float32Array; width: number; height: number };

/**
 * Segment one video frame (VIDEO running mode needs monotonically increasing
 * `tsMs`). Returns an EMA-smoothed foreground mask, or null if unavailable
 * (caller then renders maskless). `smoothing` is the new-frame weight (0..1):
 * lower = steadier but more motion-lag; ~0.6 is a good dance-floor balance.
 */
export async function segmentVideoFrame(
  video: HTMLVideoElement,
  tsMs: number,
  smoothing = 0.6,
): Promise<VideoMask | null> {
  const seg = await ensureVideoSegmenter();
  if (!seg) return null;
  try {
    const result = seg.segmentForVideo(video, tsMs);
    const masks = result.confidenceMasks;
    if (!masks || masks.length === 0) {
      result.close();
      return null;
    }
    const fg = masks[masks.length - 1];
    const view = fg.getAsFloat32Array();
    const width = fg.width;
    const height = fg.height;
    if (!emaPrev || emaPrev.length !== view.length) {
      emaPrev = new Float32Array(view.length);
      emaPrev.set(view);
    } else {
      const a = smoothing < 0 ? 0 : smoothing > 1 ? 1 : smoothing;
      for (let i = 0; i < view.length; i++) emaPrev[i] = emaPrev[i] * (1 - a) + view[i] * a;
    }
    const out = new Float32Array(emaPrev); // copy so the renderer owns stable data
    result.close();
    return { data: out, width, height };
  } catch (err) {
    console.warn("[pose] video segmentation failed — maskless frame", err);
    return null;
  }
}
