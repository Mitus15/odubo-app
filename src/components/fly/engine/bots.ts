import { FALL, FLOW } from '@/lib/fly/rules';
import type { CourseSpec } from '@/lib/fly/album';
import { Course } from './course';
import { FallEngine, type FallState } from './FallEngine';
import type { Hole } from './types';

/**
 * Pilots that fly a whole course on their own, for the tests that prove every
 * level can be fallen and for setting each level's medals.
 *
 * Every bot decides from what a person could see (the next floor and the air
 * before it) and acts 0.2 s late.
 */

const REACTION_TICKS = 24;

export interface BotOptions {
  /** Hold flow at this value every step (0 = base speed, 1 = top speed). */
  forceFlow?: number;
  /** Stop after this many seconds instead of at the end of the song. */
  seconds?: number;
}

export interface BotRun {
  state: FallState;
  /** The step of the first stumble, or null for a clean run. */
  firstStumbleAt: number | null;
}

type Decide = (engine: FallEngine, course: Course) => { x: number; y: number };

function fly(spec: CourseSpec, decide: Decide, options: BotOptions): BotRun {
  const course = new Course(spec);
  const engine = new FallEngine(course, 'player');
  const state = engine.state;
  const queue: { x: number; y: number }[] = [];
  const endTick = options.seconds ? Math.round(options.seconds * FALL.ticksPerSecond) : course.endTick;
  let firstStumbleAt: number | null = null;
  while (!engine.done && state.tick < endTick) {
    if (options.forceFlow !== undefined) state.flow = options.forceFlow;
    queue.push(decide(engine, course));
    const decided = queue.length > REACTION_TICKS ? queue.shift()! : queue[0];
    engine.steer(decided.x - state.aimX, decided.y - state.aimY);
    engine.tick();
    if (state.stumbles > 0 && firstStumbleAt === null) firstStumbleAt = state.tick;
  }
  return { state, firstStumbleAt };
}

/** Only ever the next floor's safe hole. Takes no risk, earns no speed. */
export function steadyPilot(spec: CourseSpec, options: BotOptions = {}): BotRun {
  return fly(spec, (engine, course) => course.pathAt(course.sectionAt(engine.state.s) + 1), options);
}

/**
 * Takes the most valuable hole it can still reach, and any gate on the way.
 * `boldness` is the share of its reach it trusts (0.6 careful, 0.85 bold).
 */
export function skilledPilot(spec: CourseSpec, boldness: number, options: BotOptions = {}): BotRun {
  let committedFloor = -1;
  let committed: Hole | null = null;
  const reachIn = (engine: FallEngine, seconds: number) => {
    const cap = Math.max(FALL.minLateral, FALL.glide * engine.state.speed);
    return cap * Math.max(0, seconds - 0.55) * boldness;
  };
  return fly(
    spec,
    (engine, course) => {
      const state = engine.state;
      const k = course.sectionAt(state.s) + 1;
      const section = engine.director.section(k - 1);
      if (section) {
        for (const form of section.forms) {
          if (form.role !== 'gate' || form.s <= state.s + 2) continue;
          const dx = form.x - state.x;
          const dy = form.y - state.y;
          if (Math.sqrt(dx * dx + dy * dy) <= reachIn(engine, (form.s - state.s) / state.speed)) {
            return { x: form.x, y: form.y };
          }
        }
      }
      const floor = engine.director.floor(k);
      if (!floor) return course.pathAt(k);
      if (committedFloor !== k) {
        const reach = reachIn(engine, (course.floorS(k) - state.s) / state.speed);
        let best: Hole | null = null;
        let bestValue = -1;
        for (const hole of floor.holes) {
          const dx = hole.x - state.x;
          const dy = hole.y - state.y;
          if (!hole.safe && Math.sqrt(dx * dx + dy * dy) > reach) continue;
          const value = hole.safe ? FLOW.safeThread : FLOW.thread[hole.size];
          if (value > bestValue) {
            best = hole;
            bestValue = value;
          }
        }
        committed = best;
        committedFloor = k;
      }
      return committed ? { x: committed.x, y: committed.y } : course.pathAt(k);
    },
    options,
  );
}
