"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { usePWA } from "@/components/PWAProvider";
import type { FeaturedSingle } from "@/lib/loop/single";

/**
 * THE SINGLE — what the flyer's QR promises.
 *
 * The gift is UNCONDITIONAL. Nothing here is gated behind an install, a share,
 * an email or a name: a stranger who scans a piece of paper at a barbecue gets
 * the song, and gets it on the first tap. Every gate we could put in front of
 * it would be paid for in the only currency that matters at this stage, which
 * is people who bothered.
 *
 * One tap, not zero — browsers refuse to start audible playback without a
 * gesture (docs: CLAUDE.md, "Browser Autoplay Policies"), and a silently
 * autoplaying muted song is worse than a button. So the button is enormous,
 * the audio is preloaded, and the tap is the only thing between the scan and
 * the record.
 *
 * The three doors under it run in order of what they cost the listener:
 * keep it (free), pass it on (a name), come hear the rest (a ticket). The
 * ticket is last on purpose — asking for money before the song has proved
 * itself is how you get one listen and no room.
 */

const SEEN_KEY = "loop.single.seen";
const CODE_KEY = "loop.gift.code";
const NAME_KEY = "loop.gift.name";
const VISITOR_KEY = "loop.visitor";

function visitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    // Private mode, or storage blocked. A visitor we cannot remember still
    // gets the song; they just cannot be counted, which is the right thing to
    // lose of the two.
    return "";
  }
}

function clock(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function TheSingle({
  single,
  onClose,
  onGetPass,
  onCoverContest,
}: {
  single: FeaturedSingle;
  onClose: () => void;
  onGetPass: () => void;
  onCoverContest: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [heard, setHeard] = useState(false); // got far enough in to have an opinion
  const [sender, setSender] = useState<string | null>(null);

  const { isStandalone, isInstallable, promptInstall } = usePWA();
  const [iosHelp, setIosHelp] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [reached, setReached] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [minting, setMinting] = useState(false);

  const duration = single.duration || audioRef.current?.duration || 0;

  /* ── who sent them here ─────────────────────────────────────────────── */
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
      setCode(localStorage.getItem(CODE_KEY));
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* storage blocked — the song still plays */
    }

    const from = new URLSearchParams(window.location.search).get("from");
    if (!from) return;
    const v = visitorId();
    if (!v) return;
    fetch("/api/loop/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "visit", code: from, visitor: v }),
    })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ name: string | null }>) : null,
      )
      .then((d) => d?.name && setSender(d.name))
      .catch(() => {
        /* attribution is a nicety; never let it break the page */
      });
  }, []);

  /* ── how many people this listener has reached ──────────────────────── */
  useEffect(() => {
    if (!code) return;
    fetch(`/api/loop/gift?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ count: number }>) : null))
      .then((d) => typeof d?.count === "number" && setReached(d.count))
      .catch(() => {});
  }, [code]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // Called straight out of the click handler — never awaited behind a
      // readyState check, which is what breaks playback on mobile Safari.
      void a
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  }, []);

  const share = useCallback(async () => {
    let c = code;
    if (!c) {
      const n = name.trim();
      if (!n) return;
      setMinting(true);
      try {
        const res = await fetch("/api/loop/gift", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mint", name: n }),
        });
        if (!res.ok) return;
        c = ((await res.json()) as { code: string }).code;
        setCode(c);
        try {
          localStorage.setItem(CODE_KEY, c);
          localStorage.setItem(NAME_KEY, n);
        } catch {}
      } finally {
        setMinting(false);
      }
    }
    if (!c) return;

    // Origin, never a hardcoded domain — the printed URL has moved once
    // already and the share link must follow it without a deploy.
    const url = `${window.location.origin}/loop?from=${c}`;
    const text = `Listen to "${single.title}" — ${single.artistName}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: single.title, text, url });
        return;
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {}
  }, [code, name, single.title, single.artistName]);

  const keepIt = useCallback(async () => {
    if (isInstallable) {
      await promptInstall();
      return;
    }
    // iOS gives no install API at all — the Share-sheet route is the only one,
    // so say it in words rather than firing a prompt that will never come.
    setIosHelp((v) => !v);
  }, [isInstallable, promptInstall]);

  const pct = duration > 0 ? Math.min(100, (t / duration) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-sand text-ink"
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-10 pt-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 p-2 text-2xl leading-none opacity-50 transition-opacity hover:opacity-100"
          >
            ×
          </button>
        </div>

        {sender && (
          <div className="loop-muted mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em]">
            {sender} sent you this
          </div>
        )}

        {single.coverUrl && (
          <div className="relative mx-auto aspect-square w-full max-w-[260px]">
            {/* Ripples behind the cover while it plays — staggered so the
                rings never leave in step. Ink on sand, nothing new in the
                palette. */}
            {playing && (
              <>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="loop-ripple absolute inset-0 rounded-2xl border border-ink"
                    style={{ animationDelay: `${i * 1.13}s` }}
                  />
                ))}
              </>
            )}
            <div
              className={`relative h-full w-full overflow-hidden rounded-2xl ${playing ? "loop-breathe" : ""}`}
            >
              <Image
                src={single.coverUrl}
                alt={`${single.albumTitle} cover`}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          </div>
        )}

        {/* Said here because the artwork is the argument: the one person
            primed to hear that a cover is not the only cover is the person
            currently looking at one. Tappable text, not a card. */}
        {single.coverUrl && (
          <button
            type="button"
            onClick={onCoverContest}
            className="loop-muted mx-auto mt-3 block max-w-[17rem] text-center text-[11px] leading-relaxed underline decoration-ink/30 underline-offset-4"
          >
            This cover is mine. On the 26th the room picks the official one.
          </button>
        )}

        <div className="mt-6 text-center">
          <div className="loop-muted text-[11px] font-bold uppercase tracking-[0.3em]">
            The single
          </div>
          <h1 className="loop-display mt-1 text-5xl font-bold tracking-tight">
            {single.title}
          </h1>
          <div className="loop-muted mt-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
            {single.artistName} · from {single.albumTitle}
          </div>
        </div>

        {/* Nothing is said before the song. Doing arithmetic on someone's day
            in order to call it a price is a pitch, and a pitch is the one
            thing a gift cannot survive. Afterwards it is worth saying plainly
            that they keep it, because that is genuinely unusual. */}
        {heard && (
          <p className="mx-auto mt-5 max-w-[19rem] text-center text-sm leading-relaxed opacity-75">
            Yours to keep. No email, no account.
          </p>
        )}

        {/* The play control — the largest thing on the screen, by a distance. */}
        <div className="mt-7 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {/* The ring is real: it is currentTime, not decoration. It is also
              the only honest reactivity available here — see globals.css. */}
            <svg
              className="pointer-events-none absolute -rotate-90"
              width="124"
              height="124"
              viewBox="0 0 124 124"
              aria-hidden="true"
            >
              <circle
                cx="62"
                cy="62"
                r="57"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-ink/15"
              />
              <circle
                cx="62"
                cy="62"
                r="57"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-ink transition-[stroke-dashoffset] duration-300"
                strokeDasharray={2 * Math.PI * 57}
                strokeDashoffset={2 * Math.PI * 57 * (1 - pct / 100)}
              />
            </svg>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
              className="relative flex h-24 w-24 items-center justify-center rounded-full bg-ink text-sand transition-transform active:scale-95"
            >
              {playing ? (
                <svg
                  width="30"
                  height="34"
                  viewBox="0 0 30 34"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="9" height="30" fill="currentColor" />
                  <rect
                    x="19"
                    y="2"
                    width="9"
                    height="30"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  width="32"
                  height="34"
                  viewBox="0 0 32 34"
                  aria-hidden="true"
                >
                  <path d="M4 2 L30 17 L4 32 Z" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>

          <div className="loop-muted mt-4 flex w-full justify-between text-[10px] font-semibold tabular-nums tracking-widest">
            <span>{clock(t)}</span>
            <span>{single.durationLabel || clock(duration)}</span>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={single.audioUrl}
          preload="auto"
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            setT(a.currentTime);
            // Far enough in to have formed an opinion — that is when asking
            // someone to pass it on stops being a demand and starts being a
            // reasonable thing to ask.
            if (a.currentTime > 30) setHeard(true);
          }}
          onEnded={() => {
            setPlaying(false);
            setHeard(true);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />

        {/* ── the three doors ─────────────────────────────────────────── */}
        <div className="mt-9 space-y-3">
          {/* 1 · keep it */}
          {!isStandalone && (
            <div>
              <button
                type="button"
                onClick={keepIt}
                className="flex w-full items-center justify-between rounded-2xl border border-ink/20 px-5 py-4 text-left transition-colors hover:bg-ink/5"
              >
                <span>
                  <span className="block text-sm font-bold">Keep it</span>
                  <span className="loop-muted block text-[11px]">
                    Put Loop Soul on your home screen
                  </span>
                </span>
                <span className="opacity-40">↓</span>
              </button>
              {iosHelp && (
                <p className="loop-muted mt-2 px-5 text-[11px] leading-relaxed">
                  Tap the <strong>Share</strong> button in your browser bar,
                  scroll down, then choose <strong>Add to Home Screen</strong>.
                </p>
              )}
            </div>
          )}

          {/* 2 · pass it on */}
          <div
            className={`rounded-2xl border px-5 py-4 transition-colors ${heard ? "border-ink/40 bg-ink/5" : "border-ink/20"}`}
          >
            <div className="text-sm font-bold">Pass it on</div>
            <div className="loop-muted mt-0.5 text-[11px]">
              {code
                ? reached === null
                  ? "Your link is ready."
                  : reached === 0
                    ? "Nobody's opened your link yet."
                    : `${reached} ${reached === 1 ? "person has" : "people have"} heard it through you.`
                : "Send it on with your name on it, not just a link."}
            </div>
            <div className="mt-3 flex gap-2">
              {!code && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your first name"
                  maxLength={24}
                  className="min-w-0 flex-1 rounded-full border border-ink/25 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:opacity-40 focus:border-ink/60"
                />
              )}
              <button
                type="button"
                onClick={share}
                disabled={minting || (!code && !name.trim())}
                className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-sand transition-transform active:scale-95 disabled:opacity-35"
              >
                {copied
                  ? "Copied"
                  : minting
                    ? "…"
                    : code
                      ? "Share"
                      : "Get link"}
              </button>
            </div>
          </div>

          {/* 3 · the rest of it, live */}
          <button
            type="button"
            onClick={onGetPass}
            className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-4 text-left text-sand transition-transform active:scale-95"
          >
            <span>
              <span className="block text-sm font-bold">
                Hear the rest of it live
              </span>
              <span className="block text-[11px] opacity-70">
                All 14, played front to back · Sept 26
              </span>
            </span>
            <span className="opacity-60">→</span>
          </button>
        </div>

        <p className="loop-muted mx-auto mt-6 max-w-[19rem] text-center text-[11px] leading-relaxed">
          This album isn&apos;t streaming anywhere. September 26th is its first
          exhibition.
        </p>
      </div>
    </motion.div>
  );
}

export default TheSingle;
