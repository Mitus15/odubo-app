"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";
import type { CameraFacing } from "@/lib/loop/capture/camera";
import { PoseVideoEngine } from "@/lib/loop/pose/video-engine";
import { saveItem } from "@/lib/loop/pose/gallery";

/** Max clip length (s) for live recording and uploaded-video processing. */
const MAX_CLIP_S = 15;

/**
 * Pose Studio — VIDEO mode. Live real-time Loop Soul filter (WebGL) → record a
 * clip or process an uploaded video → saved to the on-device gallery. Everything
 * runs locally; nothing is uploaded.
 */
export function PoseVideoStudio({ onSaved }: { onSaved?: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PoseVideoEngine | null>(null);
  const capTimer = useRef<number | null>(null);

  const [facing, setFacing] = useState<CameraFacing>("user");
  const [phase, setPhase] = useState<"starting" | "live" | "processing">("starting");
  const [recording, setRecording] = useState(false);
  const [canRecord, setCanRecord] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flashSaved = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const startCameraMode = useCallback(async (f: CameraFacing) => {
    setError(null);
    setPhase("starting");
    try {
      const engine = engineRef.current;
      if (!engine) return;
      engine.stop();
      await engine.start({ kind: "camera", facing: f });
      setCanRecord(engine.canRecord());
      setPhase("live");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Create the engine once refs exist; start the camera; clean up on unmount.
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;
    engineRef.current = new PoseVideoEngine(videoRef.current, canvasRef.current);
    void startCameraMode("user");
    return () => {
      if (capTimer.current) window.clearTimeout(capTimer.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [startCameraMode]);

  async function flip() {
    const next: CameraFacing = facing === "user" ? "environment" : "user";
    setFacing(next);
    await startCameraMode(next);
  }

  async function persist(blob: Blob | null) {
    if (!blob) {
      setError("Nothing was recorded — try again.");
      return;
    }
    await saveItem(blob, "video");
    flashSaved("Saved to your gallery");
    onSaved?.();
  }

  async function toggleRecord() {
    const engine = engineRef.current;
    if (!engine) return;
    if (recording) {
      if (capTimer.current) window.clearTimeout(capTimer.current);
      setRecording(false);
      await persist(await engine.stopRecording());
      return;
    }
    if (!engine.startRecording()) {
      setError("Recording isn't supported in this browser. Try the Photo tab, or Chrome/Safari 16+.");
      return;
    }
    setRecording(true);
    capTimer.current = window.setTimeout(() => void toggleRecord(), MAX_CLIP_S * 1000);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    const engine = engineRef.current;
    if (!file || !engine) return;
    if (!engine.canRecord()) {
      setError("This browser can't export video. Try the Photo tab, or Chrome/Safari 16+.");
      return;
    }
    setError(null);
    setPhase("processing");
    try {
      // Play the file through the effect once, recording the stylized canvas.
      const done = new Promise<void>((resolve) => {
        engine.onEnded = () => resolve();
        capTimer.current = window.setTimeout(resolve, MAX_CLIP_S * 1000); // bound long clips
      });
      await engine.start({ kind: "file", file });
      engine.startRecording();
      await done;
      if (capTimer.current) window.clearTimeout(capTimer.current);
      await persist(await engine.stopRecording());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      engine.onEnded = null;
      await startCameraMode(facing); // back to live camera
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-electric/20 bg-black">
        {/* Hidden source video; the visible output is the WebGL canvas. */}
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="h-full w-full object-cover" />

        {recording && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-bone">Rec</span>
          </div>
        )}

        {(phase === "starting" || phase === "processing") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70">
            <LoopLoader size={48} />
            <p className="text-xs font-bold uppercase tracking-widest text-electric">
              {phase === "processing" ? "Processing video…" : "Starting camera…"}
            </p>
          </div>
        )}

        {toast && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-electric px-4 py-1.5 text-xs font-bold text-ink">
            {toast}
          </div>
        )}
      </div>

      {error && (
        <p className="w-full rounded-2xl border border-electric/30 bg-ink-soft px-4 py-3 text-center text-sm text-electric">
          {error}
        </p>
      )}

      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={toggleRecord}
          disabled={phase !== "live" || !canRecord}
          className={`flex-1 rounded-full py-4 text-base font-bold transition-transform active:scale-95 disabled:opacity-40 ${
            recording ? "bg-red-500 text-white" : "bg-electric text-ink"
          }`}
        >
          {recording ? "Stop" : "Record"}
        </button>
        <button
          type="button"
          onClick={flip}
          disabled={phase !== "live"}
          aria-label="Flip camera"
          className="shrink-0 rounded-full border border-electric/40 px-5 py-4 text-base font-bold text-electric disabled:opacity-40"
        >
          ⟲
        </button>
        <label className="shrink-0 cursor-pointer rounded-full border border-electric/40 px-5 py-4 text-base font-bold text-electric">
          Upload
          <input type="file" accept="video/*" onChange={onUpload} className="hidden" />
        </label>
      </div>

      <p className="text-center text-[11px] leading-relaxed opacity-50">
        Live Loop Soul filter — record up to {MAX_CLIP_S}s or stylize a clip you upload.
        Best against a plain wall with light on you. Everything stays on your device.
      </p>
    </div>
  );
}

export default PoseVideoStudio;
