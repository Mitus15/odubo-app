/**
 * @jest-environment node
 */
import { steadyPilot } from '@/components/fly/engine/bots';
import { ATTRACT_COURSE, LEVELS } from '@/lib/fly/album';

/**
 * Every level can be fallen without a touch, at base speed and at top speed,
 * by a pilot who only ever aims for the next floor's safe hole, reacts 0.2 s
 * late, and looks no further than that floor.
 */

describe('every level can be fallen clean', () => {
  for (const level of LEVELS) {
    it(`${level.title}: the whole song at base speed`, () => {
      const run = steadyPilot(level.course, { forceFlow: 0 });
      expect(run.firstStumbleAt).toBeNull();
      expect(run.state.tick).toBe(Math.round(level.seconds * 120));
    });

    it(`${level.title}: the whole song at top speed`, () => {
      const run = steadyPilot(level.course, { forceFlow: 1 });
      expect(run.firstStumbleAt).toBeNull();
      expect(run.state.s).toBeGreaterThan(level.seconds * 60);
    });
  }

  it('the title fall, for ten minutes', () => {
    const run = steadyPilot(ATTRACT_COURSE, { forceFlow: 0.3, seconds: 600 });
    expect(run.firstStumbleAt).toBeNull();
  });
});

describe('other seeds of the same recipes are flyable too', () => {
  for (const level of LEVELS) {
    for (const key of [101, 202, 303, 404]) {
      it(`${level.title}, seed ${key}: a minute at top speed`, () => {
        const run = steadyPilot({ ...level.course, key: level.course.key * 1000 + key }, { forceFlow: 1, seconds: 60 });
        expect(run.firstStumbleAt).toBeNull();
      });
    }
  }
});
