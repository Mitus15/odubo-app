"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";
import { startCamera, stopStream, captureFrame, type CameraFacing } from "@/lib/loop/capture/camera";
import { segmentSubject, preloadSegmenter } from "@/lib/loop/pose/segment";
import { stylizePoster, stampWatermark, toJpegBlob } from "@/lib/loop/pose/stylize";
import { PoseVideoEngine } from "@/lib/loop/pose/video-engine";
import { saveItem } from "@/lib/loop/pose/gallery";
import { postToWall, savedWallName, rememberWallName } from "@/lib/loop/wall/client";

type Mode = "photo" | "video";
type Phase = "starting" | "live" | "working" | "result";

const MAX_CLIP_S = 15;

/**
 * The camera, full-bleed — the viewfinder IS the screen and the controls float
 * over it, instead of the old boxed-in studio panel that competed with the
 * page around it. Opens over whatever launched it; X returns you exactly where
 * you were.
 *
 * Photo runs the still pipeline (segment → The Redraw → watermark); Video runs
 * the real-time engine. Both land on the same result screen: post it to the
 * Wall, keep it, or retake.
 */
export function CameraSheet({
  onClose,
  canPost = false,
  onPosted,
}: {
  onClose: () => void;
  /** Pass-holders in the live room can post to the Wall. */
  canPost?: boolean;
  onPosted?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<PoseVideoEngine | null>(null);
  const urlRef = useRef<string | null>(null);
  const capTimer = useRef<number | null>(null);

  const [mode, setMode] = useState<Mode>("photo");
  // On by default — the look IS Loop Soul. Off is a deliberate choice, not the
  // resting state.
  const [filterOn, setFilterOn] = useState(true);
  const [facing, setFacing] = useState<CameraFacing>("user");
  const [phase, setPhase] = useState<Phase>("starting");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultKind, setResultKind] = useState<"image" | "video">("image");
  /** The untouched frame behind a filtered still — see gallery.ts. */
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [posting, setPosting] = useState<"idle" | "posting" | "posted">("idle");
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => setName(savedWallName()), []);

  const teardown = useCallback(() => {
    if (capTimer.current) window.clearTimeout(capTimer.current);
    engineRef.current?.dispose();
    engineRef.current = null;
    stopStream(streamRef.current, videoRef.current);
    streamRef.current = null;
  }, []);

  /**
   * Start (or restart) the live view.
   *
   * The engine drives the preview whenever the canvas is what gets shown —
   * filtered in either mode, and unfiltered VIDEO (where the recorder taps the
   * canvas, so passthrough has to run through it too). Only unfiltered PHOTO
   * uses the bare <video>, because there the shutter reads the element directly
   * at full sensor resolution rather than the engine's height-capped canvas.
   *
   * The upshot is that the preview now shows what you will actually get. It did
   * not before: photo previewed raw and produced a poster.
   */
  const begin = useCallback(
    async (m: Mode, f: CameraFacing, filtered: boolean) => {
      setError(null);
      setPhase("starting");
      teardown();
      try {
        const rawPhoto = m === "photo" && !filtered;
        if (rawPhoto) {
          if (!videoRef.current) return;
          streamRef.current = await startCamera(videoRef.current, f);
        } else {
          if (!videoRef.current || !canvasRef.current) return;
          const engine = new PoseVideoEngine(videoRef.current, canvasRef.current);
          engineRef.current = engine;
          await engine.start({ kind: "camera", facing: f }, { filter: filtered });
          if (m === "photo") preloadSegmenter();
        }
        setPhase("live");
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [teardown],
  );

  useEffect(() => {
    void begin(mode, facing, filterOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filterOn]);

  useEffect(() => {
    return () => {
      teardown();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [teardown]);

  function showResult(blob: Blob, kind: "image" | "video", original: Blob | null = null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setOriginalBlob(original);
    setResultBlob(blob);
    setResultUrl(url);
    setResultKind(kind);
    setPosting("idle");
    setSaved(false);
    setPhase("result");
  }

  async function capture() {
    if (!videoRef.current || phase !== "live" || mode !== "photo") return;
    setPhase("working");
    try {
      // Read the <video> element directly either way, so the still is full
      // sensor resolution rather than the engine's height-capped preview canvas.
      const frame = captureFrame(videoRef.current, facing === "user");

      if (!filterOn) {
        // No watermark on an unfiltered shot: it is the guest's photograph, not
        // a Loop Soul artwork, and branding it would be claiming something.
        teardown();
        showResult(toJpegBlob(frame, 0.92), "image");
        return;
      }

      // Snapshot the original BEFORE the filter runs — stylizePoster paints
      // over the canvas in place, so after this line the raw frame is gone.
      const original = toJpegBlob(frame, 0.92);
      const mask = await segmentSubject(frame);
      stylizePoster(frame, mask);
      await stampWatermark(frame);
      teardown();
      showResult(toJpegBlob(frame, 0.92), "image", original);
    } catch (e) {
      setError((e as Error).message);
      setPhase("live");
    }
  }

  async function toggleRecord() {
    const engine = engineRef.current;
    if (!engine) return;
    if (recording) {
      if (capTimer.current) window.clearTimeout(capTimer.current);
      setRecording(false);
      const blob = await engine.stopRecording();
      if (blob) showResult(blob, "video");
      else setError("Nothing was recorded — try again.");
      return;
    }
    if (!engine.startRecording()) {
      setError("Recording isn't supported here. Try Photo, or Chrome/Safari 16+.");
      return;
    }
    setRecording(true);
    capTimer.current = window.setTimeout(() => void toggleRecord(), MAX_CLIP_S * 1000);
  }

  async function flip() {
    const next: CameraFacing = facing === "user" ? "environment" : "user";
    setFacing(next);
    await begin(mode, next, filterOn);
  }

  function retake() {
    setResultUrl(null);
    setResultBlob(null);
    setOriginalBlob(null);
    void begin(mode, facing, filterOn);
  }

  async function post() {
    if (!resultBlob || posting !== "idle") return;
    setPosting("posting");
    setError(null);
    try {
      rememberWallName(name);
      await postToWall(resultBlob, {
        fileName: resultKind === "video" ? "loop-soul.webm" : "loop-soul.jpg",
        userName: name.trim() || null,
      });
      setPosting("posted");
      // Keep a copy on the device too — with the original, when there is one.
      void saveItem(resultBlob, resultKind, { filtered: filterOn, original: originalBlob });
      setSaved(true);
      onPosted?.();
    } catch (e) {
      setError((e as Error).message);
      setPosting("idle");
    }
  }

  async function keep() {
    if (!resultBlob || saved) return;
    await saveItem(resultBlob, resultKind, { filtered: filterOn, original: originalBlob });
    setSaved(true);
    if (resultUrl) {
      const a = document.createElement("a");
      a.href = resultUrl;
      a.download = `loop-soul-${Date.now()}.${resultKind === "video" ? "webm" : "jpg"}`;
      a.click();
    }
  }

  // An error replaces the spinner — never both at once.
  const busy = (phase === "starting" || phase === "working") && !error;
  /** The one case that previews the camera element rather than the canvas. */
  const rawPhotoPreview = mode === "photo" && !filterOn;

  return (
    <div className="fixed inset-0 z-[65] bg-black">
      {/* Viewfinder / result — full bleed. */}
      <div className="absolute inset-0">
        {/* Unfiltered photo is the only case that shows the bare camera; every
            other combination previews through the engine canvas, which is also
            what gets recorded. Both elements stay mounted — the engine needs the
            <video> as its source even while the canvas is what you see. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${
            rawPhotoPreview && phase !== "result" ? "" : "hidden"
          }`}
          style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
        />
        <canvas
          ref={canvasRef}
          className={`h-full w-full object-cover ${
            !rawPhotoPreview && phase !== "result" ? "" : "hidden"
          }`}
        />
        {phase === "result" && resultUrl && (
          resultKind === "video" ? (
            <video src={resultUrl} className="h-full w-full object-contain" autoPlay loop playsInline muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resultUrl} alt="Your Loop Soul shot" className="h-full w-full object-contain" />
          )
        )}
      </div>

      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70">
          <LoopLoader size={52} />
          <p className="text-xs font-bold uppercase tracking-widest text-sand">
            {phase === "working" ? "Loop Soul-ing…" : "Starting camera…"}
          </p>
        </div>
      )}

      {/* Top rail: close + mode toggle */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/60 text-xl font-bold text-bone backdrop-blur"
        >
          ✕
        </button>
        {phase !== "result" && (
          <div className="flex rounded-full bg-ink/60 p-1 backdrop-blur">
            {(["photo", "video"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-5 py-2 text-xs font-bold uppercase tracking-widest capitalize ${
                  mode === m ? "bg-sand text-ink" : "text-bone/80"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
        <div className="h-11 w-11" aria-hidden />
      </div>

      {recording && (
        <div className="absolute left-1/2 top-24 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/70 px-4 py-1.5 backdrop-blur">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-bone">
            Rec · max {MAX_CLIP_S}s
          </span>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-4 top-24 rounded-2xl bg-ink/85 px-4 py-3 text-center text-sm text-sand backdrop-blur">
          {error}
        </div>
      )}

      {/* Bottom rail: floats over the viewfinder. */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6">
        {phase === "result" ? (
          <div className="flex flex-col gap-2">
            {canPost && (
              <>
                {posting === "idle" && (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => rememberWallName(name)}
                    placeholder="Your name (optional)"
                    maxLength={60}
                    className="rounded-full border border-bone/25 bg-ink/60 px-5 py-3 text-sm text-bone outline-none backdrop-blur placeholder:text-bone/40 focus:border-sand"
                  />
                )}
                <button
                  type="button"
                  onClick={post}
                  disabled={posting !== "idle"}
                  className="rounded-full bg-sand py-4 text-base font-bold text-ink transition-transform active:scale-95 disabled:opacity-70"
                >
                  {posting === "posted"
                    ? "On the Wall ✦"
                    : posting === "posting"
                      ? "Posting…"
                      : "Post to the Wall"}
                </button>
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={keep}
                className="rounded-full border border-bone/40 py-4 text-base font-bold text-bone transition-transform active:scale-95"
              >
                {saved ? "Kept ✓" : "Keep"}
              </button>
              <button
                type="button"
                onClick={retake}
                className="rounded-full border border-bone/40 py-4 text-base font-bold text-bone transition-transform active:scale-95"
              >
                Retake
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-6">
            <button
              type="button"
              onClick={() => setFilterOn((v) => !v)}
              // Not gated on phase === "live". Flipping the filter restarts the
              // view anyway, so leaving it live while the camera is starting or
              // has failed makes it a retry as well as a toggle — and a failed
              // start leaves `phase` at "starting" forever, which would
              // otherwise disable this permanently. Only mid-record and
              // mid-process are genuinely unsafe.
              disabled={recording || phase === "working"}
              aria-pressed={filterOn}
              aria-label={filterOn ? "Turn the Loop Soul filter off" : "Turn the Loop Soul filter on"}
              className={`flex h-14 w-14 flex-col items-center justify-center rounded-full text-[9px] font-bold uppercase tracking-widest backdrop-blur transition-colors disabled:opacity-40 ${
                filterOn ? "bg-sand text-ink" : "bg-ink/60 text-bone/80"
              }`}
            >
              <span aria-hidden className="text-base leading-none">∞</span>
              <span className="mt-0.5 leading-none">{filterOn ? "On" : "Off"}</span>
            </button>
            {mode === "photo" ? (
              <button
                type="button"
                onClick={capture}
                disabled={phase !== "live"}
                aria-label="Capture"
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-bone/80 disabled:opacity-40"
              >
                <span className="h-16 w-16 rounded-full bg-sand" />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleRecord}
                disabled={phase !== "live"}
                aria-label={recording ? "Stop recording" : "Record"}
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-bone/80 disabled:opacity-40"
              >
                <span
                  className={
                    recording
                      ? "h-7 w-7 rounded-md bg-red-500"
                      : "h-16 w-16 rounded-full bg-red-500"
                  }
                />
              </button>
            )}
            <button
              type="button"
              onClick={flip}
              disabled={phase !== "live"}
              aria-label="Flip camera"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-ink/60 text-xl text-bone backdrop-blur disabled:opacity-40"
            >
              ⟲
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CameraSheet;
