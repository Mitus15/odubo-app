import { LEVELS, STAGES, type LevelDef, type Stage } from './album';
import { medalFor, type Medal } from './rules';

/**
 * The Album, played through: where a run is in the album, and what each
 * level in it gave.
 *
 * A run is plain data and never changes in place. Every step returns a new
 * run, so a result screen can keep the run it was shown while play moves on.
 *
 * Songs mode needs none of this: a level alone is just its course. A level is
 * the same level in both modes (same course, same start), so a depth fallen
 * here also counts toward that song's best (progress.ts).
 */

/** One level's part of a result: the album's result screen, or a song's. */
export interface ResultLine {
  slug: string;
  /** Level number, 1..10. */
  index: number;
  title: string;
  /** Whole metres. */
  depth: number;
  medal: Medal;
}

export interface AlbumRun {
  /** The stage being played, as an index into STAGES; STAGES.length once the album is over. */
  readonly at: number;
  /** Where this run began: 0 is the Welcome, later is a continue. */
  readonly startedAt: number;
  /** Every level finished in this run, in album order. */
  readonly lines: readonly ResultLine[];
}

/**
 * Depth is kept in whole metres, as it is shown, so the lines on a result
 * screen always add up to its total. Medal lines are whole metres too, so
 * dropping the fraction never moves a medal.
 */
export function wholeMetres(depth: number): number {
  return Math.floor(depth);
}

/** A level's line for this depth, with the medal it earns. */
export function resultLine(level: LevelDef, depth: number): ResultLine {
  const metres = wholeMetres(depth);
  return {
    slug: level.slug,
    index: level.index,
    title: level.title,
    depth: metres,
    medal: medalFor(metres, level.seconds, level.medals),
  };
}

/** Where a stage sits in the album. Unknown (an old continue point, say) means the beginning. */
function stageIndex(slug: string | null | undefined): number {
  if (!slug) return 0;
  const index = STAGES.findIndex((stage) => stage.slug === slug);
  return index < 0 ? 0 : index;
}

/**
 * A new run. With no slug it starts at the Welcome; with one it starts at that
 * stage, and the stages before it are not played and not counted.
 */
export function albumStart(fromSlug?: string | null): AlbumRun {
  const at = stageIndex(fromSlug);
  return { at, startedAt: at, lines: [] };
}

/** The stage being played, or null once the album is over. */
export function currentStage(run: AlbumRun): Stage | null {
  return STAGES[run.at] ?? null;
}

/** The stage after this one (to load its song early), or null at the end. */
export function nextStage(run: AlbumRun): Stage | null {
  return STAGES[run.at + 1] ?? null;
}

export function albumDone(run: AlbumRun): boolean {
  return run.at >= STAGES.length;
}

/**
 * The current stage is over: a level with the depth it was fallen to, a
 * cutscene with none (its fall is scenery, so any depth given is not counted).
 * A finished album stays finished, so a second end of the same song is harmless.
 */
export function finishStage(run: AlbumRun, depth?: number): AlbumRun {
  const stage = currentStage(run);
  if (!stage) return run;
  if (stage.kind === 'cutscene') return { ...run, at: run.at + 1 };
  if (depth === undefined || !Number.isFinite(depth) || depth < 0) {
    // A level with no depth would quietly sink the total; say so instead.
    throw new RangeError(`${stage.title} ended without a depth`);
  }
  return { ...run, at: run.at + 1, lines: [...run.lines, resultLine(stage, depth)] };
}

/** Skip a cutscene. A level cannot be skipped, so on a level nothing changes. */
export function skipCutscene(run: AlbumRun): AlbumRun {
  const stage = currentStage(run);
  if (!stage || stage.kind !== 'cutscene') return run;
  return { ...run, at: run.at + 1 };
}

/** Total depth across the levels played in this run (whole metres). */
export function albumTotal(run: AlbumRun): number {
  let total = 0;
  for (const line of run.lines) total += line.depth;
  return total;
}

/**
 * Every level of the album, played in this one run. Only a full run is
 * compared with the album best: a continue is shorter, so its total is too.
 */
export function isFullRun(run: AlbumRun): boolean {
  return albumDone(run) && run.lines.length === LEVELS.length;
}

/**
 * Where to pick the album up if this run stops here: the level being played,
 * or during a cutscene the level after it. Null once the album is over.
 */
export function continueFrom(run: AlbumRun): string | null {
  for (let i = run.at; i < STAGES.length; i++) {
    const stage = STAGES[i];
    if (stage.kind === 'level') return stage.slug;
  }
  return null;
}

/** The level after this one in the album, for a song's "Next song". Null after the last. */
export function nextLevelAfter(slug: string): LevelDef | null {
  const index = STAGES.findIndex((stage) => stage.slug === slug);
  if (index < 0) return null;
  for (let i = index + 1; i < STAGES.length; i++) {
    const stage = STAGES[i];
    if (stage.kind === 'level') return stage;
  }
  return null;
}

/** The album from this stage on, as a run started there would play it. */
export function stagesFrom(slug?: string | null): readonly Stage[] {
  return STAGES.slice(stageIndex(slug));
}
