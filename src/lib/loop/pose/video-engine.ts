/**
 * Pose Studio video engine — drives the real-time Loop Soul effect.
 *
 * Per animation frame: source (camera OR uploaded file) → MediaPipe VIDEO
 * segmentation (EMA-smoothed) → "The Redraw" vector pipeline (vectorize.ts):
 * trace the mask into smooth paths and redraw the figure on a 2D canvas —
 * silhouette every frame, interior tone-cuts every Nth. Recording captures the
 * same canvas via MediaRecorder. All on-device.
 *
 * The visible canvas is ALWAYS 2D (a canvas can hold only one context type).
 * When segmentation is unavailable or persistently bad, a lazily-created
 * offscreen WebGL duotone (gl-stylize.ts) renders instead and is drawImage'd
 * over — with hysteresis so the modes never flap mid-take.
 */

import { startCamera, stopStream, waitForVideoReady, type CameraFacing } from "@/lib/loop/capture/camera";
import { GLStylizer, type GLParams } from "./gl-stylize";
import { segmentVideoFrame, resetVideoMask, preloadVideoSegmenter, type VideoMask } from "./segment";
import { VECTOR_DEFAULTS } from "./palette";
import {
  createToneState,
  extractFaceCuts,
  extractSilhouette,
  extractToneCuts,
  renderScene,
  type ToneState,
  type VectorScene,
} from "./vectorize";

export type EngineSource =
  | { kind: "camera"; facing: CameraFacing }
  | { kind: "file"; file: File };

export type EngineParams = GLParams & {
  /** EMA new-frame weight (0..1). Lower = steadier, more motion-lag. */
  smoothing?: number;
  /** Cap the render height (px) for performance. Default 720. */
  maxHeight?: number;
  /** Segment every Nth frame (reuse the mask between). Default 1. */
  segEveryN?: number;
};

/** Video-path options for the vector pipeline (presence of the keys selects
 *  the video epsilon / work-res inside vectorize.ts). */
const VIDEO_OPTS = {
  simplifyEpsVideo: VECTOR_DEFAULTS.simplifyEpsVideo,
  toneWorkResVideo: VECTOR_DEFAULTS.toneWorkResVideo,
} as const;

/** Preferred recording mime types, best-first; picks the first supported. */
const REC_TYPES = [
  "video/mp4;codecs=h264",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickRecordType(): string | null {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null;
  return REC_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export class PoseVideoEngine {
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private objectUrl: string | null = null;
  private raf = 0;
  private running = false;
  private mirror = false;
  private params: EngineParams = {};
  private lastMask: VideoMask | null = null;
  private frameNo = 0;

  // Vector-scene state
  private scene: VectorScene = { silhouette: null, cuts: [], coverage: 0 };
  private silhouetteFor: VideoMask | null = null; // mask identity the scene was traced from
  private toneState: ToneState = createToneState();

  // Maskless fallback (offscreen WebGL duotone) with hysteresis
  private gl: GLStylizer | null = null;
  private glCanvas: HTMLCanvasElement | null = null;
  private glMode = false;
  private badFrames = 0;
  private goodFrames = 0;

  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recType = "";

  /** Fired once when a file source reaches its end (used by upload processing). */
  onEnded: (() => void) | null = null;

  constructor(
    private video: HTMLVideoElement,
    private canvas: HTMLCanvasElement,
  ) {}

  async start(source: EngineSource, params: EngineParams = {}): Promise<void> {
    this.params = params;
    resetVideoMask();
    this.lastMask = null;
    this.silhouetteFor = null;
    this.scene = { silhouette: null, cuts: [], coverage: 0 };
    this.toneState = createToneState();
    this.frameNo = 0;
    this.glMode = false;
    this.badFrames = 0;
    this.goodFrames = 0;
    preloadVideoSegmenter();

    if (source.kind === "camera") {
      this.stream = await startCamera(this.video, source.facing);
      this.mirror = source.facing === "user";
      this.video.loop = true;
    } else {
      this.stream = null;
      this.mirror = false;
      this.objectUrl = URL.createObjectURL(source.file);
      this.video.srcObject = null;
      this.video.src = this.objectUrl;
      this.video.loop = false;
      this.video.muted = true;
      await waitForVideoReady(this.video);
      await this.video.play();
    }

    this.sizeCanvas(params.maxHeight ?? 720);
    if (!this.ctx) {
      this.ctx = this.canvas.getContext("2d");
      if (!this.ctx) throw new Error("Canvas 2D context unavailable.");
    }

    this.video.onended = () => this.onEnded?.();
    this.running = true;
    this.loop();
  }

  private sizeCanvas(maxHeight: number): void {
    const vw = this.video.videoWidth || 720;
    const vh = this.video.videoHeight || 960;
    const scale = vh > maxHeight ? maxHeight / vh : 1;
    this.canvas.width = Math.round(vw * scale);
    this.canvas.height = Math.round(vh * scale);
  }

  setParams(params: EngineParams): void {
    this.params = { ...this.params, ...params };
  }

  private loop = async (): Promise<void> => {
    if (!this.running) return;
    const v = this.video;
    if (this.ctx && v.readyState >= 2 && v.videoWidth > 0) {
      const n = this.params.segEveryN ?? 1;
      if (this.frameNo % n === 0) {
        this.lastMask = await segmentVideoFrame(v, performance.now(), this.params.smoothing ?? 0.6);
      }
      try {
        this.renderFrame();
      } catch {
        /* transient (e.g. video not decodable this tick) — skip frame */
      }
      this.frameNo++;
    }
    this.raf = requestAnimationFrame(() => void this.loop());
  };

  private renderFrame(): void {
    const ctx = this.ctx!;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const mask = this.lastMask;
    const D = VECTOR_DEFAULTS;

    // Re-trace the silhouette only when a NEW mask arrived (segmentVideoFrame
    // returns a fresh object per segmentation; between segEveryN frames the
    // identity is unchanged and the traced scene is reused).
    let sil: ReturnType<typeof extractSilhouette> | null = null;
    if (mask && mask !== this.silhouetteFor) {
      sil = extractSilhouette(mask.data, mask.width, mask.height, cw, ch, VIDEO_OPTS);
      const bad =
        !sil.path || sil.coverage < D.coverageMin || sil.coverage > D.coverageMax;
      if (bad) {
        this.badFrames++;
        this.goodFrames = 0;
        if (this.badFrames >= D.fallbackBadFrames) this.glMode = true;
        // Keep showing the last good scene during a short bad streak.
      } else {
        this.goodFrames++;
        this.badFrames = 0;
        if (this.glMode && this.goodFrames >= D.fallbackGoodFrames) this.glMode = false;
        this.scene = { silhouette: sil.path, cuts: this.scene.cuts, coverage: sil.coverage };
        // Interior cuts every Nth frame (they're the expensive lane).
        if (this.frameNo % D.toneEveryN === 0) {
          const body = extractToneCuts(
            this.video,
            this.video.videoWidth,
            this.video.videoHeight,
            sil,
            cw,
            ch,
            this.toneState,
            VIDEO_OPTS,
          );
          // Faces carry the performance — they get the same treatment live as
          // in stills, drawn over the broad body cuts.
          const face = extractFaceCuts(
            this.video,
            this.video.videoWidth,
            this.video.videoHeight,
            sil,
            cw,
            ch,
            VIDEO_OPTS,
          );
          this.scene.cuts = [...body, ...face];
        }
      }
      this.silhouetteFor = mask;
    }
    if (!mask) {
      this.badFrames++;
      if (this.badFrames >= D.fallbackBadFrames) this.glMode = true;
    }

    if (this.glMode || !this.scene.silhouette) {
      this.renderGlFallback(cw, ch);
      return;
    }
    renderScene(ctx, this.scene, cw, ch, { mirror: this.mirror });
  }

  /** Maskless duotone via offscreen WebGL (per-pixel CPU would not hold 30fps). */
  private renderGlFallback(cw: number, ch: number): void {
    if (!this.glCanvas) this.glCanvas = document.createElement("canvas");
    if (this.glCanvas.width !== cw) this.glCanvas.width = cw;
    if (this.glCanvas.height !== ch) this.glCanvas.height = ch;
    try {
      if (!this.gl) this.gl = new GLStylizer(this.glCanvas);
      this.gl.render(this.video, null, this.params, this.mirror);
      this.ctx!.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx!.drawImage(this.glCanvas, 0, 0, cw, ch);
    } catch {
      // WebGL unavailable too — flat field beats a black frame.
      const bg = VECTOR_DEFAULTS.background;
      this.ctx!.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
      this.ctx!.fillRect(0, 0, cw, ch);
    }
  }

  /* ── recording ── */

  canRecord(): boolean {
    return pickRecordType() !== null;
  }

  startRecording(fps = 30): boolean {
    const type = pickRecordType();
    if (!type || this.recorder) return false;
    const stream = this.canvas.captureStream(fps);
    this.chunks = [];
    this.recType = type;
    this.recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 });
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start(100);
    return true;
  }

  stopRecording(): Promise<Blob | null> {
    const rec = this.recorder;
    if (!rec) return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = this.chunks.length ? new Blob(this.chunks, { type: this.recType }) : null;
        this.chunks = [];
        this.recorder = null;
        resolve(blob);
      };
      rec.stop();
    });
  }

  isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    try { this.recorder?.stop(); } catch { /* noop */ }
    this.recorder = null;
    stopStream(this.stream, this.video);
    this.stream = null;
    this.video.onended = null;
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
  }

  dispose(): void {
    this.stop();
    this.gl?.dispose();
    this.gl = null;
    this.glCanvas = null;
  }
}
