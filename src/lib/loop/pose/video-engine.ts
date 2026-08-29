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

import {
  startCamera,
  stopStream,
  waitForVideoReady,
  type CameraFacing,
  type GrantedSettings,
} from "@/lib/loop/capture/camera";
import { Take, canRecord as recorderAvailable, pickRecordType } from "./recorder";
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
  /** Long edge to REQUEST from the camera. Without it the browser hands back
   *  its default (640x480), which `maxHeight` can only ever cap, never raise. */
  captureLongEdge?: number;
  captureFps?: number;
  /** Ask for a mic track, muxed into the recording. */
  audio?: boolean;
  /** Encoder bitrate for a take from this engine. */
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  /** Segment every Nth frame (reuse the mask between). Default 1. */
  segEveryN?: number;
  /**
   * Apply the Loop Soul look. Default true.
   *
   * When false the engine becomes a passthrough: it draws the camera straight
   * to the canvas and skips segmentation entirely. Going through the canvas
   * rather than recording the raw MediaStream keeps the mirror transform, the
   * height cap and the whole recorder path identical between the two, so
   * preview and output match by construction instead of by coincidence — and
   * it is *cheaper* than the filtered path, not more expensive.
   */
  filter?: boolean;
};

/** Video-path options for the vector pipeline (presence of the keys selects
 *  the video epsilon / work-res inside vectorize.ts). */
const VIDEO_OPTS = {
  simplifyEpsVideo: VECTOR_DEFAULTS.simplifyEpsVideo,
  toneWorkResVideo: VECTOR_DEFAULTS.toneWorkResVideo,
} as const;

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

  private take: Take | null = null;

  /** What the camera actually granted — null for a file source. Read by the
   *  studio readout, which is the only way to know a constraint took. */
  granted: GrantedSettings | null = null;
  /** Set when audio was asked for and not delivered. */
  audioNote: string | null = null;

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
      const started = await startCamera(this.video, {
        facing: source.facing,
        targetLongEdge: params.captureLongEdge,
        targetFps: params.captureFps,
        audio: params.audio,
      });
      this.stream = started.stream;
      this.granted = started.granted;
      this.audioNote = started.audioNote;
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
      // Passthrough: no mask needed, so the per-frame segmentation and the
      // vector trace are both skipped rather than computed and discarded.
      if (this.params.filter === false) {
        try {
          this.drawPassthrough();
        } catch {
          /* transient — skip frame */
        }
        this.frameNo++;
        this.raf = requestAnimationFrame(() => void this.loop());
        return;
      }

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

  /**
   * The unfiltered path: the camera, drawn to the canvas as-is.
   *
   * Deliberately the same canvas the filtered path paints and the recorder taps
   * (`captureStream` in startRecording), so "what you see is what you record"
   * holds for both looks without a second code path for preview or capture.
   * `object-cover` semantics are preserved by cropping to the canvas aspect
   * rather than letterboxing, matching how the filtered scene fills the frame.
   */
  private drawPassthrough(): void {
    const ctx = this.ctx!;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return;

    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.save();
    if (this.mirror) {
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.video, dx, dy, dw, dh);
    ctx.restore();
  }

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
    return recorderAvailable();
  }

  /** The mime the recorder would choose right now — shown in the studio
   *  readout before a frame is recorded. */
  plannedRecordType(): string | null {
    return pickRecordType(this.hasAudio());
  }

  hasAudio(): boolean {
    return (this.stream?.getAudioTracks().length ?? 0) > 0;
  }

  /**
   * Record the canvas — so the filtered look is what lands in the file.
   *
   * The mic track, when there is one, is added to the SAME output stream so
   * the recorder muxes it. Note this is the canvas path only: rAF timestamps
   * and the audio clock drift apart over a long take, which is one of the
   * reasons the long raw take bypasses this entirely.
   */
  startRecording(fps = 30, onError?: (e: Error) => void): boolean {
    if (this.take) return false;
    const out = this.canvas.captureStream(fps);
    const mic = this.stream?.getAudioTracks()[0];
    if (mic) out.addTrack(mic);
    this.take = Take.start(out, {
      videoBitsPerSecond: this.params.videoBitsPerSecond,
      audioBitsPerSecond: this.params.audioBitsPerSecond,
      onError,
    });
    return this.take !== null;
  }

  async stopRecording(): Promise<Blob | null> {
    const take = this.take;
    if (!take) return null;
    this.take = null;
    return take.stop();
  }

  isRecording(): boolean {
    return this.take?.active ?? false;
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    void this.take?.stop();
    this.take = null;
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
