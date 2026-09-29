'use client';

import type { FlyRuntime } from '../runtime';

const GLOW = '0 0 14px rgba(236, 229, 214, 0.95), 0 0 2px rgba(236, 229, 214, 0.9)';

/**
 * The HUD's elements. Their contents are written straight from the render
 * loop (see HudDriver); React only decides which of them are on screen.
 */
export function Hud({
  runtime,
  running,
  hint,
  debug,
  onPause,
}: {
  runtime: FlyRuntime;
  running: boolean;
  hint: boolean;
  debug: boolean;
  onPause: () => void;
}) {
  const hud = runtime.hud;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ textShadow: GLOW }}>
      <div ref={(el) => void (hud.bursts = el)} className="absolute inset-0" />

      <div
        ref={(el) => void (hud.chain = el)}
        className="absolute left-0 top-0 text-[17px] font-bold tabular-nums opacity-0 transition-opacity duration-150"
      />

      {running ? (
        <>
          <button
            type="button"
            aria-label="Pause"
            onClick={onPause}
            className="pointer-events-auto absolute left-[max(10px,env(safe-area-inset-left))] top-[max(10px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center gap-[5px]"
          >
            <span className="h-4 w-[3px] bg-current" />
            <span className="h-4 w-[3px] bg-current" />
          </button>
          <div
            ref={(el) => void (hud.score = el)}
            className="absolute right-[max(18px,env(safe-area-inset-right))] top-[max(14px,env(safe-area-inset-top))] text-[32px] font-bold leading-none tabular-nums"
          />
        </>
      ) : null}

      {hint ? (
        <div className="absolute inset-x-0 bottom-[max(34px,env(safe-area-inset-bottom))] flex flex-col items-center gap-2 text-[11px] font-bold uppercase tracking-[0.34em] opacity-70">
          <span className="flex items-center gap-3">
            <span className="h-px w-8 bg-current" />
            Slide to steer
            <span className="h-px w-8 bg-current" />
          </span>
        </div>
      ) : null}

      {debug ? (
        <div
          ref={(el) => void (hud.debug = el)}
          className="absolute bottom-1 left-1 font-mono text-[10px] opacity-70"
          style={{ textShadow: 'none' }}
        />
      ) : null}

      <div
        ref={(el) => void (hud.flash = el)}
        className="absolute inset-0 opacity-0"
        style={{ background: '#fbf8f1' }}
      />
    </div>
  );
}
