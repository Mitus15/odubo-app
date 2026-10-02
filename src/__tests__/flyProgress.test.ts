/**
 * @jest-environment node
 */
import { Trajectory } from '@/components/fly/engine/record';
import { LEVELS, levelBySlug } from '@/lib/fly/album';
import {
  PROGRESS_KEYS,
  browserStorage,
  loadGhost,
  loadProgress,
  markSeen,
  recordAlbum,
  recordLevel,
  saveAlbumPlace,
  type ProgressStorage,
} from '@/lib/fly/progress';
import { COURSE_VERSION, medalDepths, medalFor } from '@/lib/fly/rules';
import { albumDone, albumStart, currentStage, finishStage, type AlbumRun } from '@/lib/fly/story';

/**
 * Saved progress: bests only improve, a ghost is only ever the best's own, the
 * album best only counts whole albums, and no storage failure ever reaches
 * the player.
 */

/** localStorage in memory, with a quota counted in characters like the real one. */
class MemoryStorage implements ProgressStorage {
  readonly items = new Map<string, string>();
  setCalls = 0;

  constructor(private readonly capacity = Infinity) {}

  get length(): number {
    return this.items.size;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.setCalls += 1;
    let used = key.length + value.length;
    for (const [k, v] of this.items) if (k !== key) used += k.length + v.length;
    if (used > this.capacity) throw quotaError();
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

function quotaError(): Error {
  return Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError', code: 22 });
}

function securityError(): Error {
  return Object.assign(new Error('The operation is insecure.'), { name: 'SecurityError', code: 18 });
}

/** Every call throws, the way a browser with site data blocked does. */
class BlockedStorage implements ProgressStorage {
  get length(): number {
    throw securityError();
  }
  key(): string | null {
    throw securityError();
  }
  getItem(): string | null {
    throw securityError();
  }
  setItem(): void {
    throw securityError();
  }
  removeItem(): void {
    throw securityError();
  }
}

/** A real ghost: what Trajectory.encode() makes of a run this long. */
function ghostOf(seconds: number, wobble = 1): string {
  const trajectory = new Trajectory();
  const samples = Math.round(seconds * 15) + 1;
  for (let i = 0; i < samples; i++) {
    trajectory.push(Math.sin(i * 0.01 * wobble) * 10, Math.cos(i * 0.013 * wobble) * 10, i * 3);
  }
  return trajectory.encode();
}

function fullRun(depth: number): AlbumRun {
  let run = albumStart();
  while (!albumDone(run)) run = finishStage(run, depth);
  return run;
}

function runFrom(slug: string, depth: number): AlbumRun {
  let run = albumStart(slug);
  while (!albumDone(run)) run = finishStage(run, depth);
  return run;
}

const GHOST_A = ghostOf(60, 1);
const GHOST_B = ghostOf(60, 2);
const GHOST_C = ghostOf(60, 3);

describe('keys', () => {
  it('are namespaced, and carry COURSE_VERSION wherever a course is measured', () => {
    const course = `c${COURSE_VERSION}.`;
    const bound = [PROGRESS_KEYS.best('1984'), PROGRESS_KEYS.ghost('1984'), PROGRESS_KEYS.albumBest];
    const unbound = [PROGRESS_KEYS.albumContinue, PROGRESS_KEYS.welcomeSeen, PROGRESS_KEYS.steerHintSeen];
    for (const key of [...bound, ...unbound]) expect(key.startsWith('fly.v2.')).toBe(true);
    for (const key of bound) expect(key).toContain(course);
    for (const key of unbound) expect(key).not.toContain(course);
    expect(new Set([...bound, ...unbound]).size).toBe(6);
    expect(PROGRESS_KEYS.best('rap')).not.toBe(PROGRESS_KEYS.best('1984'));
  });

  it('are the ones actually written', () => {
    const storage = new MemoryStorage();
    recordLevel(storage, '1984', 9000, GHOST_A, 1);
    recordAlbum(storage, fullRun(9000), 2);
    saveAlbumPlace(storage, albumStart('rap'));
    markSeen(storage, 'welcomeSeen');
    markSeen(storage, 'steerHintSeen');
    expect([...storage.items.keys()].sort()).toEqual(
      [
        PROGRESS_KEYS.best('1984'),
        PROGRESS_KEYS.ghost('1984'),
        PROGRESS_KEYS.albumBest,
        PROGRESS_KEYS.albumContinue,
        PROGRESS_KEYS.welcomeSeen,
        PROGRESS_KEYS.steerHintSeen,
      ].sort(),
    );
  });

  it('a best saved on another course version is not this course’s best', () => {
    const storage = new MemoryStorage();
    storage.setItem(`fly.v2.c${COURSE_VERSION + 1}.best.1984`, JSON.stringify({ depth: 99999, medal: 'gold', at: 1 }));
    expect(loadProgress(storage).bests['1984']).toBeUndefined();
    expect(recordLevel(storage, '1984', 9000, null, 2).isBest).toBe(true);
  });
});

describe('a fresh phone', () => {
  it('has nothing saved', () => {
    expect(loadProgress(new MemoryStorage())).toEqual({
      bests: {},
      albumBest: null,
      continueFrom: null,
      welcomeSeen: false,
      steerHintSeen: false,
    });
  });

  it('with no storage at all, reads as nothing saved and keeps nothing', () => {
    expect(loadProgress(null).bests).toEqual({});
    expect(loadGhost(null, '1984')).toBeNull();
    const record = recordLevel(null, '1984', 9000, GHOST_A, 1);
    expect(record.isBest).toBe(true);
    expect(record.previousBest).toBeNull();
    expect(() => saveAlbumPlace(null, albumStart('rap'))).not.toThrow();
    expect(recordAlbum(null, fullRun(9000), 1).isBest).toBe(true);
    expect(() => markSeen(null, 'welcomeSeen')).not.toThrow();
  });

  it('outside a browser there is no storage to ask', () => {
    expect(browserStorage()).toBeNull();
  });
});

describe('level bests', () => {
  it('only ever improve', () => {
    const storage = new MemoryStorage();
    const first = recordLevel(storage, '1984', 9000, null, 1);
    expect(first.isBest).toBe(true);
    expect(first.previousBest).toBeNull();

    const worse = recordLevel(storage, '1984', 8000, null, 2);
    expect(worse.isBest).toBe(false);
    expect(worse.previousBest?.depth).toBe(9000);
    expect(loadProgress(storage).bests['1984']).toMatchObject({ depth: 9000, at: 1 });

    const same = recordLevel(storage, '1984', 9000.6, null, 3);
    expect(same.isBest).toBe(false);

    const better = recordLevel(storage, '1984', 12000.4, null, 4);
    expect(better.isBest).toBe(true);
    expect(better.previousBest?.depth).toBe(9000);
    expect(loadProgress(storage).bests['1984']).toMatchObject({ depth: 12000, at: 4 });
  });

  it('are kept per level', () => {
    const storage = new MemoryStorage();
    recordLevel(storage, '1984', 9000, null, 1);
    expect(recordLevel(storage, 'rap', 5000, null, 2).isBest).toBe(true);
    const { bests } = loadProgress(storage);
    expect(Object.keys(bests).sort()).toEqual(['1984', 'rap']);
  });

  it('carry the medal the depth earns, worked out again on every read', () => {
    const storage = new MemoryStorage();
    const level = levelBySlug('1984');
    if (!level) throw new Error('no 1984');
    const gold = medalDepths(level.seconds, level.medals).gold;
    expect(recordLevel(storage, '1984', gold, null, 1).medal).toBe('gold');
    expect(JSON.parse(storage.getItem(PROGRESS_KEYS.best('1984')) ?? '{}').medal).toBe('gold');
    // A medal saved by an older medal line is not believed.
    storage.setItem(PROGRESS_KEYS.best('1984'), JSON.stringify({ depth: 100, medal: 'gold', at: 1 }));
    expect(loadProgress(storage).bests['1984'].medal).toBe(medalFor(100, level.seconds, level.medals));
    expect(loadProgress(storage).bests['1984'].medal).toBeNull();
  });

  it('report the medal of a run that is not a best too', () => {
    const storage = new MemoryStorage();
    const level = levelBySlug('rap');
    if (!level) throw new Error('no rap');
    const { bronze, gold } = medalDepths(level.seconds, level.medals);
    recordLevel(storage, 'rap', gold, null, 1);
    expect(recordLevel(storage, 'rap', bronze, null, 2)).toMatchObject({ isBest: false, medal: 'bronze' });
  });

  it('are not kept for cutscenes, unknown songs or a depth that is not one', () => {
    const storage = new MemoryStorage();
    expect(recordLevel(storage, 'welcome', 2000, GHOST_A, 1).isBest).toBe(false);
    expect(recordLevel(storage, 'not-a-song', 2000, GHOST_A, 1).isBest).toBe(false);
    expect(recordLevel(storage, '1984', Number.NaN, GHOST_A, 1).isBest).toBe(false);
    expect(storage.items.size).toBe(0);
  });

  it('survive a damaged entry by reading it as none', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEYS.best('1984'), '{not json');
    storage.setItem(PROGRESS_KEYS.best('rap'), JSON.stringify({ depth: 'deep' }));
    storage.setItem(PROGRESS_KEYS.best('makunahea'), 'null');
    expect(loadProgress(storage).bests).toEqual({});
    expect(recordLevel(storage, '1984', 10, null, 1).isBest).toBe(true);
  });
});

describe('ghosts', () => {
  it('a ghost of the longest song is about 62 KB', () => {
    const longest = LEVELS.reduce((a, b) => (b.seconds > a.seconds ? b : a));
    const ghost = ghostOf(longest.seconds);
    expect(ghost.length).toBeGreaterThan(60_000);
    expect(ghost.length).toBeLessThan(64_000);
    expect(Trajectory.decode(ghost)?.count).toBe(Math.round(longest.seconds * 15) + 1);
  });

  it('are saved with a new best and never otherwise', () => {
    const storage = new MemoryStorage();
    recordLevel(storage, '1984', 9000, GHOST_A, 1);
    expect(loadGhost(storage, '1984')).toBe(GHOST_A);

    recordLevel(storage, '1984', 8000, GHOST_B, 2);
    expect(loadGhost(storage, '1984')).toBe(GHOST_A);

    recordLevel(storage, '1984', 9500, GHOST_C, 3);
    expect(loadGhost(storage, '1984')).toBe(GHOST_C);
  });

  it('a new best with no ghost lets the old ghost go, so a ghost is always the best’s own', () => {
    const storage = new MemoryStorage();
    recordLevel(storage, '1984', 9000, GHOST_A, 1);
    recordLevel(storage, '1984', 9500, null, 2);
    expect(loadGhost(storage, '1984')).toBeNull();
    expect(loadProgress(storage).bests['1984'].depth).toBe(9500);
  });

  it('when the quota is full, the oldest other ghost makes room', () => {
    // Room for the bests and two ghosts, not three.
    const storage = new MemoryStorage(GHOST_A.length * 2.5 + 2000);
    recordLevel(storage, 'rap', 9000, GHOST_A, 5);
    recordLevel(storage, '1984', 9000, GHOST_B, 2);
    expect(loadGhost(storage, 'rap')).toBe(GHOST_A);
    expect(loadGhost(storage, '1984')).toBe(GHOST_B);

    const record = recordLevel(storage, 'makunahea', 9000, GHOST_C, 9);
    expect(record.isBest).toBe(true);
    expect(loadGhost(storage, 'makunahea')).toBe(GHOST_C);
    // 1984's best is the oldest (at 2), though it was saved second.
    expect(loadGhost(storage, '1984')).toBeNull();
    expect(loadGhost(storage, 'rap')).toBe(GHOST_A);
    // Its best stays: only the ghost made room.
    expect(loadProgress(storage).bests['1984'].depth).toBe(9000);
  });

  it('a ghost from an older course is dropped before any current one', () => {
    const storage = new MemoryStorage(GHOST_A.length * 2.5 + 2000);
    const stale = `fly.v2.c${COURSE_VERSION - 1}.ghost.makunahea`;
    storage.setItem(stale, GHOST_A);
    recordLevel(storage, 'rap', 9000, GHOST_B, 1);
    recordLevel(storage, '1984', 9000, GHOST_C, 2);
    expect(storage.getItem(stale)).toBeNull();
    expect(loadGhost(storage, 'rap')).toBe(GHOST_B);
    expect(loadGhost(storage, '1984')).toBe(GHOST_C);
  });

  it('makes room once, then gives up quietly and keeps the best', () => {
    // Too small for any ghost at all.
    const storage = new MemoryStorage(2000);
    storage.setItem(PROGRESS_KEYS.ghost('rap'), 'x'.repeat(10));
    const before = storage.setCalls;
    const record = recordLevel(storage, '1984', 9000, GHOST_A, 1);
    expect(record.isBest).toBe(true);
    expect(loadProgress(storage).bests['1984'].depth).toBe(9000);
    expect(loadGhost(storage, '1984')).toBeNull();
    // The best, then the ghost twice: one try, one retry after making room.
    expect(storage.setCalls - before).toBe(3);
    expect(loadGhost(storage, 'rap')).toBeNull();
  });

  it('a beaten best’s ghost goes when the new ghost cannot be kept', () => {
    const storage = new MemoryStorage(GHOST_A.length + 1000);
    recordLevel(storage, '1984', 9000, GHOST_A, 1);
    const bigger = ghostOf(200);
    recordLevel(storage, '1984', 9500, bigger, 2);
    expect(loadProgress(storage).bests['1984'].depth).toBe(9500);
    expect(loadGhost(storage, '1984')).toBeNull();
  });

  it('a storage that is always full (an old private window) gives up without a fuss', () => {
    const storage = new MemoryStorage(0);
    recordLevel(storage, '1984', 9000, GHOST_A, 1);
    // Nothing to drop, so no retry: one try for the best, and the ghost is never tried.
    expect(storage.setCalls).toBe(1);
    expect(storage.items.size).toBe(0);
  });

  it('also knows the quota by Firefox’s name and by the old WebKit code', () => {
    for (const error of [
      Object.assign(new Error('full'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' }),
      Object.assign(new Error('full'), { code: 22 }),
    ]) {
      const storage = new MemoryStorage();
      recordLevel(storage, 'rap', 9000, GHOST_A, 1);
      let thrown = false;
      const flaky: ProgressStorage = {
        get length() {
          return storage.length;
        },
        key: (i) => storage.key(i),
        getItem: (k) => storage.getItem(k),
        removeItem: (k) => storage.removeItem(k),
        setItem: (k, v) => {
          if (!thrown && k === PROGRESS_KEYS.ghost('1984')) {
            thrown = true;
            throw error;
          }
          storage.setItem(k, v);
        },
      };
      recordLevel(flaky, '1984', 9000, GHOST_B, 2);
      expect(loadGhost(storage, '1984')).toBe(GHOST_B);
      expect(loadGhost(storage, 'rap')).toBeNull();
    }
  });
});

describe('the album best', () => {
  it('only counts full runs', () => {
    const storage = new MemoryStorage();
    const partial = recordAlbum(storage, runFrom('in-the-court', 20000), 1);
    expect(partial.full).toBe(false);
    expect(partial.isBest).toBe(false);
    expect(loadProgress(storage).albumBest).toBeNull();

    const full = recordAlbum(storage, fullRun(9000), 2);
    expect(full).toMatchObject({ full: true, isBest: true, total: 90000, previousBest: null });
    expect(loadProgress(storage).albumBest).toEqual({ total: 90000, at: 2 });
  });

  it('only improves', () => {
    const storage = new MemoryStorage();
    recordAlbum(storage, fullRun(9000), 1);
    const worse = recordAlbum(storage, fullRun(8000), 2);
    expect(worse.isBest).toBe(false);
    expect(worse.previousBest?.total).toBe(90000);
    const better = recordAlbum(storage, fullRun(9500), 3);
    expect(better.isBest).toBe(true);
    expect(loadProgress(storage).albumBest).toEqual({ total: 95000, at: 3 });
  });

  it('a continued run, however deep, never beats a whole album', () => {
    const storage = new MemoryStorage();
    recordAlbum(storage, fullRun(1000), 1);
    const continued = recordAlbum(storage, runFrom('hallucinogen', 50000), 2);
    expect(continued).toMatchObject({ full: false, isBest: false, total: 450000 });
    expect(loadProgress(storage).albumBest?.total).toBe(10000);
  });

  it('an unfinished run records nothing', () => {
    const storage = new MemoryStorage();
    let run = albumStart();
    run = finishStage(run);
    run = finishStage(run, 9000);
    saveAlbumPlace(storage, run);
    const record = recordAlbum(storage, run, 1);
    expect(record).toMatchObject({ isBest: false, full: false, total: 9000 });
    expect(loadProgress(storage).continueFrom).toBe('hallucinogen');
  });
});

describe('the continue point', () => {
  it('follows the run and is cleared when the album is over', () => {
    const storage = new MemoryStorage();
    let run = albumStart();
    saveAlbumPlace(storage, run);
    expect(loadProgress(storage).continueFrom).toBe('1984');

    run = finishStage(finishStage(run), 9000);
    saveAlbumPlace(storage, run);
    expect(loadProgress(storage).continueFrom).toBe('hallucinogen');

    run = finishStage(run, 9000);
    expect(currentStage(run)?.slug).toBe('no-end-theory');
    saveAlbumPlace(storage, run);
    expect(loadProgress(storage).continueFrom).toBe('in-the-court');

    while (!albumDone(run)) run = finishStage(run, 9000);
    recordAlbum(storage, run, 1);
    expect(loadProgress(storage).continueFrom).toBeNull();
    expect(storage.getItem(PROGRESS_KEYS.albumContinue)).toBeNull();
  });

  it('is cleared by a continued run reaching the end too', () => {
    const storage = new MemoryStorage();
    saveAlbumPlace(storage, albumStart('rap'));
    expect(loadProgress(storage).continueFrom).toBe('rap');
    recordAlbum(storage, runFrom('rap', 9000), 1);
    expect(loadProgress(storage).continueFrom).toBeNull();
  });

  it('is only ever a level that exists', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEYS.albumContinue, 'a-song-since-renamed');
    expect(loadProgress(storage).continueFrom).toBeNull();
    storage.setItem(PROGRESS_KEYS.albumContinue, 'every-generation');
    expect(loadProgress(storage).continueFrom).toBeNull();
  });
});

describe('first visits', () => {
  it('remember the welcome and the steering hint separately', () => {
    const storage = new MemoryStorage();
    markSeen(storage, 'steerHintSeen');
    expect(loadProgress(storage)).toMatchObject({ welcomeSeen: false, steerHintSeen: true });
    markSeen(storage, 'welcomeSeen');
    expect(loadProgress(storage)).toMatchObject({ welcomeSeen: true, steerHintSeen: true });
  });
});

describe('storage that fails', () => {
  it('blocked outright: every call reads as nothing saved, and nothing throws', () => {
    const storage = new BlockedStorage();
    expect(loadProgress(storage)).toEqual(loadProgress(null));
    expect(loadGhost(storage, '1984')).toBeNull();
    expect(() => recordLevel(storage, '1984', 9000, GHOST_A, 1)).not.toThrow();
    expect(recordLevel(storage, '1984', 9000, GHOST_A, 1).isBest).toBe(true);
    expect(() => saveAlbumPlace(storage, albumStart('rap'))).not.toThrow();
    expect(() => saveAlbumPlace(storage, fullRun(1))).not.toThrow();
    expect(() => recordAlbum(storage, fullRun(9000), 1)).not.toThrow();
    expect(() => markSeen(storage, 'welcomeSeen')).not.toThrow();
  });

  it('reads that throw are read as nothing saved', () => {
    const storage = new MemoryStorage();
    recordLevel(storage, '1984', 9000, GHOST_A, 1);
    const unreadable: ProgressStorage = {
      get length() {
        return storage.length;
      },
      key: (i) => storage.key(i),
      getItem: () => {
        throw securityError();
      },
      setItem: (k, v) => storage.setItem(k, v),
      removeItem: (k) => storage.removeItem(k),
    };
    expect(loadProgress(unreadable).bests).toEqual({});
    expect(loadGhost(unreadable, '1984')).toBeNull();
    const record = recordLevel(unreadable, '1984', 100, null, 2);
    expect(record.isBest).toBe(true);
    expect(record.previousBest).toBeNull();
  });

  it('writes that throw (not the quota) are given up at once', () => {
    const storage = new MemoryStorage();
    recordLevel(storage, 'rap', 9000, GHOST_A, 1);
    let calls = 0;
    const readOnly: ProgressStorage = {
      get length() {
        return storage.length;
      },
      key: (i) => storage.key(i),
      getItem: (k) => storage.getItem(k),
      removeItem: (k) => storage.removeItem(k),
      setItem: () => {
        calls += 1;
        throw securityError();
      },
    };
    const record = recordLevel(readOnly, '1984', 9000, GHOST_B, 2);
    expect(record.isBest).toBe(true);
    expect(calls).toBe(1);
    // Nobody else's ghost was sacrificed for a write that was never going to work.
    expect(loadGhost(storage, 'rap')).toBe(GHOST_A);
    expect(loadProgress(storage).bests['1984']).toBeUndefined();
  });

  it('a full quota whose keys cannot be listed is given up quietly', () => {
    const storage = new MemoryStorage(0);
    const unlistable: ProgressStorage = {
      get length(): number {
        throw securityError();
      },
      key: () => {
        throw securityError();
      },
      getItem: (k) => storage.getItem(k),
      setItem: (k, v) => storage.setItem(k, v),
      removeItem: (k) => storage.removeItem(k),
    };
    expect(() => recordLevel(unlistable, '1984', 9000, GHOST_A, 1)).not.toThrow();
    expect(storage.setCalls).toBe(1);
  });

  it('a remove that throws does not stop the record', () => {
    const storage = new MemoryStorage();
    recordLevel(storage, '1984', 9000, GHOST_A, 1);
    const stubborn: ProgressStorage = {
      get length() {
        return storage.length;
      },
      key: (i) => storage.key(i),
      getItem: (k) => storage.getItem(k),
      setItem: (k, v) => storage.setItem(k, v),
      removeItem: () => {
        throw securityError();
      },
    };
    expect(recordLevel(stubborn, '1984', 9500, null, 2).isBest).toBe(true);
    expect(loadProgress(storage).bests['1984'].depth).toBe(9500);
    expect(() => recordAlbum(stubborn, fullRun(1), 3)).not.toThrow();
  });
});
