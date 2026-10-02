/**
 * @jest-environment node
 */
import { Course } from '@/components/fly/engine/course';
import { FallEngine } from '@/components/fly/engine/FallEngine';
import type { FormKind } from '@/components/fly/engine/types';
import { POOL_CAPACITY } from '@/components/fly/scene/capacity';
import { ATTRACT_COURSE, LEVELS, type CourseSpec } from '@/lib/fly/album';

/**
 * Every form the director holds is stone he can hit, so the renderer must be
 * able to draw all of them at once. Fly each course at base and at top speed
 * and keep the most of each kind ever built; it must fit the pools with room
 * to spare (a form that does not fit waits for a slot, but it should never
 * have to).
 */

const HEADROOM = 0.8;

function peaks(spec: CourseSpec, flow: number, seconds: number): Record<FormKind, number> {
  const course = new Course(spec);
  const engine = new FallEngine(course, 'player');
  const state = engine.state;
  const most: Record<FormKind, number> = { block: 0, prism: 0, ring: 0 };
  const end = Math.min(course.endTick, Math.round(seconds * 120));
  while (!engine.done && state.tick < end) {
    state.flow = flow;
    const aim = course.pathAt(course.sectionAt(state.s) + 1);
    engine.steer(aim.x - state.aimX, aim.y - state.aimY);
    engine.tick();
    if (state.tick % 12 !== 0) continue;
    const count: Record<FormKind, number> = { block: 0, prism: 0, ring: 0 };
    for (const form of engine.director.forms()) count[form.kind] += 1;
    for (const kind of Object.keys(count) as FormKind[]) most[kind] = Math.max(most[kind], count[kind]);
  }
  return most;
}

describe('the world always fits what the renderer can draw', () => {
  const courses: [string, CourseSpec, number][] = [
    ...LEVELS.map((level): [string, CourseSpec, number] => [level.title, level.course, level.seconds]),
    ['the title fall', ATTRACT_COURSE, 300],
  ];
  for (const [name, spec, seconds] of courses) {
    for (const flow of [0, 1]) {
      it(`${name} at ${flow ? 'top' : 'base'} speed`, () => {
        const most = peaks(spec, flow, seconds);
        for (const kind of Object.keys(most) as FormKind[]) {
          expect(most[kind]).toBeLessThanOrEqual(Math.floor(POOL_CAPACITY[kind] * HEADROOM));
        }
      });
    }
  }
});
