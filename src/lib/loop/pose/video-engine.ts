/**
 * Pose Studio video engine — drives the real-time Loop Soul effect.
 *
 * Per animation frame: source (camera OR uploaded file) → MediaPipe VIDEO
 * segmentation (EMA-smoothed) → WebGL render (`GLStylizer`) → onto a canvas.
 * Also records the stylized canvas to a clip via MediaRecorder. All on-device.
 *
 * Camera plumbing is reused from `capture/camera.ts`; the look is `gl-stylize.ts`.
 */

import { startCamera, stopStream, waitForVideoReady, type CameraFacing } from "@/lib/loop/capture/camera";
import { GLStylizer, type GLParams } from "./gl-stylize";
import { segmentVideoFrame, resetVideoMask, preloadVideoSegmenter, type VideoMask } from "./segment";

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
  private gl: GLStylizer | null = null;
  private stream: MediaStream | null = null;
  private objectUrl: string | null = null;
  private raf = 0;
  private running = false;
  private mirror = false;
  private params: EngineParams = {};
  private lastMask: VideoMask | null = null;
  private frameNo = 0;

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
    this.frameNo = 0;
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
    if (!this.gl) this.gl = new GLStylizer(this.canvas);

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
    if (this.gl && v.readyState >= 2 && v.videoWidth > 0) {
      const n = this.params.segEveryN ?? 1;
      if (this.frameNo % n === 0) {
        this.lastMask = await segmentVideoFrame(v, performance.now(), this.params.smoothing ?? 0.6);
      }
      this.frameNo++;
      try {
        this.gl.render(v, this.lastMask, this.params, this.mirror);
      } catch {
        /* transient (e.g. video not decodable this tick) — skip frame */
      }
    }
    this.raf = requestAnimationFrame(() => void this.loop());
  };

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
  }
}
