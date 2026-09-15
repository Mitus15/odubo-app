"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { parseScannedCode } from "@/lib/loop/door";

type Pass = {
  code: string;
  email: string | null;
  orderId: string | null;
  redeemed: boolean;
  admittedAt: string | null;
  sim: boolean;
};
type Counts = { admitted: number; sold: number };
type Result =
  | { status: "admitted" | "already" | "found"; pass: Pass }
  | { status: "unknown"; code: string };

/** Chrome and Android have a native detector; Safari does not. jsQR covers the rest. */
type NativeDetector = { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> };
function nativeDetector(): NativeDetector | null {
  const w = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => NativeDetector };
  try {
    return w.BarcodeDetector ? new w.BarcodeDetector({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Vancouver" });
}

/**
 * Point the phone at a ticket. A clean scan admits it and says so in green; a
 * second scan of the same pass says ALREADY IN and when; a code that is not
 * ours says so in red. Scanning never stops, so the host never taps between
 * guests. Typing a code by hand looks it up first and admits on a tap, and so
 * does arriving here from a plain camera app (?c=), because a page load must
 * never admit anyone by itself.
 */
export default function DoorScanner({ initialCode }: { initialCode: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const busyRef = useRef(false);

  const [counts, setCounts] = useState<Counts | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [typed, setTyped] = useState(initialCode ?? "");
  const [note, setNote] = useState<string | null>(null);

  const refreshCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/loop/admin/door", { cache: "no-store" });
      if (res.ok) setCounts((await res.json()) as Counts);
    } catch {
      /* keep last */
    }
  }, []);

  const send = useCallback(
    async (code: string, admit: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setNote(null);
      try {
        const res = await fetch("/api/loop/admin/door", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, admit }),
        });
        const data = (await res.json().catch(() => ({}))) as Partial<Result> & { counts?: Counts; error?: string };
        if (res.status === 404 || data.status === "unknown") {
          setResult({ status: "unknown", code: parseScannedCode(code) ?? code });
          buzz("bad");
        } else if (!res.ok) {
          setNote(data.error ?? `Something went wrong (${res.status}).`);
        } else if (data.status && "pass" in data && data.pass) {
          setResult({ status: data.status as "admitted" | "already" | "found", pass: data.pass });
          if (data.status === "admitted") buzz("good");
          if (data.status === "already") buzz("warn");
        }
        if (data.counts) setCounts(data.counts);
      } catch (e) {
        setNote((e as Error).message);
      } finally {
        busyRef.current = false;
      }
    },
    [],
  );

  // A pass arriving in the URL (a plain camera app scanned the ticket): look it
  // up and wait for the tap. Never admit on a page load.
  useEffect(() => {
    void refreshCounts();
    if (initialCode) void send(initialCode, false);
  }, [initialCode, refreshCounts, send]);

  // The camera. Rear-facing, decoded off a canvas a few times a second.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let alive = true;
    const detector = nativeDetector();

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!alive || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setScanning(true);
        setCameraError(null);
      } catch (e) {
        const name = (e as DOMException).name;
        setCameraError(
          name === "NotAllowedError"
            ? "Camera blocked. Allow it in the browser's site settings, or type the code below."
            : "No camera here. Type the code below.",
        );
        return;
      }

      const tick = async () => {
        if (!alive) return;
        const v = video.current;
        const c = canvas.current;
        if (v && c && v.readyState >= 2 && !busyRef.current) {
          let text: string | null = null;
          try {
            if (detector) {
              const found = await detector.detect(v);
              text = found[0]?.rawValue ?? null;
            } else {
              const w = (c.width = Math.min(v.videoWidth, 640));
              const h = (c.height = Math.round((v.videoHeight / v.videoWidth) * w) || 480);
              const ctx = c.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                text = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
              }
            }
          } catch {
            text = null;
          }
          const code = parseScannedCode(text);
          if (code) {
            // The same ticket held up for a few seconds is one scan, not ten.
            const last = lastRef.current;
            if (!last || last.code !== code || Date.now() - last.at > 4000) {
              lastRef.current = { code, at: Date.now() };
              void send(code, true);
            }
          }
        }
        timer = window.setTimeout(tick, detector ? 150 : 250);
      };
      void tick();
    })();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [send]);

  // Keep the screen on at the door.
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, []);

  const tone = result
    ? result.status === "admitted"
      ? "bg-emerald-700 text-white"
      : result.status === "already"
        ? "bg-amber-500 text-black"
        : result.status === "unknown"
          ? "bg-red-700 text-white"
          : "bg-ink text-sand"
    : "bg-ink/5";

  return (
    <div className="mt-4 grid gap-3">
      {/* Heads in, against passes sold. The number the host actually wants. */}
      <div className="flex items-baseline justify-between rounded-2xl border border-ink/15 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">In the room</span>
        <span className="text-2xl font-extrabold tabular-nums">
          {counts ? counts.admitted : "–"}
          <span className="text-sm font-bold opacity-50"> / {counts ? counts.sold : "–"}</span>
        </span>
      </div>

      {/* Viewfinder */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black">
        <video ref={video} className="h-full w-full object-cover" muted playsInline autoPlay />
        <canvas ref={canvas} className="hidden" />
        <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-sand/70" />
        {!scanning && !cameraError && (
          <p className="absolute inset-x-0 bottom-3 text-center text-xs text-sand/80">Starting the camera…</p>
        )}
        {cameraError && (
          <p className="absolute inset-x-4 bottom-4 rounded-xl bg-ink/85 px-3 py-2 text-center text-xs text-sand">{cameraError}</p>
        )}
      </div>

      {/* The verdict. Big, coloured, and the last one stays up until the next scan. */}
      <div className={`min-h-[104px] rounded-3xl px-5 py-4 transition-colors ${tone}`} aria-live="polite">
        {!result ? (
          <p className="text-sm opacity-70">Point at a ticket.</p>
        ) : result.status === "unknown" ? (
          <>
            <p className="text-xl font-extrabold">NOT A PASS</p>
            <p className="mt-1 font-mono text-sm opacity-90">{result.code}</p>
            <p className="mt-1 text-xs opacity-80">Not on this volume. Search by email in Admin → Event codes.</p>
          </>
        ) : (
          <>
            <p className="text-xl font-extrabold">
              {result.status === "admitted" ? "IN ✓" : result.status === "already" ? "ALREADY IN" : "FOUND"}
              {result.pass.sim ? " · TEST PASS" : ""}
            </p>
            <p className="mt-1 font-mono text-sm">{result.pass.code}</p>
            <p className="mt-0.5 truncate text-sm opacity-90">{result.pass.email ?? "no email on file"}</p>
            {result.status === "already" && result.pass.admittedAt && (
              <p className="mt-1 text-xs font-bold">Admitted at {clock(result.pass.admittedAt)}. Same ticket twice.</p>
            )}
            {result.status === "found" && (
              <button
                type="button"
                onClick={() => send(result.pass.code, true)}
                className="mt-3 min-h-[48px] w-full rounded-full bg-sand text-base font-extrabold text-ink"
              >
                {result.pass.admittedAt ? `Already in at ${clock(result.pass.admittedAt)} · admit again` : "Admit"}
              </button>
            )}
          </>
        )}
      </div>

      {/* By hand. For a cracked screen, a dead phone, or a plain camera app. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) void send(typed, false);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="LOOP-XXXX or the ticket link"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-[48px] flex-1 rounded-full border border-ink/20 bg-transparent px-4 font-mono text-sm outline-none focus:border-ink"
        />
        <button type="submit" className="min-h-[48px] rounded-full border border-ink px-4 text-sm font-bold">
          Look up
        </button>
      </form>
      {note && <p className="text-center text-xs text-red-700">{note}</p>}
      <p className="text-center text-[11px] opacity-60">
        Can&apos;t find them? Their email is searchable in Admin → Event codes.
      </p>
    </div>
  );
}

/** A short tone and a buzz so the host hears the verdict without looking. */
function buzz(kind: "good" | "warn" | "bad") {
  try {
    navigator.vibrate?.(kind === "good" ? 80 : kind === "warn" ? [60, 60, 60] : [200]);
  } catch {
    /* no haptics */
  }
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = kind === "good" ? 880 : kind === "warn" ? 440 : 220;
    o.type = "sine";
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (kind === "bad" ? 0.35 : 0.15));
    o.onended = () => void ctx.close();
  } catch {
    /* silent door */
  }
}
