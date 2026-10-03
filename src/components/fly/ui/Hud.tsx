'use client';

import type { FlyRuntime } from '../runtime';

/**
 * The HUD's elements. Their contents are written straight from the render
 * loop (see HudDriver); React only decides which of them are on screen.
 *
 * Depth is the one number. Under it, how far ahead of (or behind) your best
 * run you are; along the top, how much of the song is left; along the
 * bottom, flow, which is speed.
 */
export function Hud({
  runtime,
  running,
  album,
  showGhost,
  hint,
  title,
  debug,
  ink,
  halo,
  onPause,
}: {
  runtime: FlyRuntime;
  running: boolean;
  album: boolean;
  showGhost: boolean;
  hint: boolean;
  /** The song's title, shown for a moment as its level begins. */
  title: string | null;
  debug: boolean;
  ink: string;
  halo: string;
  onPause: () => void;
}) {
  const hud = runtime.hud;
  const glow = `0 0 14px ${halo}, 0 0 2px ${halo}`;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ color: ink, textShadow: glow }}>
      <div ref={(el) => void (hud.bursts = el)} className="absolute inset-0" />

      {running ? (
        <>
          <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `${ink}22` }}>
            <div ref={(el) => void (hud.progress = el)} className="h-full" style={{ width: '0%', background: ink }} />
          </div>
          <button
            type="button"
            aria-label="Pause"
            onClick={onPause}
            className="pointer-events-auto absolute left-[max(10px,env(safe-area-inset-left))] top-[max(10px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center gap-[5px]"
          >
            <span className="h-4 w-[3px] bg-current" />
            <span className="h-4 w-[3px] bg-current" />
          </button>
          <div className="absolute right-[max(18px,env(safe-area-inset-right))] top-[max(14px,env(safe-area-inset-top))] flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span ref={(el) => void (hud.depth = el)} className="text-[34px] font-bold leading-none tabular-nums" />
              <span className="text-[13px] font-bold uppercase tracking-[0.2em] opacity-70">m</span>
            </div>
            {showGhost ? (
              <span ref={(el) => void (hud.ghostDelta = el)} className="mt-1 text-[13px] font-bold tabular-nums opacity-75" />
            ) : null}
            {album ? (
              <span ref={(el) => void (hud.total = el)} className="mt-1 text-[11px] font-bold uppercase tracking-[0.24em] opacity-60" />
            ) : null}
          </div>
          <div className="absolute inset-x-[22%] bottom-[max(18px,env(safe-area-inset-bottom))] h-[2px]" style={{ background: `${ink}22` }}>
            <div ref={(el) => void (hud.flow = el)} className="mx-auto h-full" style={{ width: '0%', background: ink }} />
          </div>
        </>
      ) : null}

      {title ? (
        <div className="absolute inset-x-0 top-[24%] flex flex-col items-center gap-2 text-center">
          <span className="text-[11px] font-bold uppercase tracking-[0.34em] opacity-70">Now falling</span>
          <span className="text-[30px] font-bold uppercase leading-none tracking-[0.06em]">{title}</span>
        </div>
      ) : null}

      <div
        ref={(el) => void (hud.stall = el)}
        className="absolute inset-x-0 top-[58%] text-center text-[11px] font-bold uppercase tracking-[0.34em] opacity-0 transition-opacity duration-300"
      >
        Loading the song
      </div>

      {hint ? (
        <div className="absolute inset-x-0 bottom-[max(46px,env(safe-area-inset-bottom))] flex flex-col items-center gap-2 text-[11px] font-bold uppercase tracking-[0.34em] opacity-70">
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
          className="absolute bottom-1 left-1 right-1 font-mono text-[10px] opacity-70"
          style={{ textShadow: 'none' }}
        />
      ) : null}

      <div ref={(el) => void (hud.flash = el)} className="absolute inset-0 opacity-0" style={{ background: '#fbf8f1' }} />
    </div>
  );
}
