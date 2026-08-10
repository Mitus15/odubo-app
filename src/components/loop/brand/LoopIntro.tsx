"use client";

import { useEffect, useRef, useState } from "react";
import { INFINITY_D } from "./LoopLoader";

/**
 * LoopIntro — the brand moment on a fresh page load.
 *
 * A glowing comet traces the infinity loop while the app loads ("the magic
 * working"). Once the page is ready, the comet completes its draw and leaves
 * the full infinity lit up — the event's logo — holds a beat, then the ink
 * overlay fades up to reveal the page.
 *
 * It is phase-agnostic: always an ink field with an sand comet, so it reads
 * as a deliberate brand moment regardless of which state (sand Gathering /
 * ink Legacy) is underneath. Mounted once in the root layout, it plays once per
 * full page load — refresh replays it; client-side navigation does not.
 *
 * Robustness: the reveal runs on a guaranteed CSS failsafe (the overlay always
 * clears, even if JS stalls or is disabled). JS only *fast-forwards* completion
 * once `window` load / `readyState === "complete"` fires — clamped so it always
 * shows for at least a beat and never hangs.
 */

const MIN_MS = 1000; // always let the comet breathe at least this long
const MAX_MS = 3200; // hard cap — never trap the page behind the intro

export default function LoopIntro() {
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      const elapsed = performance.now() - startRef.current;
      const wait = Math.max(0, MIN_MS - elapsed);
      window.setTimeout(() => setReady(true), wait);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
    }
    const cap = window.setTimeout(finish, MAX_MS);

    return () => {
      window.removeEventListener("load", finish);
      window.clearTimeout(cap);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`loop-intro${ready ? " is-ready" : ""}`}
      aria-hidden="true"
      onAnimationEnd={(e) => {
        // Unmount only after the overlay's fade-out finishes.
        if (e.animationName === "intro-out") setGone(true);
      }}
    >
      <svg
        className="intro-mark"
        viewBox="0 0 100 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Faint rail. */}
        <path d={INFINITY_D} className="intro-rail" pathLength={1} />
        {/* The lit logo — drawn on at completion, then held. */}
        <path d={INFINITY_D} className="intro-draw" pathLength={1} />
        {/* Comet (tail → nucleus), looping while loading. */}
        <path d={INFINITY_D} className="intro-comet intro-tail" pathLength={1} />
        <path d={INFINITY_D} className="intro-comet intro-mid" pathLength={1} />
        <path d={INFINITY_D} className="intro-comet intro-core" pathLength={1} />
      </svg>

      <style>{`
        .loop-intro {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-ink, #2a0f0a);
          /* Failsafe: even with no JS, clear the overlay so the page is reachable. */
          animation: intro-failsafe 0ms linear forwards;
          animation-delay: ${MAX_MS + 700}ms;
        }
        .intro-mark {
          width: min(58vw, 300px);
          height: auto;
          overflow: visible;
          color: var(--color-sand, #d9aa7a);
        }
        .intro-mark path {
          fill: none;
          stroke-linecap: round;
          stroke-width: 4;
        }
        .intro-rail { stroke: var(--color-sand, #d9aa7a); opacity: 0.12; }

        /* Comet — same stacked-dash technique as LoopLoader, scaled up + glow. */
        .intro-comet {
          stroke: var(--color-sand, #d9aa7a);
          stroke-dashoffset: 0;
          animation: loop-run 1.5s linear infinite;
        }
        .intro-tail { stroke-dasharray: 0.26 0.74; opacity: 0.35; }
        .intro-mid  { stroke-dasharray: 0.13 0.87; opacity: 0.75; }
        .intro-core {
          stroke: var(--color-sand-bright, #f0d3ad);
          stroke-dasharray: 0.05 0.95;
          stroke-width: 4.5;
          filter: drop-shadow(0 0 4px var(--color-sand, #d9aa7a))
                  drop-shadow(0 0 9px var(--color-sand-deep, #9c5f3c));
        }

        /* The lit logo — hidden until completion. */
        .intro-draw {
          stroke: var(--color-sand-bright, #f0d3ad);
          stroke-dasharray: 1 1;
          stroke-dashoffset: 1;
          opacity: 0;
          filter: drop-shadow(0 0 6px var(--color-sand, #d9aa7a))
                  drop-shadow(0 0 16px var(--color-sand-deep, #9c5f3c));
        }

        @keyframes loop-run {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: 1; }
        }

        /* ── Completion (page is ready) ─────────────────────────────── */
        .loop-intro.is-ready .intro-comet {
          animation: none;
          opacity: 0;
          transition: opacity 0.35s ease;
        }
        .loop-intro.is-ready .intro-draw {
          opacity: 1;
          animation: intro-draw 0.6s var(--ease-soul, ease-out) forwards;
        }
        /* Fade the ink overlay up after the draw + a held beat. */
        .loop-intro.is-ready {
          animation: intro-out 0.6s ease 0.95s forwards;
        }

        @keyframes intro-draw {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes intro-out {
          from { opacity: 1; }
          to   { opacity: 0; visibility: hidden; pointer-events: none; }
        }
        @keyframes intro-failsafe {
          to { opacity: 0; visibility: hidden; pointer-events: none; }
        }

        /* ── Reduced motion: no chase. Show the lit mark, then reveal. ── */
        @media (prefers-reduced-motion: reduce) {
          .intro-comet { display: none; }
          .intro-rail { opacity: 0; }
          .intro-draw { opacity: 1; stroke-dasharray: none; stroke-dashoffset: 0; }
          .loop-intro { animation: intro-out 0.4s ease 0.6s forwards; }
        }
      `}</style>
    </div>
  );
}
