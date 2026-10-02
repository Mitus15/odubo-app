import { LEVELS, levelBySlug, type LevelDef } from './album';
import { COURSE_VERSION, medalFor, type Medal } from './rules';
import { albumDone, albumTotal, continueFrom, isFullRun, wholeMetres, type AlbumRun } from './story';

/**
 * The player's saved progress, kept on the phone in localStorage.
 *
 * Storage can fail at any moment: a private window, blocked site data, a full
 * quota, a browser that throws just for asking. Every read and write here is
 * wrapped, a failed read is "nothing saved yet", and a failed write is given up
 * quietly. Losing a best is sad; crashing the result screen over it is worse.
 *
 * Anything measured on a course (bests, ghosts, the album best) is keyed by
 * COURSE_VERSION, so new stone starts a fresh board instead of comparing with
 * runs on stone that is gone. Where to continue and what has been seen are not.
 */

/** What progress needs of localStorage. Tests pass an in-memory one. */
export interface ProgressStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ROOT = 'fly.v2.';
const COURSE_ROOT = `${ROOT}c${COURSE_VERSION}.`;
const GHOST_KEY = /^fly\.v2\.c(\d+)\.ghost\.(.+)$/;

export const PROGRESS_KEYS = {
  best: (slug: string) => `${COURSE_ROOT}best.${slug}`,
  ghost: (slug: string) => `${COURSE_ROOT}ghost.${slug}`,
  albumBest: `${COURSE_ROOT}album.best`,
  albumContinue: `${ROOT}album.continue`,
  welcomeSeen: `${ROOT}welcomeSeen`,
  steerHintSeen: `${ROOT}steerHintSeen`,
} as const;

export type SeenFlag = 'welcomeSeen' | 'steerHintSeen';

export interface LevelBest {
  /** Whole metres. */
  depth: number;
  medal: Medal;
  /** When it was set (ms since 1970). */
  at: number;
}

export interface AlbumBest {
  /** Total depth of a full run (whole metres). */
  total: number;
  at: number;
}

export interface Progress {
  /** By level slug; a level never finished has no entry. */
  bests: Readonly<Record<string, LevelBest>>;
  albumBest: AlbumBest | null;
  /** The level an unfinished album run would continue from. */
  continueFrom: string | null;
  welcomeSeen: boolean;
  steerHintSeen: boolean;
}

export interface LevelRecord {
  isBest: boolean;
  medal: Medal;
  previousBest: LevelBest | null;
}

export interface AlbumRecord {
  isBest: boolean;
  /** Whether this run counted at all: only a whole album is compared. */
  full: boolean;
  total: number;
  previousBest: AlbumBest | null;
}

/** The browser's localStorage, or null where even asking for it throws. */
export function browserStorage(): ProgressStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadProgress(storage: ProgressStorage | null): Progress {
  const bests: Record<string, LevelBest> = {};
  for (const level of LEVELS) {
    const best = readBest(storage, level);
    if (best) bests[level.slug] = best;
  }
  return {
    bests,
    albumBest: readAlbumBest(storage),
    continueFrom: readContinue(storage),
    welcomeSeen: read(storage, PROGRESS_KEYS.welcomeSeen) === '1',
    steerHintSeen: read(storage, PROGRESS_KEYS.steerHintSeen) === '1',
  };
}

/** The best run's ghost for a level (a Trajectory.encode() string), if one is kept. */
export function loadGhost(storage: ProgressStorage | null, slug: string): string | null {
  return read(storage, PROGRESS_KEYS.ghost(slug));
}

/**
 * A level is over, in Songs or inside the Album: the same level, the same
 * best. Only a deeper depth replaces the best, and the ghost is only ever the
 * best's own, so a ghost is saved with a new best and never otherwise. Cutscenes
 * keep no best.
 */
export function recordLevel(
  storage: ProgressStorage | null,
  slug: string,
  depth: number,
  ghostEncoded: string | null,
  now: number = Date.now(),
): LevelRecord {
  const level = levelBySlug(slug);
  const metres = wholeMetres(depth);
  if (!level || !isDepth(metres)) return { isBest: false, medal: null, previousBest: null };
  const medal = medalFor(metres, level.seconds, level.medals);
  const previousBest = readBest(storage, level);
  const isBest = previousBest === null || metres > previousBest.depth;
  if (!isBest) return { isBest, medal, previousBest };

  const best: LevelBest = { depth: metres, medal, at: now };
  // The best first: it is small, and it is what matters. If it cannot be kept,
  // the old best and its ghost still belong together, so leave them be.
  if (!write(storage, PROGRESS_KEYS.best(slug), JSON.stringify(best), slug)) {
    return { isBest, medal, previousBest };
  }
  const ghostKey = PROGRESS_KEYS.ghost(slug);
  // A ghost of a beaten best would race a run that is no longer the best.
  if (!ghostEncoded || !write(storage, ghostKey, ghostEncoded, slug)) remove(storage, ghostKey);
  return { isBest, medal, previousBest };
}

/**
 * Remember where this album run is, so it can be continued: the level being
 * played, or the next one during a cutscene. A finished album forgets it.
 */
export function saveAlbumPlace(storage: ProgressStorage | null, run: AlbumRun): void {
  const slug = continueFrom(run);
  if (albumDone(run) || slug === null) {
    remove(storage, PROGRESS_KEYS.albumContinue);
    return;
  }
  write(storage, PROGRESS_KEYS.albumContinue, slug, null);
}

/**
 * An album run is over. The continue point goes, and a full run's total is
 * the new album best if it is deeper. A continued run is shorter than the
 * album, so it never competes with one that is not.
 */
export function recordAlbum(storage: ProgressStorage | null, run: AlbumRun, now: number = Date.now()): AlbumRecord {
  const total = albumTotal(run);
  const previousBest = readAlbumBest(storage);
  if (!albumDone(run)) return { isBest: false, full: false, total, previousBest };
  saveAlbumPlace(storage, run);
  const full = isFullRun(run);
  const isBest = full && (previousBest === null || total > previousBest.total);
  if (isBest) {
    const best: AlbumBest = { total, at: now };
    write(storage, PROGRESS_KEYS.albumBest, JSON.stringify(best), null);
  }
  return { isBest, full, total, previousBest };
}

/** The welcome or the steering hint has been seen: never show it again. */
export function markSeen(storage: ProgressStorage | null, flag: SeenFlag): void {
  write(storage, PROGRESS_KEYS[flag], '1', null);
}

// ── Reading ────────────────────────────────────────────────────────────────

function read(storage: ProgressStorage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(storage: ProgressStorage | null, key: string): Record<string, unknown> | null {
  const raw = read(storage, key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isDepth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function timeOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * A level's best. The medal is worked out again from the depth, so a medal
 * line retuned since the run never leaves a stale medal on the menu.
 */
function readBest(storage: ProgressStorage | null, level: LevelDef): LevelBest | null {
  const saved = readJson(storage, PROGRESS_KEYS.best(level.slug));
  if (!saved || !isDepth(saved.depth)) return null;
  return {
    depth: saved.depth,
    medal: medalFor(saved.depth, level.seconds, level.medals),
    at: timeOf(saved.at),
  };
}

function readAlbumBest(storage: ProgressStorage | null): AlbumBest | null {
  const saved = readJson(storage, PROGRESS_KEYS.albumBest);
  if (!saved || !isDepth(saved.total)) return null;
  return { total: saved.total, at: timeOf(saved.at) };
}

/** Only a level that still exists can be continued from. */
function readContinue(storage: ProgressStorage | null): string | null {
  const slug = read(storage, PROGRESS_KEYS.albumContinue);
  return slug && levelBySlug(slug) ? slug : null;
}

// ── Writing ────────────────────────────────────────────────────────────────

function remove(storage: ProgressStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Nothing to be done; a stale entry is harmless next to a crash.
  }
}

function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = 'name' in error ? error.name : undefined;
  const code = 'code' in error ? error.code : undefined;
  // Firefox names it differently; old WebKit only sets the code.
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

/**
 * Write, and if the quota is full, make room once by dropping the oldest ghost
 * other than `keepSlug`'s and try again. Anything else gives up quietly.
 */
function write(storage: ProgressStorage | null, key: string, value: string, keepSlug: string | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaError(error) || !dropOldestGhost(storage, keepSlug)) return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ghosts are by far the largest thing kept (up to ~62 KB for the longest
 * song), so they are what makes room. A ghost from an older course is oldest
 * of all: its stone is gone. Otherwise a ghost is as old as the best it
 * belongs to.
 */
function dropOldestGhost(storage: ProgressStorage, keepSlug: string | null): boolean {
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null) keys.push(key);
    }
  } catch {
    return false;
  }

  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const key of keys) {
    const match = GHOST_KEY.exec(key);
    if (!match) continue;
    const version = Number(match[1]);
    const slug = match[2];
    if (version === COURSE_VERSION && slug === keepSlug) continue;
    const level = levelBySlug(slug);
    const at =
      version !== COURSE_VERSION || !level ? -Infinity : (readBest(storage, level)?.at ?? -Infinity);
    if (oldestKey === null || at < oldestAt) {
      oldestKey = key;
      oldestAt = at;
    }
  }
  if (oldestKey === null) return false;
  remove(storage, oldestKey);
  return true;
}
