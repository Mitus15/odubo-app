'use client';

import type { ReactNode } from 'react';
import type { LevelDef } from '@/lib/fly/album';
import { medalDepths, type Medal } from '@/lib/fly/rules';

/**
 * The fall's screens, in the house style: type and hairline rules, whole
 * lines tappable, one drawn shape only where it earns it (Again).
 */

export interface LevelBest {
  depth: number;
  medal: Medal;
}

export interface LevelResult {
  level: LevelDef;
  depth: number;
  medal: Medal;
  best: number;
  isBest: boolean;
  /** How far past (or short of) the previous best (m); null on a first run. */
  againstBest: number | null;
  /** A tuning run (?t, ?flow): shown, never saved. */
  practice: boolean;
}

export interface AlbumLine {
  slug: string;
  title: string;
  depth: number;
  medal: Medal;
}

export interface AlbumResult {
  total: number;
  lines: AlbumLine[];
  /** True when the run covered all ten levels: only then is it an album best. */
  complete: boolean;
  best: number;
  isBest: boolean;
}

interface Tone {
  ink: string;
  field: string;
}

const format = (n: number) => Math.floor(n).toLocaleString('en-US');
const MEDAL_WORD: Record<Exclude<Medal, null>, string> = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

function hairline(tone: Tone): string {
  return `${tone.ink}29`;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-[0.34em] opacity-70">{children}</div>;
}

function Row({
  label,
  note,
  onSelect,
  tone,
  dim,
}: {
  label: string;
  note?: string;
  onSelect: () => void;
  tone: Tone;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="pointer-events-auto flex min-h-[60px] w-full items-center justify-between gap-4 border-t text-left transition-opacity active:opacity-60"
      style={{ borderColor: hairline(tone), opacity: dim ? 0.55 : 1 }}
    >
      <span className="text-[22px] font-bold uppercase leading-tight tracking-[0.14em]">{label}</span>
      {note ? <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.22em] opacity-60">{note}</span> : null}
    </button>
  );
}

function Again({ onSelect, tone }: { onSelect: () => void; tone: Tone }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="pointer-events-auto mb-5 w-full rounded-full py-4 text-center text-[15px] font-bold uppercase tracking-[0.3em] transition-transform active:scale-95"
      style={{ background: tone.ink, color: tone.field }}
    >
      Again
    </button>
  );
}

function Veil({ children, tone, strength }: { children: ReactNode; tone: Tone; strength: number }) {
  return (
    <div
      className="absolute inset-0 flex flex-col px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]"
      style={{ background: `${tone.field}${Math.round(strength * 255).toString(16).padStart(2, '0')}`, color: tone.ink }}
    >
      <div className="mx-auto flex h-full w-full max-w-[460px] flex-col justify-between">{children}</div>
    </div>
  );
}

function medalNote(best: LevelBest | undefined): string | undefined {
  if (!best || best.depth <= 0) return undefined;
  return best.medal ? `${MEDAL_WORD[best.medal]} · ${format(best.depth)}` : format(best.depth);
}

export function TitleScreen({
  tone,
  continueFrom,
  onAlbum,
  onAlbumFromStart,
  onSongs,
}: {
  tone: Tone;
  /** The level an unfinished album run reached, if any. */
  continueFrom: LevelDef | null;
  onAlbum: () => void;
  onAlbumFromStart: () => void;
  onSongs: () => void;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col justify-between px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]"
      style={{ color: tone.ink }}
    >
      {/* Veils at top and bottom keep the type legible; the fall shows between. */}
      <div className="absolute inset-x-0 top-0 h-[34%]" style={{ background: `linear-gradient(to bottom, ${tone.field}eb, ${tone.field}00)` }} />
      <div className="absolute inset-x-0 bottom-0 h-[40%]" style={{ background: `linear-gradient(to top, ${tone.field}f2, ${tone.field}00)` }} />
      <div className="relative mx-auto w-full max-w-[460px]">
        <Eyebrow>Recoolman</Eyebrow>
        {/* The site sets headings in Baskerville; the fall speaks Jost throughout. */}
        <h1 className="mt-2 text-[44px] font-bold uppercase leading-[0.92] tracking-[0.02em]" style={{ fontFamily: 'inherit' }}>
          Into the
          <br />
          World
        </h1>
      </div>
      <div className="relative mx-auto w-full max-w-[460px]">
        <Row
          label="Album"
          note={continueFrom ? `Continue · ${continueFrom.title}` : 'From heaven to the ground'}
          onSelect={onAlbum}
          tone={tone}
        />
        <Row label="Songs" note="Ten levels" onSelect={onSongs} tone={tone} />
        <div
          className="flex items-center justify-between border-t pt-3 text-[11px] font-bold uppercase tracking-[0.3em]"
          style={{ borderColor: hairline(tone) }}
        >
          <span className="opacity-50">Slide to steer</span>
          {continueFrom ? (
            <button type="button" onClick={onAlbumFromStart} className="pointer-events-auto -my-3 py-3 opacity-70">
              From the beginning
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SongsScreen({
  tone,
  levels,
  bests,
  onPlay,
  onBack,
}: {
  tone: Tone;
  levels: readonly LevelDef[];
  bests: Record<string, LevelBest | undefined>;
  onPlay: (level: LevelDef) => void;
  onBack: () => void;
}) {
  return (
    <Veil tone={tone} strength={0.84}>
      <div className="flex items-center justify-between">
        <Eyebrow>Songs</Eyebrow>
        <button type="button" onClick={onBack} className="pointer-events-auto -mr-2 px-2 py-2 text-[11px] font-bold uppercase tracking-[0.3em] opacity-70">
          Back
        </button>
      </div>
      <div className="pointer-events-auto -mx-1 mt-4 flex-1 overflow-y-auto px-1" style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
        {levels.map((level) => (
          <Row
            key={level.slug}
            label={`${level.index}  ${level.title}`}
            note={medalNote(bests[level.slug])}
            onSelect={() => onPlay(level)}
            tone={tone}
          />
        ))}
      </div>
    </Veil>
  );
}

export function PausedScreen({ tone, onResume, onLeave }: { tone: Tone; onResume: () => void; onLeave: () => void }) {
  return (
    <Veil tone={tone} strength={0.72}>
      <Eyebrow>Paused</Eyebrow>
      <div className="pointer-events-auto">
        <Row label="Resume" onSelect={onResume} tone={tone} />
        <Row label="Leave" onSelect={onLeave} tone={tone} />
      </div>
    </Veil>
  );
}

export function LevelResultScreen({
  tone,
  result,
  hasNext,
  onAgain,
  onNext,
  onSongs,
  onTitle,
}: {
  tone: Tone;
  result: LevelResult;
  hasNext: boolean;
  onAgain: () => void;
  onNext: () => void;
  onSongs: () => void;
  onTitle: () => void;
}) {
  const medals = medalDepths(result.level.seconds, result.level.medals);
  const nextMedal =
    result.medal === 'gold'
      ? null
      : result.medal === 'silver'
        ? `Gold at ${format(medals.gold)}`
        : result.medal === 'bronze'
          ? `Silver at ${format(medals.silver)}`
          : `Bronze at ${format(medals.bronze)}`;
  return (
    <Veil tone={tone} strength={0.78}>
      <div>
        <Eyebrow>{result.level.title}</Eyebrow>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[72px] font-bold leading-none tabular-nums tracking-[-0.01em]">{format(result.depth)}</span>
          <span className="text-[15px] font-bold uppercase tracking-[0.2em] opacity-70">m</span>
        </div>
        <div className="mt-3 text-[12px] font-bold uppercase tracking-[0.26em]">
          {[result.medal ? MEDAL_WORD[result.medal] : null, nextMedal].filter(Boolean).join(' · ')}
        </div>
        <div className="mt-6 border-t pt-3 text-[11px] font-bold uppercase tracking-[0.22em] opacity-70" style={{ borderColor: hairline(tone) }}>
          {result.practice
            ? 'Practice · not saved'
            : result.isBest
            ? result.againstBest === null
              ? 'First fall'
              : `New best · +${format(result.againstBest)}`
            : `Best ${format(result.best)} · −${format(result.best - result.depth)}`}
        </div>
      </div>
      <div className="pointer-events-auto">
        <Again onSelect={onAgain} tone={tone} />
        {hasNext ? <Row label="Next song" onSelect={onNext} tone={tone} /> : null}
        <Row label="Songs" onSelect={onSongs} tone={tone} />
        <Row label="Title" onSelect={onTitle} tone={tone} />
      </div>
    </Veil>
  );
}

export function AlbumResultScreen({
  tone,
  result,
  onAgain,
  onSongs,
  onTitle,
}: {
  tone: Tone;
  result: AlbumResult;
  onAgain: () => void;
  onSongs: () => void;
  onTitle: () => void;
}) {
  return (
    <Veil tone={tone} strength={0.82}>
      <div className="flex min-h-0 flex-1 flex-col">
        <Eyebrow>{result.complete ? 'The album' : 'So far'}</Eyebrow>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[64px] font-bold leading-none tabular-nums tracking-[-0.01em]">{format(result.total)}</span>
          <span className="text-[15px] font-bold uppercase tracking-[0.2em] opacity-70">m</span>
        </div>
        <div className="mt-3 text-[12px] font-bold uppercase tracking-[0.26em]">
          {result.complete ? (result.isBest ? 'New album best' : `Album best ${format(result.best)}`) : 'Unfinished'}
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          {result.lines.map((line) => (
            <div
              key={line.slug}
              className="flex items-baseline justify-between border-t py-2 text-[12px] font-bold uppercase tracking-[0.18em]"
              style={{ borderColor: hairline(tone) }}
            >
              <span>{line.title}</span>
              <span className="tabular-nums opacity-70">
                {line.medal ? `${MEDAL_WORD[line.medal]} · ` : ''}
                {format(line.depth)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-auto pt-4">
        <Again onSelect={onAgain} tone={tone} />
        <Row label="Songs" onSelect={onSongs} tone={tone} />
        <Row label="Title" onSelect={onTitle} tone={tone} />
      </div>
    </Veil>
  );
}

/** Over a cutscene: nothing but a way out of it. */
export function CutsceneOverlay({ tone, onSkip }: { tone: Tone; onSkip: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ color: tone.ink }}>
      <button
        type="button"
        onClick={onSkip}
        className="pointer-events-auto absolute bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(18px,env(safe-area-inset-right))] flex items-center gap-3 px-2 py-3 text-[11px] font-bold uppercase tracking-[0.34em] opacity-75"
      >
        <span className="h-px w-8 bg-current" />
        Skip
      </button>
    </div>
  );
}

/** Between levels in the album: the last song's line, passing over the next song's first seconds. */
export function PassingCard({ tone, line }: { tone: Tone; line: AlbumLine }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] flex flex-col items-center gap-1 text-center" style={{ color: tone.ink }}>
      <span className="text-[11px] font-bold uppercase tracking-[0.34em] opacity-70">{line.title}</span>
      <span className="text-[26px] font-bold tabular-nums leading-none">
        {format(line.depth)} m{line.medal ? ` · ${MEDAL_WORD[line.medal]}` : ''}
      </span>
    </div>
  );
}
