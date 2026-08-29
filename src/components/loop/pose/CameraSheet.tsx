"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";
import {
  startCamera,
  stopStream,
  captureFrame,
  type CameraFacing,
  type GrantedSettings,
} from "@/lib/loop/capture/camera";
import { holdScreen, type ScreenHold } from "@/lib/loop/capture/wake-lock";
import { segmentSubject, preloadSegmenter } from "@/lib/loop/pose/segment";
import { stylizePoster, stampWatermark, toJpegBlob } from "@/lib/loop/pose/stylize";
import { PoseVideoEngine } from "@/lib/loop/pose/video-engine";
import { Take, pickRecordType } from "@/lib/loop/pose/recorder";
import { saveItem } from "@/lib/loop/pose/gallery";
import { extensionFor, downloadName } from "@/lib/loop/media/filename";
import {
  AUDIO_BPS,
  CAPTURE_FPS,
  CAPTURE_LONG_EDGE,
  GALLERY_MAX_BYTES,
  RENDER_MAX_HEIGHT,
  REC_BPS,
  WALL_MAX_BYTES,
  clipLimitS,
  formatClock,
  isLongTake,
} from "@/lib/loop/pose/limits";
import { postToWall, savedWallName, rememberWallName } from "@/lib/loop/wall/client";

type Mode = "photo" | "video";
type Phase = "starting" | "live" | "working" | "result";

/**
 * The camera, full-bleed — the viewfinder IS the screen and the controls float
 * over it, instead of the old boxed-in studio panel that competed with the
 * page around it. Opens over whatever launched it; X returns you exactly where
 * you were.
 *
 * Three capture paths, and which one runs decides what the preview shows:
 *
 * - **Filtered** (photo or video) — the engine renders to the canvas, and the
 *   canvas is both the preview and, for video, what the recorder taps.
 * - **Unfiltered photo** — the bare <video>, so the shutter reads full sensor
 *   resolution rather than the engine's height-capped canvas.
 * - **The long raw take** (studio, video, filter off) — the bare <video> again,
 *   with the recorder tapping the camera track DIRECTLY. No per-frame work at
 *   all, which is the only way five minutes survives a phone, and it hands the
 *   offline converter the original unfiltered plate it actually wants.
 */
export function CameraSheet({
  onClose,
  canPost = false,
  onPosted,
  studio = false,
}: {
  onClose: () => void;
  /** Pass-holders in the live room can post to the Wall. */
  canPost?: boolean;
  onPosted?: () => void;
  /** Shooting promo rather than attending: full HD, long takes, sound.
   *  Opt-in and never the guest default. */
  studio?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<PoseVideoEngine | null>(null);
  const urlRef = useRef<string | null>(null);

  /** The direct-stream take (long raw path). Null on the canvas path, where
   *  the engine owns the recorder. */
  const takeRef = useRef<Take | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const wakeRef = useRef<ScreenHold | null>(null);
  /** Logic state. `recording` below is for rendering only — the ticker and the
   *  visibility handler must never read a value that lags a render. */
  const recordingRef = useRef(false);
  /** Always the LATEST stopRec. The old cap scheduled a stale copy of the
   *  toggle, which then took the start branch and never stopped anything. */
  const stopRecRef = useRef<(() => Promise<void>) | null>(null);

  const [mode, setMode] = useState<Mode>("photo");
  // On by default — the look IS Loop Soul. Off is a deliberate choice, not the
  // resting state.
  const [filterOn, setFilterOn] = useState(true);
  const [facing, setFacing] = useState<CameraFacing>("user");
  const [phase, setPhase] = useState<Phase>("starting");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultKind, setResultKind] = useState<"image" | "video">("image");
  /** The untouched frame behind a filtered still — see gallery.ts. */
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [posting, setPosting] = useState<"idle" | "posting" | "posted">("idle");
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  /** What the camera actually granted — the studio readout. */
  const [granted, setGranted] = useState<GrantedSettings | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const [recType, setRecType] = useState<string | null>(null);
  const [screenUnheld, setScreenUnheld] = useState(false);

  const maxClipS = clipLimitS(studio, filterOn);
  const rawDirect = isLongTake(studio, mode, filterOn);
  /** The cases that preview the bare <video> rather than the engine canvas. */
  const bareVideo = (mode === "photo" && !filterOn) || rawDirect;

  useEffect(() => setName(savedWallName()), []);

  const releaseTimers = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    wakeRef.current?.release();
    wakeRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    releaseTimers();
    engineRef.current?.dispose();
    engineRef.current = null;
    stopStream(streamRef.current, videoRef.current);
    streamRef.current = null;
  }, [releaseTimers]);

  /**
   * Start (or restart) the live view.
   *
   * The upshot is that the preview shows what you will actually get, in every
   * combination. It did not before: photo previewed raw and produced a poster.
   */
  const begin = useCallback(
    async (m: Mode, f: CameraFacing, filtered: boolean) => {
      setError(null);
      setPhase("starting");
      teardown();
      const longTake = isLongTake(studio, m, filtered);
      const bare = (m === "photo" && !filtered) || longTake;
      const longEdge = studio ? CAPTURE_LONG_EDGE.studio : CAPTURE_LONG_EDGE.guest;
      try {
        if (bare) {
          if (!videoRef.current) return;
          // Only the long take needs a mic. Asking during stills lights the
          // recording indicator for no reason, and on iOS it degrades the
          // audio session for the whole capture.
          const started = await startCamera(videoRef.current, {
            facing: f,
            targetLongEdge: longEdge,
            targetFps: CAPTURE_FPS,
            audio: longTake,
          });
          streamRef.current = started.stream;
          setGranted(started.granted);
          setHasAudio(started.hasAudio);
          setAudioNote(started.audioNote);
          setRecType(pickRecordType(started.hasAudio));
        } else {
          if (!videoRef.current || !canvasRef.current) return;
          const engine = new PoseVideoEngine(videoRef.current, canvasRef.current);
          engineRef.current = engine;
          await engine.start(
            { kind: "camera", facing: f },
            {
              filter: filtered,
              maxHeight: studio ? RENDER_MAX_HEIGHT.studio : RENDER_MAX_HEIGHT.guest,
              captureLongEdge: longEdge,
              captureFps: CAPTURE_FPS,
              audio: studio && m === "video",
              videoBitsPerSecond: REC_BPS.filtered,
              audioBitsPerSecond: AUDIO_BPS,
            },
          );
          setGranted(engine.granted);
          setHasAudio(engine.hasAudio());
          setAudioNote(engine.audioNote);
          setRecType(engine.plannedRecordType());
          if (m === "photo") preloadSegmenter();
        }
        setPhase("live");
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [teardown, studio],
  );

  useEffect(() => {
    void begin(mode, facing, filterOn);
    // `facing` is deliberately absent — flip() restarts the view itself, and
    // listing it here would double-start the camera on every flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filterOn, studio]);

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

  /**
   * End the take and show it.
   *
   * Order matters: the recorder must be stopped and awaited BEFORE teardown,
   * because stopStream kills every track including the one being recorded.
   */
  async function stopRec() {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    releaseTimers();
    setRecording(false);
    setPhase("working");

    const blob = takeRef.current
      ? await takeRef.current.stop()
      : ((await engineRef.current?.stopRecording()) ?? null);
    takeRef.current = null;

    // The camera light, the rAF loop and the mic all stayed live behind the
    // result screen before this — a take never tore down, only a photo did.
    teardown();

    if (blob) showResult(blob, "video");
    else {
      // teardown() has already stopped the camera, so dropping back to "live"
      // would leave a dead viewfinder. Restart it instead.
      setError("Nothing was recorded — try again.");
      void begin(mode, facing, filterOn);
    }
  }
  stopRecRef.current = stopRec;

  async function startRec() {
    if (recordingRef.current) return;
    const onRecorderError = (e: Error) => {
      setError(e.message);
      void stopRecRef.current?.();
    };

    let started = false;
    if (rawDirect) {
      const stream = streamRef.current;
      if (!stream) return;
      takeRef.current = Take.start(stream, {
        videoBitsPerSecond: REC_BPS.raw,
        audioBitsPerSecond: AUDIO_BPS,
        onError: onRecorderError,
      });
      started = takeRef.current !== null;
    } else {
      started = engineRef.current?.startRecording(CAPTURE_FPS, onRecorderError) ?? false;
    }
    if (!started) {
      setError("Recording isn't supported here. Try Photo, or Chrome/Safari 16+.");
      return;
    }

    recordingRef.current = true;
    startedAtRef.current = performance.now();
    setElapsed(0);
    setRecording(true);

    // Without this the phone locks mid-take — iOS auto-lock defaults to 30s,
    // which is shorter than every studio clip length.
    const hold = await holdScreen();
    wakeRef.current = hold;
    setScreenUnheld(!hold.held);

    // Wall-clock, not a countdown: a throttled interval can then only make the
    // stop LATE, never miss it.
    tickRef.current = window.setInterval(() => {
      const secs = (performance.now() - startedAtRef.current) / 1000;
      setElapsed(secs);
      if (secs >= maxClipS) void stopRecRef.current?.();
    }, 250);
  }

  /** A hidden tab is about to be suspended on iOS, and anything recorded past
   *  that point is garbage. Ending honestly beats a corrupt five-minute file. */
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && recordingRef.current) void stopRecRef.current?.();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

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

  const tooBigForWall = !!resultBlob && resultBlob.size > WALL_MAX_BYTES;
  const tooBigForGallery = !!resultBlob && resultBlob.size > GALLERY_MAX_BYTES;

  async function post() {
    if (!resultBlob || posting !== "idle") return;
    setPosting("posting");
    setError(null);
    try {
      rememberWallName(name);
      await postToWall(resultBlob, {
        fileName: `loop-soul.${extensionFor(resultBlob, resultKind)}`,
        userName: name.trim() || null,
      });
      setPosting("posted");
      // Keep a copy on the device too — with the original, when there is one.
      if (!tooBigForGallery) {
        void saveItem(resultBlob, resultKind, { filtered: filterOn, original: originalBlob });
        setSaved(true);
      }
      onPosted?.();
    } catch (e) {
      setError((e as Error).message);
      setPosting("idle");
    }
  }

  async function keep() {
    if (!resultBlob) return;
    // A long take skips the on-device gallery: WallGallery reads every stored
    // blob at once, so one 300 MB clip would wedge the Pose page — and its
    // destination is a desktop converter, not the phone's grid.
    if (!saved && !tooBigForGallery) {
      await saveItem(resultBlob, resultKind, { filtered: filterOn, original: originalBlob });
      setSaved(true);
    }
    if (resultUrl) {
      const a = document.createElement("a");
      a.href = resultUrl;
      a.download = downloadName(resultBlob, resultKind);
      a.click();
    }
  }

  // An error replaces the spinner — never both at once.
  const busy = (phase === "starting" || phase === "working") && !error;
  const remaining = Math.max(0, maxClipS - elapsed);
  /** Roughly what the file will weigh — the number that tells you whether the
   *  download is about to be 40 MB or 300 MB. */
  const approxMb = Math.round(
    (elapsed * (rawDirect ? REC_BPS.raw : REC_BPS.filtered)) / 8 / 1_000_000,
  );
  const lowRes = studio && !!granted && Math.max(granted.width, granted.height) < 1920;

  return (
    <div className="fixed inset-0 z-[65] bg-black">
      {/* Viewfinder / result — full bleed. */}
      <div className="absolute inset-0">
        {/* The bare camera shows for unfiltered photo and for the long raw
            take; every other combination previews through the engine canvas,
            which is also what gets recorded. Both elements stay mounted — the
            engine needs the <video> as its source even while the canvas is
            what you see. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full ${rawDirect ? "object-contain" : "object-cover"} ${
            bareVideo && phase !== "result" ? "" : "hidden"
          }`}
          // The long take is NOT mirrored: mirroring is a preview convention,
          // and baking a flip into the master file gives the offline converter
          // something it has no flag to undo. Preview and file match instead.
          style={{
            transform: facing === "user" && !rawDirect ? "scaleX(-1)" : undefined,
          }}
        />
        <canvas
          ref={canvasRef}
          className={`h-full w-full object-cover ${
            !bareVideo && phase !== "result" ? "" : "hidden"
          }`}
        />
        {phase === "result" &&
          resultUrl &&
          (resultKind === "video" ? (
            // A studio take has sound and can run five minutes, so it gets
            // real controls and no autoplay — a silent auto-loop would defeat
            // the point of recording audio and give no way to scrub.
            studio ? (
              <video
                src={resultUrl}
                className="h-full w-full object-contain"
                controls
                playsInline
              />
            ) : (
              <video
                src={resultUrl}
                className="h-full w-full object-contain"
                autoPlay
                loop
                playsInline
                muted
              />
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resultUrl} alt="Your Loop Soul shot" className="h-full w-full object-contain" />
          ))}
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
          disabled={recording}
          aria-label="Close camera"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/60 text-xl font-bold text-bone backdrop-blur disabled:opacity-40"
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
                disabled={recording}
                className={`rounded-full px-5 py-2 text-xs font-bold uppercase tracking-widest capitalize disabled:opacity-40 ${
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

      {/* Studio readout — what the camera ACTUALLY gave us, before a single
          frame is recorded. Studio mode previously claimed HD it could never
          reach, and there was no way to tell from the device. */}
      {studio && phase !== "result" && granted && (
        <div className="absolute left-1/2 top-[4.75rem] w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl bg-ink/70 px-3 py-2 text-center backdrop-blur">
          <p
            className={`text-[10px] font-bold uppercase tracking-widest ${
              lowRes ? "text-amber-400" : "text-bone/90"
            }`}
          >
            {granted.width}×{granted.height}
            {granted.frameRate ? ` · ${Math.round(granted.frameRate)}fps` : ""} ·{" "}
            {hasAudio ? "mic on" : "no mic"} · max {formatClock(maxClipS)}
          </p>
          <p className="mt-0.5 text-[10px] text-bone/60">
            {lowRes ? "This device wouldn't give full HD. " : ""}
            {rawDirect
              ? "Raw take — unmirrored, convert after."
              : "Filtered — the look is baked in."}
            {recType ? ` · ${recType.replace("video/", "")}` : ""}
          </p>
          {(audioNote || screenUnheld) && (
            <p className="mt-0.5 text-[10px] text-amber-400">
              {audioNote}
              {audioNote && screenUnheld ? " " : ""}
              {screenUnheld ? "Keep the screen awake — this device can't hold it." : ""}
            </p>
          )}
        </div>
      )}

      {recording && (
        <div className="absolute left-1/2 top-32 w-[min(80vw,18rem)] -translate-x-1/2 rounded-full bg-ink/70 px-4 py-2 backdrop-blur">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span
              className={`text-[11px] font-bold uppercase tracking-widest tabular-nums ${
                remaining <= 15 ? "text-amber-400" : "text-bone"
              }`}
            >
              {formatClock(elapsed)} / {formatClock(maxClipS)}
              {studio && approxMb > 0 ? ` · ~${approxMb} MB` : ""}
            </span>
          </div>
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-bone/25">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${
                remaining <= 15 ? "bg-amber-400" : "bg-sand"
              }`}
              style={{ width: `${Math.min(100, (elapsed / maxClipS) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-4 top-44 rounded-2xl bg-ink/85 px-4 py-3 text-center backdrop-blur">
          <p className="text-sm text-sand">{error}</p>
          <p className="mt-1 text-xs text-bone/60">
            If you blocked the camera, allow it in your browser&apos;s site settings, then
            try again.
          </p>
          <button
            type="button"
            onClick={() => void begin(mode, facing, filterOn)}
            className="mt-2 rounded-full border border-bone/40 px-5 py-1.5 text-xs font-bold uppercase tracking-widest text-bone"
          >
            Try again
          </button>
        </div>
      )}

      {/* Bottom rail: floats over the viewfinder. */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6">
        {phase === "result" ? (
          <div className="flex flex-col gap-2">
            {canPost && !tooBigForWall && (
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
                    ? "On the Wall ✦ — you're in the cover contest"
                    : posting === "posting"
                      ? "Posting…"
                      : "Post to the Wall — enters the cover contest"}
                </button>
              </>
            )}
            {canPost && tooBigForWall && (
              <p className="rounded-2xl bg-ink/70 px-4 py-2 text-center text-xs text-bone/70 backdrop-blur">
                Too long for the Wall — keep it and post a shorter clip instead.
              </p>
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
            <p className="text-center text-[11px] text-bone/60">
              {tooBigForGallery
                ? "Too big for the on-device gallery — Keep downloads it to Files."
                : "Keep saves to this device only — it doesn't enter the contest."}
            </p>
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
                onClick={() => void (recording ? stopRec() : startRec())}
                disabled={phase !== "live" && !recording}
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
              disabled={phase !== "live" || recording}
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
