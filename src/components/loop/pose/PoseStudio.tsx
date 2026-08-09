"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";
import { startCamera, stopStream, captureFrame, type CameraFacing } from "@/lib/loop/capture/camera";
import { segmentSubject, preloadSegmenter } from "@/lib/loop/pose/segment";
import { stylize, stampWatermark, toJpegBlob } from "@/lib/loop/pose/stylize";
import { saveItem } from "@/lib/loop/pose/gallery";

/**
 * Pose Studio — guided capture → on-device segmentation → Loop Soul duotone
 * (subject silhouetted on a flat sand field) → Save / Share. All
 * processing is on-device; nothing is uploaded here (that rides on the moments
 * core / State 2 later — the output Blob is already in the right format).
 */
export function PoseStudio({ onSaved }: { onSaved?: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const urlRef = useRef<string | null>(null);
  const rawRef = useRef<Blob | null>(null); // original photo (fed to the generative upgrade)

  const [facing, setFacing] = useState<CameraFacing>("user");
  const [phase, setPhase] = useState<"starting" | "live" | "working" | "result">("starting");
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState(false);

  // Build-time flag: is the generative "Make it a poster" upgrade offered?
  const posterEnabled = process.env.NEXT_PUBLIC_POSE_GENERATIVE === "1";

  const begin = useCallback(async (f: CameraFacing) => {
    setError(null);
    setPhase("starting");
    try {
      if (!videoRef.current) return;
      streamRef.current = await startCamera(videoRef.current, f);
      preloadSegmenter(); // warm the model while the user frames up
      setPhase("live");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Start on mount; clean up on unmount.
  useEffect(() => {
    void begin("user");
    return () => {
      stopStream(streamRef.current, videoRef.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [begin]);

  async function capture() {
    if (!videoRef.current || phase !== "live") return;
    setPhase("working");
    setError(null);
    try {
      const frame = captureFrame(videoRef.current, facing === "user");
      rawRef.current = toJpegBlob(frame, 0.92); // keep the original before we stylize
      const mask = await segmentSubject(frame); // null → duotone fallback
      stylize(frame, mask); // tuned B3 defaults (darker silhouette, cleaner line-art)
      await stampWatermark(frame);
      const blob = toJpegBlob(frame, 0.92);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setResultBlob(blob);
      setResultUrl(url);
      setEnhanced(false);
      stopStream(streamRef.current, videoRef.current); // freeze the camera
      setPhase("result");
    } catch (e) {
      setError((e as Error).message);
      setPhase("live");
    }
  }

  function retake() {
    setResultUrl(null);
    setResultBlob(null);
    setEnhanced(false);
    void begin(facing);
  }

  /** Generative upgrade: send the ORIGINAL photo to the provider, swap in the
   *  returned poster. On-device duotone stays the always-works baseline. */
  async function makePoster() {
    const raw = rawRef.current;
    if (!raw || enhancing) return;
    setEnhancing(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/pose/stylize", {
        method: "POST",
        headers: { "content-type": raw.type || "image/jpeg" },
        body: raw,
      });
      if (!res.ok) throw new Error(`Couldn't make your poster (${res.status}).`);
      const blob = await res.blob();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setResultBlob(blob);
      setResultUrl(url);
      setEnhanced(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnhancing(false);
    }
  }

  async function flip() {
    const next: CameraFacing = facing === "user" ? "environment" : "user";
    setFacing(next);
    stopStream(streamRef.current, videoRef.current);
    await begin(next);
  }

  /** Keep a copy in the on-device gallery (idempotent enough for our use). */
  async function persistToGallery() {
    if (!resultBlob) return;
    await saveItem(resultBlob, "image");
    onSaved?.();
  }

  function save() {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `loop-soul-${Date.now()}.jpg`;
    a.click();
    void persistToGallery();
  }

  async function share() {
    if (!resultBlob) return;
    const file = new File([resultBlob], "loop-soul.jpg", { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Loop Soul", text: "What are you dancing to?" });
        void persistToGallery();
        return;
      } catch {
        /* user cancelled — fall through to save */
      }
    }
    save();
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-sand/20 bg-black">
        {/* Live camera (hidden once we have a result) */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{
            transform: facing === "user" ? "scaleX(-1)" : undefined,
            display: phase === "result" ? "none" : "block",
          }}
        />

        {/* Result */}
        {phase === "result" && resultUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resultUrl} alt="Your Loop Soul portrait" className="h-full w-full object-cover" />
        )}

        {/* Pose guide overlay while live */}
        {phase === "live" && <PoseGuide />}

        {/* Busy / starting overlay */}
        {(phase === "working" || phase === "starting" || enhancing) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70">
            <LoopLoader size={48} />
            <p className="text-xs font-bold uppercase tracking-widest text-sand">
              {enhancing
                ? "Making your poster…"
                : phase === "working"
                  ? "Loop Soul-ing…"
                  : "Starting camera…"}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="w-full rounded-2xl border border-sand/30 bg-ink-soft px-4 py-3 text-center text-sm text-sand">
          {error}
        </p>
      )}

      {/* Controls */}
      <div className="flex w-full flex-col gap-2">
        {phase === "result" ? (
          <>
            {posterEnabled && !enhanced && (
              <button
                type="button"
                onClick={makePoster}
                disabled={enhancing}
                className="rounded-full bg-sand-bright py-4 text-base font-bold text-ink transition-transform active:scale-95 disabled:opacity-40"
              >
                ✦ Make it a poster
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={share}
                className="rounded-full bg-sand py-4 text-base font-bold text-ink transition-transform active:scale-95"
              >
                Share
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-full border border-sand/40 py-4 text-base font-bold text-sand transition-transform active:scale-95"
              >
                Save
              </button>
            </div>
            <button
              type="button"
              onClick={retake}
              className="rounded-full py-3 text-sm font-bold uppercase tracking-widest text-bone/70"
            >
              Retake
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={capture}
              disabled={phase !== "live"}
              className="flex-1 rounded-full bg-sand py-4 text-base font-bold text-ink transition-transform active:scale-95 disabled:opacity-40"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={flip}
              disabled={phase !== "live"}
              aria-label="Flip camera"
              className="shrink-0 rounded-full border border-sand/40 px-5 py-4 text-base font-bold text-sand disabled:opacity-40"
            >
              ⟲
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] leading-relaxed opacity-50">
        Tip: stand against a plain wall with light on your face for the cleanest
        silhouette. Everything happens on your device — nothing is uploaded.
      </p>
    </div>
  );
}

/** Framing guide: a dashed head-and-shoulders outline + coaching caption. */
function PoseGuide() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <svg
        viewBox="0 0 100 130"
        className="h-3/4 w-auto opacity-40"
        fill="none"
        stroke="#d9aa7a"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      >
        <circle cx="50" cy="34" r="20" />
        <path d="M16 130 C16 92 30 70 50 70 C70 70 84 92 84 130" />
      </svg>
      <span className="absolute bottom-4 rounded-full bg-ink/70 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-sand">
        Stand in the frame
      </span>
    </div>
  );
}

export default PoseStudio;
