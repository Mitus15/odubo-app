"use client";

/**
 * LoopLoader — the signature Loop Soul loading state.
 *
 * A comet (a crisp, bright nucleus with a tight luminous trail) races around
 * an infinity / "loop" path (echoing the "oo" of the loop Soul wordmark). Per
 * the spec, EVERY async action (votes, fetches, image processing) surfaces this,
 * so it is intentionally tiny, dependency-free (pure SVG + CSS), and inherits
 * `currentColor` so it reads on both the green poster field and the ink vault.
 *
 * The same path + comet drives the full-screen brand intro (see LoopIntro).
 */

/** The shared lemniscate. pathLength is normalised to 1 so dash maths is portable. */
export const INFINITY_D =
  "M25 25 C25 12, 45 12, 50 25 C55 38, 75 38, 75 25 C75 12, 55 12, 50 25 C45 38, 25 38, 25 25 Z";

type LoopLoaderProps = {
  /** pixel size of the loader (height is half of this — the path is 2:1). */
  size?: number;
  /** stroke colour comes from `currentColor`; pass layout classes here. */
  className?: string;
  label?: string;
};

export function LoopLoader({ size = 48, className, label = "Loading" }: LoopLoaderProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={className}
      style={{ display: "inline-flex", color: "inherit" }}
    >
      <svg
        width={size}
        height={size * 0.5}
        viewBox="0 0 100 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Faint rail so the loop's shape still reads between comet passes. */}
        <path
          d={INFINITY_D}
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={1}
          className="loop-rail"
        />
        {/* Comet: three chasing dashes sharing one origin → bright nucleus that
            fades into a tight trail. Animating dashoffset 0→1 sends the pattern
            backward along the path, so the stacked (brightest) end leads. */}
        <path d={INFINITY_D} stroke="currentColor" strokeWidth="5" strokeLinecap="round" pathLength={1} className="loop-comet loop-tail" />
        <path d={INFINITY_D} stroke="currentColor" strokeWidth="5" strokeLinecap="round" pathLength={1} className="loop-comet loop-mid" />
        <path d={INFINITY_D} stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" pathLength={1} className="loop-comet loop-core" />
      </svg>
      <style>{`
        .loop-rail { opacity: 0.14; }
        .loop-comet {
          stroke-dashoffset: 0;
          animation: loop-run 1.3s linear infinite;
        }
        .loop-tail { stroke-dasharray: 0.24 0.76; opacity: 0.4; }
        .loop-mid  { stroke-dasharray: 0.12 0.88; opacity: 0.8; }
        .loop-core {
          stroke-dasharray: 0.045 0.955;
          opacity: 1;
          filter: drop-shadow(0 0 2px currentColor);
        }
        @keyframes loop-run {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          /* Hold a calm, readable mark instead of a frozen comet. */
          .loop-comet { animation: none; }
          .loop-rail { opacity: 0.5; }
          .loop-tail, .loop-mid { display: none; }
          .loop-core { stroke-dasharray: none; opacity: 0.9; }
        }
      `}</style>
    </span>
  );
}

export default LoopLoader;
