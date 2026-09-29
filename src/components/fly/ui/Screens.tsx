'use client';

import type { ReactNode } from 'react';

/**
 * The flight's screens, in the house style: type and hairline rules, whole
 * lines tappable, one drawn shape only where it earns it (Again).
 */

export interface RunResult {
  score: number;
  best: number;
  isNewBest: boolean;
  bestChain: number;
  portals: number;
  seconds: number;
}

const HAIRLINE = 'rgba(26, 23, 22, 0.16)';
const format = (n: number) => Math.floor(n).toLocaleString('en-US');

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-[0.34em] opacity-70">{children}</div>;
}

function Row({ label, note, onSelect }: { label: string; note?: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="pointer-events-auto flex min-h-[64px] w-full items-center justify-between border-t text-left transition-opacity active:opacity-60"
      style={{ borderColor: HAIRLINE }}
    >
      <span className="text-[24px] font-bold uppercase tracking-[0.16em]">{label}</span>
      {note ? <span className="text-[11px] font-bold uppercase tracking-[0.22em] opacity-60">{note}</span> : null}
    </button>
  );
}

function Veil({ children, strength }: { children: ReactNode; strength: number }) {
  return (
    <div
      className="absolute inset-0 flex flex-col justify-between px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]"
      style={{ background: `rgba(236, 229, 214, ${strength})` }}
    >
      <div className="mx-auto flex h-full w-full max-w-[460px] flex-col justify-between">{children}</div>
    </div>
  );
}

export function TitleScreen({ best, onDive, onDrift }: { best: number; onDive: () => void; onDrift: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]">
      {/* Veils at top and bottom keep the type legible; the flight shows between. */}
      <div
        className="absolute inset-x-0 top-0 h-[38%]"
        style={{ background: 'linear-gradient(to bottom, rgba(236,229,214,0.92), rgba(236,229,214,0))' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[46%]"
        style={{ background: 'linear-gradient(to top, rgba(236,229,214,0.95), rgba(236,229,214,0))' }}
      />
      <div className="relative mx-auto w-full max-w-[460px]">
        <Eyebrow>Recoolman</Eyebrow>
        {/* The site sets headings in Baskerville; the flight speaks Jost throughout. */}
        <h1 className="mt-2 text-[44px] font-bold uppercase leading-[0.92] tracking-[0.02em]" style={{ fontFamily: 'inherit' }}>
          Into the
          <br />
          World
        </h1>
      </div>
      <div className="relative mx-auto w-full max-w-[460px]">
        <Row label="Dive" note={best > 0 ? `Best ${format(best)}` : 'One touch ends it'} onSelect={onDive} />
        <Row label="Drift" note="Endless" onSelect={onDrift} />
        <div className="border-t pt-3 text-[11px] font-bold uppercase tracking-[0.3em] opacity-50" style={{ borderColor: HAIRLINE }}>
          Slide to steer
        </div>
      </div>
    </div>
  );
}

export function PausedScreen({ onResume, onTitle }: { onResume: () => void; onTitle: () => void }) {
  return (
    <Veil strength={0.7}>
      <Eyebrow>Paused</Eyebrow>
      <div className="pointer-events-auto">
        <Row label="Resume" onSelect={onResume} />
        <Row label="Title" onSelect={onTitle} />
      </div>
    </Veil>
  );
}

export function GameOverScreen({
  result,
  onAgain,
  onDrift,
  onTitle,
}: {
  result: RunResult;
  onAgain: () => void;
  onDrift: () => void;
  onTitle: () => void;
}) {
  return (
    <Veil strength={0.72}>
      <div>
        <Eyebrow>Score</Eyebrow>
        <div className="mt-1 text-[72px] font-bold leading-none tabular-nums tracking-[-0.01em]">{format(result.score)}</div>
        <div className="mt-3 text-[12px] font-bold uppercase tracking-[0.26em]">
          {result.isNewBest ? 'New best' : `Best ${format(result.best)}`}
        </div>
        <div className="mt-6 flex gap-8 border-t pt-3 text-[11px] font-bold uppercase tracking-[0.22em] opacity-70" style={{ borderColor: HAIRLINE }}>
          <span>Longest chain {format(result.bestChain)}</span>
          <span>Portals {result.portals}</span>
        </div>
      </div>
      <div className="pointer-events-auto">
        <button
          type="button"
          onClick={onAgain}
          className="mb-5 w-full rounded-full py-4 text-center text-[15px] font-bold uppercase tracking-[0.3em] transition-transform active:scale-95"
          style={{ background: '#1a1716', color: '#ece5d6' }}
        >
          Again
        </button>
        <Row label="Drift" note="No score, no end" onSelect={onDrift} />
        <Row label="Title" onSelect={onTitle} />
      </div>
    </Veil>
  );
}
