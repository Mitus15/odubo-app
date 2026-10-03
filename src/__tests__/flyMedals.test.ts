/**
 * @jest-environment node
 */
import { LEVELS, type LevelDef } from '@/lib/fly/album';
import { FALL, medalDepths, medalFor, type Medal } from '@/lib/fly/rules';
import { skilledPilot, steadyPilot, type BotRun } from '@/components/fly/engine/bots';

/**
 * Each level's medals, held to the bots that set them. The safe path alone
 * never medals; a bold pilot who takes narrow holes, gates and edges does, on
 * most levels; and gold never asks for a speed only the top of the range holds.
 */

const BOLD = 0.85;
/** Gold must be reachable as an average: well under the top speed, which takes seconds to reach and a stumble to lose. */
const GOLD_CEILING = 66;

const runs = new Map<string, { steady: BotRun; bold: BotRun }>();

function runsFor(level: LevelDef): { steady: BotRun; bold: BotRun } {
  let found = runs.get(level.slug);
  if (!found) {
    found = { steady: steadyPilot(level.course), bold: skilledPilot(level.course, BOLD) };
    runs.set(level.slug, found);
  }
  return found;
}

function medalOf(level: LevelDef, run: BotRun): Medal {
  return medalFor(run.state.s, level.seconds, level.medals);
}

/**
 * Levels whose bronze the bold pilot cannot reach today. Each is a design
 * question, not a bug: see the todo for it below.
 */
const BRONZE_OUT_OF_REACH = new Set<string>([]);

describe('the medal table', () => {
  for (const level of LEVELS) {
    it(`${level.title}: bronze < silver < gold, all reachable below top speed`, () => {
      const { bronze, silver, gold } = level.medals;
      expect(bronze).toBeGreaterThan(FALL.baseSpeed);
      expect(bronze).toBeLessThan(silver);
      expect(silver).toBeLessThan(gold);
      expect(gold).toBeLessThanOrEqual(GOLD_CEILING);
      expect(GOLD_CEILING).toBeLessThan(FALL.maxSpeed);
      const at = medalDepths(level.seconds, level.medals);
      expect(at.bronze).toBeLessThan(at.silver);
      expect(at.silver).toBeLessThan(at.gold);
    });
  }
});

describe('the safe path never medals', () => {
  for (const level of LEVELS) {
    it(`${level.title}: the steady pilot finishes clean, below bronze`, () => {
      const { steady } = runsFor(level);
      expect(steady.firstStumbleAt).toBeNull();
      expect(steady.state.s).toBeLessThan(medalDepths(level.seconds, level.medals).bronze);
      expect(medalOf(level, steady)).toBeNull();
    });
  }
});

describe('a bold pilot medals', () => {
  for (const level of LEVELS) {
    if (BRONZE_OUT_OF_REACH.has(level.slug)) {
      it.todo(
        `${level.title}: the bold pilot reaches bronze. It does not: most of its floors are one-way (the safe hole ` +
          'and nothing else to thread), so even before the landing the bold pilot averages just under the bronze ' +
          'rate, and the landing (no gains) pulls it lower. Lower its bronze, or give its one-way floors more to earn.',
      );
      continue;
    }
    it(`${level.title}: the bold pilot reaches bronze, and beats the safe path`, () => {
      const { steady, bold } = runsFor(level);
      expect(bold.state.s).toBeGreaterThan(steady.state.s);
      expect({ level: level.slug, medal: medalOf(level, bold), rate: bold.state.s / level.seconds }).toEqual({
        level: level.slug,
        medal: expect.stringMatching(/^(bronze|silver|gold)$/),
        rate: expect.any(Number),
      });
    });
  }

  it('on most levels', () => {
    const short = LEVELS.filter((level) => medalOf(level, runsFor(level).bold) === null).map((level) => level.slug);
    // Every level that falls short is a known design question, listed above.
    expect(short.filter((slug) => !BRONZE_OUT_OF_REACH.has(slug))).toEqual([]);
    expect(short.length).toBeLessThanOrEqual(2);
  });

  it('risk pays on every level, even where it does not medal', () => {
    for (const level of LEVELS) {
      const { steady, bold } = runsFor(level);
      expect({ level: level.slug, ahead: bold.state.s > steady.state.s }).toEqual({ level: level.slug, ahead: true });
    }
  });
});
