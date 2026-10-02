/**
 * @jest-environment node
 */
import { steadyPilot } from '@/components/fly/engine/bots';
import { Course } from '@/components/fly/engine/course';
import { FallEngine } from '@/components/fly/engine/FallEngine';
import { ID_STRIDE, type Section } from '@/components/fly/engine/patterns';
import type { FallEvent, Form } from '@/components/fly/engine/types';
import { LEVELS, STAGES, levelBySlug, type LevelDef } from '@/lib/fly/album';
import { FALL, medalDepths, medalFor } from '@/lib/fly/rules';
import {
  albumDone,
  albumStart,
  albumTotal,
  continueFrom,
  currentStage,
  finishStage,
  isFullRun,
  nextLevelAfter,
  nextStage,
  resultLine,
  skipCutscene,
  stagesFrom,
  type AlbumRun,
} from '@/lib/fly/story';
import { songBySlug } from '@/lib/loop/songs';

/**
 * The album as the fall plays it: the stages in order, every level exactly as
 * long as its song, the landing, and the Album run that strings them together.
 */

const ALBUM: [slug: string, title: string, kind: 'cutscene' | 'level'][] = [
  ['welcome', 'Welcome', 'cutscene'],
  ['1984', '1984', 'level'],
  ['hallucinogen', 'Hallucinogen', 'level'],
  ['no-end-theory', 'The No End Theory', 'cutscene'],
  ['in-the-court', 'In The Court', 'level'],
  ['newspeak', 'News Peak', 'level'],
  ['every-generation', 'Every Generation', 'cutscene'],
  ['rap', 'Rap', 'level'],
  ['makunahea', 'Makunahea', 'level'],
  ['the-other-side', 'The Other Side', 'level'],
  ['the-mind-pt-1', 'The Mind Pt 1', 'level'],
  ['midnight-marauders', 'Midnight Marauders', 'cutscene'],
  ['the-mind-pt-2', 'The Mind Pt 2', 'level'],
  ['ghost-world', 'Ghost World', 'level'],
];

function level(slug: string): LevelDef {
  const found = levelBySlug(slug);
  if (!found) throw new Error(`No level ${slug}`);
  return found;
}

/** A made-up depth for a level, different for each so a mix-up shows. */
function depthFor(stage: LevelDef): number {
  return 9000 + stage.index * 111 + 0.75;
}

/** Play a run to the end, a depth for every level and every cutscene watched. */
function playThrough(run: AlbumRun): { run: AlbumRun; visited: string[] } {
  const visited: string[] = [];
  let guard = 0;
  while (!albumDone(run) && guard++ < 100) {
    const stage = currentStage(run);
    if (!stage) break;
    visited.push(stage.slug);
    run = stage.kind === 'level' ? finishStage(run, depthFor(stage)) : finishStage(run);
  }
  return { run, visited };
}

describe('the album, in order', () => {
  it('is fourteen stages: four cutscenes and ten levels, in album order', () => {
    expect(STAGES.map((stage) => [stage.slug, stage.title, stage.kind])).toEqual(ALBUM);
    expect(STAGES.filter((stage) => stage.kind === 'cutscene')).toHaveLength(4);
    expect(STAGES.map((stage) => stage.number)).toEqual(ALBUM.map((_, i) => i + 1));
  });

  it('numbers the ten levels 1..10 in album order', () => {
    expect(LEVELS).toHaveLength(10);
    expect(LEVELS.map((stage) => stage.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(LEVELS.map((stage) => stage.slug)).toEqual(ALBUM.filter(([, , kind]) => kind === 'level').map(([slug]) => slug));
    for (const stage of LEVELS) expect(stage.course.levelIndex).toBe(stage.index);
  });

  it('opens on the Welcome and gives every other interlude the stratum script', () => {
    const scripts = STAGES.flatMap((stage) => (stage.kind === 'cutscene' ? [stage.script] : []));
    expect(scripts).toEqual(['welcome', 'stratum', 'stratum', 'stratum']);
  });

  it('makes every course exactly as long as its song', () => {
    for (const stage of STAGES) {
      const song = songBySlug(stage.slug);
      expect(song).not.toBeNull();
      expect(stage.seconds).toBe(song?.seconds);
      expect(stage.course.seconds).toBe(stage.seconds);
    }
  });

  it('gives every course its own seed', () => {
    const keys = STAGES.map((stage) => stage.course.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('a level lasts exactly as long as its song', () => {
  for (const stage of LEVELS) {
    it(`${stage.title}: the autopilot ends on step ${Math.round(stage.seconds * 120)}`, () => {
      const engine = new FallEngine(new Course(stage.course), 'auto');
      let ends = 0;
      let lastEvent: FallEvent | null = null;
      // Drain as it goes, the way the renderer does, and count the ends.
      while (!engine.done && engine.state.tick < 1_000_000) {
        engine.advanceTo(engine.state.tick + 600);
        for (const event of engine.drainEvents()) {
          if (event.type === 'end') ends += 1;
          lastEvent = event;
        }
      }
      expect(engine.done).toBe(true);
      expect(engine.state.tick).toBe(Math.round(stage.seconds * FALL.ticksPerSecond));
      expect(ends).toBe(1);
      expect(lastEvent).toEqual({ type: 'end' });
      // Done is done: more steps do nothing.
      engine.tick();
      expect(engine.state.tick).toBe(Math.round(stage.seconds * FALL.ticksPerSecond));
    });
  }

  it('and the steady pilot agrees, on the longest song', () => {
    const longest = LEVELS.reduce((a, b) => (b.seconds > a.seconds ? b : a));
    expect(longest.slug).toBe('the-mind-pt-1');
    const run = steadyPilot(longest.course);
    expect(run.state.done).toBe(true);
    expect(run.state.tick).toBe(Math.round(longest.seconds * FALL.ticksPerSecond));
  });
});

describe('the landing', () => {
  const ghostWorld = level('ghost-world');

  /** A floor with no hole in it at all, across the whole arena, at floor k. */
  function slab(course: Course, k: number): Section {
    const s = course.floorS(k);
    const id = k * ID_STRIDE;
    const stone: Form = {
      id,
      group: id,
      kind: 'block',
      role: 'floor',
      x: 0,
      y: 0,
      s,
      hx: FALL.floorReach,
      hy: FALL.floorReach,
      hs: 1,
      yaw: 0,
      cos: 1,
      sin: 0,
      shade: 0.5,
      accent: false,
      solid: true,
    };
    return { k, floor: { id, s, hs: 1, holes: [] }, forms: [stone] };
  }

  /** Fly the autopilot to `seconds`, then lay a holeless slab two floors below him. */
  function slabAt(seconds: number): { engine: FallEngine; before: number; slabS: number } {
    const course = new Course(ghostWorld.course);
    const engine = new FallEngine(course, 'auto');
    engine.advanceTo(Math.round(seconds * FALL.ticksPerSecond));
    const k = course.sectionAt(engine.state.s) + 2;
    engine.director.inject(k, slab(course, k));
    return { engine, before: engine.state.stumbles, slabS: course.floorS(k) };
  }

  it('lets go where the song does, at 270 s, and only on Ghost World', () => {
    expect(ghostWorld.landing).toBe(true);
    expect(ghostWorld.fallsAwayAt).toBe(270);
    expect(ghostWorld.course.harmlessFrom).toBe(270);
    expect(new Course(ghostWorld.course).harmlessFromTick).toBe(270 * FALL.ticksPerSecond);
    for (const stage of LEVELS) {
      if (stage.slug === 'ghost-world') continue;
      expect(stage.landing).toBe(false);
      expect(stage.course.harmlessFrom).toBeNull();
    }
  });

  it('a solid floor before then is a stumble', () => {
    const { engine, before, slabS } = slabAt(200);
    while (!engine.done && engine.state.s < slabS + 5) engine.tick();
    expect(engine.state.harmless).toBe(false);
    expect(engine.state.stumbles).toBe(before + 1);
  });

  it('after it, he falls straight through stone without a stumble', () => {
    const { engine, before, slabS } = slabAt(270);
    // The flag is the step's own: the first step from 270 s on is the first harmless one.
    expect(engine.state.harmless).toBe(false);
    engine.tick();
    expect(engine.state.harmless).toBe(true);
    let wentThrough = false;
    while (!engine.done) {
      engine.tick();
      if (engine.state.nearest < FALL.playerRadius) wentThrough = true;
    }
    expect(engine.state.s).toBeGreaterThan(slabS);
    expect(wentThrough).toBe(true);
    expect(engine.state.stumbles).toBe(before);
    expect(engine.state.inside).toBe(false);
  });
});

describe('an Album run', () => {
  it('from the beginning visits all fourteen stages in order', () => {
    const start = albumStart();
    expect(currentStage(start)?.slug).toBe('welcome');
    expect(nextStage(start)?.slug).toBe('1984');
    const { run, visited } = playThrough(start);
    expect(visited).toEqual(ALBUM.map(([slug]) => slug));
    expect(albumDone(run)).toBe(true);
    expect(currentStage(run)).toBeNull();
    expect(nextStage(run)).toBeNull();
    expect(run.lines.map((line) => line.slug)).toEqual(LEVELS.map((stage) => stage.slug));
    expect(run.lines.map((line) => line.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(isFullRun(run)).toBe(true);
  });

  it('totals the depth of every level, in the whole metres shown', () => {
    const { run } = playThrough(albumStart());
    const expected = LEVELS.reduce((sum, stage) => sum + Math.floor(depthFor(stage)), 0);
    expect(albumTotal(run)).toBe(expected);
    expect(albumTotal(run)).toBe(run.lines.reduce((sum, line) => sum + line.depth, 0));
    for (const line of run.lines) expect(Number.isInteger(line.depth)).toBe(true);
  });

  it('gives each line its medal by its own level', () => {
    let run = albumStart('1984');
    const first = level('1984');
    const goldAt = medalDepths(first.seconds, first.medals).gold;
    run = finishStage(run, goldAt);
    expect(run.lines[0]).toEqual({ slug: '1984', index: 1, title: '1984', depth: goldAt, medal: 'gold' });
    run = finishStage(run, 30 * level('hallucinogen').seconds);
    expect(run.lines[1].medal).toBeNull();
  });

  it('skips a cutscene to the stage after it', () => {
    let run = albumStart();
    run = skipCutscene(run);
    expect(currentStage(run)?.slug).toBe('1984');
    expect(run.lines).toHaveLength(0);
    run = finishStage(run, 8000);
    run = finishStage(run, 7000);
    expect(currentStage(run)?.slug).toBe('no-end-theory');
    run = skipCutscene(run);
    expect(currentStage(run)?.slug).toBe('in-the-court');
    expect(albumTotal(run)).toBe(15000);
  });

  it('never skips a level', () => {
    const run = albumStart('newspeak');
    expect(skipCutscene(run)).toBe(run);
  });

  it('skipping every cutscene still makes a full run', () => {
    let run = albumStart();
    while (!albumDone(run)) {
      const stage = currentStage(run);
      run = stage?.kind === 'cutscene' ? skipCutscene(run) : finishStage(run, 9000);
    }
    expect(isFullRun(run)).toBe(true);
    expect(albumTotal(run)).toBe(90000);
  });

  it('continues from a level, skipping what came before and counting only what is played', () => {
    const start = albumStart('in-the-court');
    expect(currentStage(start)?.slug).toBe('in-the-court');
    const { run, visited } = playThrough(start);
    expect(visited).toEqual(ALBUM.slice(4).map(([slug]) => slug));
    expect(run.lines.map((line) => line.slug)).toEqual(LEVELS.slice(2).map((stage) => stage.slug));
    expect(albumTotal(run)).toBe(LEVELS.slice(2).reduce((sum, stage) => sum + Math.floor(depthFor(stage)), 0));
    expect(albumDone(run)).toBe(true);
    expect(isFullRun(run)).toBe(false);
  });

  it('continuing from the very first level is still the whole album', () => {
    const { run } = playThrough(albumStart('1984'));
    expect(isFullRun(run)).toBe(true);
  });

  it('starts from the beginning when the slug is unknown', () => {
    expect(currentStage(albumStart('not-a-song'))?.slug).toBe('welcome');
    expect(currentStage(albumStart(null))?.slug).toBe('welcome');
  });

  it('is not full until it is over', () => {
    let run = albumStart();
    for (let i = 0; i < 13; i++) run = finishStage(run, 9000);
    expect(currentStage(run)?.slug).toBe('ghost-world');
    expect(isFullRun(run)).toBe(false);
    run = finishStage(run, 9000);
    expect(isFullRun(run)).toBe(true);
  });

  it('never changes a run in place', () => {
    const start = albumStart();
    const watched = finishStage(start);
    const fallen = finishStage(watched, 8000);
    expect(start).toEqual({ at: 0, startedAt: 0, lines: [] });
    expect(watched.lines).toHaveLength(0);
    expect(fallen.lines).toHaveLength(1);
    expect(watched.at).toBe(1);
  });

  it('refuses to finish a level without a depth', () => {
    const run = albumStart('rap');
    expect(() => finishStage(run)).toThrow(RangeError);
    expect(() => finishStage(run, Number.NaN)).toThrow(RangeError);
    expect(() => finishStage(run, -1)).toThrow(RangeError);
  });

  it('does not count a depth given to a cutscene', () => {
    const run = finishStage(albumStart(), 5000);
    expect(currentStage(run)?.slug).toBe('1984');
    expect(albumTotal(run)).toBe(0);
  });

  it('stays finished when the last song ends twice', () => {
    const { run } = playThrough(albumStart('ghost-world'));
    expect(finishStage(run, 1234)).toBe(run);
    expect(skipCutscene(run)).toBe(run);
  });

  it('knows where to continue from', () => {
    let run = albumStart();
    expect(continueFrom(run)).toBe('1984');
    run = finishStage(run);
    expect(continueFrom(run)).toBe('1984');
    run = finishStage(run, 8000);
    expect(continueFrom(run)).toBe('hallucinogen');
    run = finishStage(run, 8000);
    // During The No End Theory, the next level is where to pick up.
    expect(currentStage(run)?.slug).toBe('no-end-theory');
    expect(continueFrom(run)).toBe('in-the-court');
    const { run: over } = playThrough(run);
    expect(continueFrom(over)).toBeNull();
  });
});

describe('the helpers around a run', () => {
  it('nextLevelAfter steps over cutscenes and stops after Ghost World', () => {
    expect(nextLevelAfter('1984')?.slug).toBe('hallucinogen');
    expect(nextLevelAfter('hallucinogen')?.slug).toBe('in-the-court');
    expect(nextLevelAfter('the-mind-pt-1')?.slug).toBe('the-mind-pt-2');
    expect(nextLevelAfter('welcome')?.slug).toBe('1984');
    expect(nextLevelAfter('ghost-world')).toBeNull();
    expect(nextLevelAfter('not-a-song')).toBeNull();
  });

  it('stagesFrom is the album from that stage on', () => {
    expect(stagesFrom().map((stage) => stage.slug)).toEqual(ALBUM.map(([slug]) => slug));
    expect(stagesFrom('in-the-court').map((stage) => stage.slug)).toEqual(ALBUM.slice(4).map(([slug]) => slug));
    expect(stagesFrom('ghost-world').map((stage) => stage.slug)).toEqual(['ghost-world']);
    expect(stagesFrom('not-a-song')).toHaveLength(STAGES.length);
  });

  it('resultLine is the same line a Songs result shows', () => {
    const rap = level('rap');
    expect(resultLine(rap, 9876.9)).toEqual({
      slug: 'rap',
      index: rap.index,
      title: 'Rap',
      depth: 9876,
      medal: medalFor(9876, rap.seconds, rap.medals),
    });
  });
});

describe('medals', () => {
  for (const stage of LEVELS) {
    it(`${stage.title}: bronze, silver, gold climb, and base speed never medals`, () => {
      const { bronze, silver, gold } = stage.medals;
      expect(bronze).toBeGreaterThan(FALL.baseSpeed);
      expect(silver).toBeGreaterThan(bronze);
      expect(gold).toBeGreaterThan(silver);
      expect(gold).toBeLessThan(FALL.maxSpeed);

      const at = medalDepths(stage.seconds, stage.medals);
      const medal = (depth: number) => medalFor(depth, stage.seconds, stage.medals);
      expect(medal(FALL.baseSpeed * stage.seconds)).toBeNull();
      expect(medal(at.bronze - 1)).toBeNull();
      expect(medal(at.bronze)).toBe('bronze');
      expect(medal(at.silver - 1)).toBe('bronze');
      expect(medal(at.silver)).toBe('silver');
      expect(medal(at.gold - 1)).toBe('silver');
      expect(medal(at.gold)).toBe('gold');
      expect(medal(FALL.maxSpeed * stage.seconds)).toBe('gold');
    });
  }

  it('flooring a depth to whole metres never moves a medal', () => {
    for (const stage of LEVELS) {
      const at = medalDepths(stage.seconds, stage.medals);
      for (const line of [at.bronze, at.silver, at.gold]) {
        expect(resultLine(stage, line - 0.01).medal).toBe(medalFor(line - 0.01, stage.seconds, stage.medals));
        expect(resultLine(stage, line + 0.99).medal).toBe(medalFor(line + 0.99, stage.seconds, stage.medals));
      }
    }
  });
});
