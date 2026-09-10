"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { angleToFrac, stepFrac } from "@/lib/loop/scrub";
import type { FeaturedSingle } from "@/lib/loop/single";

/**
 * The record: artwork, the play control, and the ring you can drag like vinyl.
 *
 * Split out of TheSingle for one reason — `timeupdate` fires about four times a
 * second, and while the player lived in the same component every tick
 * re-rendered the cover, the three doors and the text field someone might be
 * typing their name into. So NOTHING here is React state that changes during
 * playback: the ring's dash offset and the clock are written straight to the
 * DOM through refs. The component renders when you press play or pause, and
 * otherwise sits still while the song runs.
 *
 * There is deliberately no waveform. The audio is served through a redirect to
 * R2, which returns no access-control-allow-origin, so an AnalyserNode would
 * read silence and routing a tainted element through the graph can mute
 * playback outright. Everything that moves here is either real progress or
 * honest ornament (see globals.css).
 */

const R = 57; // ring radius, in the SVG's own units
const C = 2 * Math.PI * R;
const BOX = 160; // the SVG is the drag surface, so it is bigger than the ring

function clock(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function SinglePlayer({
  single,
  coverUrl,
  onHeard,
  onCoverContest,
  coverCaption,
}: {
  single: FeaturedSingle;
  /** Resolved per visitor — NOT single.coverUrl, which is only the owner's. */
  coverUrl: string | null;
  /** Fired once, when they are far enough in to have an opinion. */
  onHeard: () => void;
  onCoverContest: () => void;
  coverCaption: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const progressRef = useRef<SVGCircleElement | null>(null);
  const clockRef = useRef<HTMLSpanElement | null>(null);
  const durationRef = useRef<number>(single.duration || 0);
  const heardRef = useRef(false);

  // Scrub state is a ref, not React state: it changes on every pointer move
  // and none of it belongs on screen except through the two DOM writes below.
  const drag = useRef({
    active: false,
    lastFrac: 0,
    pos: 0,
    startX: 0,
    startY: 0,
    startedAt: 0,
    moved: false,
    lastSeek: 0,
  });

  const [playing, setPlaying] = useState(false);

  /** The only two things that move while the record plays. */
  const paint = useCallback((seconds: number) => {
    const d = durationRef.current;
    const frac = d > 0 ? Math.min(1, Math.max(0, seconds / d)) : 0;
    if (progressRef.current) {
      progressRef.current.style.strokeDashoffset = String(C * (1 - frac));
    }
    if (clockRef.current) clockRef.current.textContent = clock(seconds);
    svgRef.current?.setAttribute(
      "aria-valuenow",
      String(Math.round(frac * 100)),
    );
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // Called straight out of the click handler and never awaited behind a
      // readyState check — that is what breaks playback on mobile Safari.
      void a
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, []);

  /* ── the vinyl ───────────────────────────────────────────────────────── */

  const fracFromEvent = (e: React.PointerEvent<SVGSVGElement>): number => {
    const r = e.currentTarget.getBoundingClientRect();
    // Measured in screen space, so the SVG's own −90° rotation is irrelevant.
    return angleToFrac(
      r.left + r.width / 2,
      r.top + r.height / 2,
      e.clientX,
      e.clientY,
    );
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const a = audioRef.current;
    if (!a || durationRef.current <= 0) return;
    try {
      // Throws if the pointer is already gone (Safari does this on a fast
      // tap). Capture is an optimisation — the drag still tracks without it —
      // so losing it must never cost the gesture.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no capture; move events still arrive while the pointer is over us */
    }
    e.currentTarget.dataset.scrubbing = "";
    const d = drag.current;
    d.active = true;
    d.lastFrac = fracFromEvent(e);
    d.pos = a.currentTime / durationRef.current;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.startedAt = performance.now();
    d.moved = false;
    d.lastSeek = 0;
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d.active) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6)
      d.moved = true;

    const next = fracFromEvent(e);
    d.pos = stepFrac(d.pos, d.lastFrac, next);
    d.lastFrac = next;

    const seconds = d.pos * durationRef.current;
    paint(seconds); // every frame — it is two DOM writes

    // The seek itself is throttled: setting currentTime forces the element to
    // re-buffer, and doing that on every pointer move makes the audio stutter
    // for the whole drag on a phone.
    const now = performance.now();
    if (now - d.lastSeek > 120 && audioRef.current) {
      audioRef.current.currentTime = seconds;
      d.lastSeek = now;
    }
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    delete e.currentTarget.dataset.scrubbing;

    const a = audioRef.current;
    if (!a) return;
    // A tap on the ring is a seek to that point, not a drag from wherever the
    // playhead happened to be.
    if (!d.moved && performance.now() - d.startedAt < 250) {
      d.pos = fracFromEvent(e);
    }
    const seconds = d.pos * durationRef.current;
    a.currentTime = seconds;
    paint(seconds);
  };

  // Keep the ring honest if the track changes underneath us.
  useEffect(() => {
    durationRef.current = single.duration || durationRef.current;
    paint(0);
  }, [single.audioUrl, single.duration, paint]);

  return (
    <div className="flex w-full flex-col items-center">
      {coverUrl && (
        <div className="relative mx-auto aspect-square w-[min(62vw,240px)]">
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
              src={coverUrl}
              alt={`${single.albumTitle} cover`}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        </div>
      )}

      {coverUrl && (
        <button
          type="button"
          onClick={onCoverContest}
          className="loop-muted mx-auto mt-3 block max-w-[17rem] text-center text-[11px] leading-relaxed underline decoration-ink/30 underline-offset-4"
        >
          {coverCaption}
        </button>
      )}

      <div className="mt-5 text-center">
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

      <div className="mt-6 flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          {/* The SVG is the drag surface, not just a drawing: it is wider than
              the ring so the grabbable annulus between the button edge and the
              rim is ~32px rather than the 9px the ring itself would give. */}
          <svg
            ref={svgRef}
            className="loop-ring absolute -rotate-90 touch-none select-none"
            width={BOX}
            height={BOX}
            viewBox={`0 0 ${BOX} ${BOX}`}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* Catches pointers anywhere in the box, including the gaps. */}
            <circle cx={BOX / 2} cy={BOX / 2} r={BOX / 2} fill="transparent" />
            <circle
              cx={BOX / 2}
              cy={BOX / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-ink/15"
            />
            <circle
              ref={progressRef}
              cx={BOX / 2}
              cy={BOX / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="loop-ring-progress text-ink transition-[stroke-dashoffset] duration-300"
              strokeDasharray={C}
              strokeDashoffset={C}
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
                <rect x="19" y="2" width="9" height="30" fill="currentColor" />
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
          <span ref={clockRef}>0:00</span>
          <span>{single.durationLabel || clock(durationRef.current)}</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={single.audioUrl}
        preload="auto"
        onLoadedMetadata={(e) => {
          // The database duration can be null; the element always knows.
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) durationRef.current = d;
        }}
        onTimeUpdate={(e) => {
          if (drag.current.active) return; // the finger is the authority
          const t = e.currentTarget.currentTime;
          paint(t);
          if (!heardRef.current && t > 30) {
            heardRef.current = true;
            onHeard();
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          if (!heardRef.current) {
            heardRef.current = true;
            onHeard();
          }
        }}
      />
    </div>
  );
}

export default SinglePlayer;
