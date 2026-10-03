/**
 * @jest-environment node
 */
import * as THREE from 'three';
import { ATTRACT_COURSE, levelBySlug, STAGES, type CourseSpec } from '@/lib/fly/album';
import { FALL, FLOW, kissFlow } from '@/lib/fly/rules';
import { Course } from '@/components/fly/engine/course';
import { CourseDirector } from '@/components/fly/engine/CourseDirector';
import { dcos, dsin, DPI } from '@/components/fly/engine/detmath';
import { FallEngine, type FallState } from '@/components/fly/engine/FallEngine';
import { cutFloor } from '@/components/fly/engine/floor';
import { distanceToForm } from '@/components/fly/engine/geometry';
import { composeSection, ID_STRIDE, type Section } from '@/components/fly/engine/patterns';
import { InputLog } from '@/components/fly/engine/record';
import { createRng, type Rng } from '@/components/fly/engine/rng';
import type { FallEvent, Form, Hole } from '@/components/fly/engine/types';

/**
 * The fall itself: a run is a pure function of its course and its inputs, and
 * every clean line pays what the rules say it pays. The scoring tests fly an
 * empty course with stone placed by hand (CourseDirector.inject), straight
 * down the centre unless they say otherwise.
 */

const h = FALL.step;

// ── Hand-placed stone ──────────────────────────────────────────────────────

/** A course with nothing in it but far-off scenery. */
function emptySpec(extra: Partial<CourseSpec> = {}): CourseSpec {
  return {
    key: 4711,
    seconds: Infinity,
    levelIndex: 0,
    spacing: 60,
    mix: { plates: 0, grid: 0, oneway: 0, crack: 0, open: 1 },
    pillars: 0,
    shards: 0,
    gates: 0,
    difficulty: 0,
    harmlessFrom: null,
    ...extra,
  };
}

type FormFields = Pick<Form, 'kind' | 'role' | 'x' | 'y' | 's' | 'hx' | 'hy' | 'hs'> & Partial<Form>;

function makeForm(fields: FormFields): Form {
  const yaw = fields.yaw ?? 0;
  const id = fields.id ?? 0;
  return {
    id,
    group: id,
    yaw,
    cos: dcos(yaw),
    sin: dsin(yaw),
    shade: 0.5,
    accent: false,
    solid: fields.role !== 'gate' && fields.role !== 'scenery',
    ...fields,
  };
}

function hole(x: number, y: number, hw: number, hh: number, safe = false): Omit<Hole, 'size'> {
  return { x, y, hw, hh, safe };
}

/** Stone placed by hand in section k: an optional floor (with its holes) and loose forms. */
function place(
  engine: FallEngine,
  k: number,
  stone: { holes?: Omit<Hole, 'size'>[]; floorHalf?: number; forms?: Omit<FormFields, 'id'>[] },
): Section {
  const course = engine.course;
  let n = 1;
  const forms: Form[] = [];
  let floor: Section['floor'] = null;
  if (stone.holes) {
    const holes: Hole[] = stone.holes.map((made) => ({
      ...made,
      size: sizeOf(made.hw * 2, made.hh * 2),
    }));
    const s = course.floorS(k);
    const hs = stone.floorHalf ?? 0.6;
    floor = { id: k, s, hs, holes };
    for (const piece of cutFloor(FALL.floorReach, holes)) {
      const form = makeForm({
        id: k * ID_STRIDE + n++,
        kind: 'block',
        role: 'floor',
        x: (piece.x0 + piece.x1) / 2,
        y: (piece.y0 + piece.y1) / 2,
        s,
        hx: (piece.x1 - piece.x0) / 2,
        hy: (piece.y1 - piece.y0) / 2,
        hs,
      });
      form.group = k * ID_STRIDE;
      forms.push(form);
    }
  }
  for (const fields of stone.forms ?? []) forms.push(makeForm({ ...fields, id: k * ID_STRIDE + n++ }));
  const section: Section = { k, floor, forms };
  engine.director.inject(k, section);
  return section;
}

function sizeOf(width: number, height: number): Hole['size'] {
  const side = Math.min(width, height);
  return side <= 2.8 ? 'narrow' : side <= 4.6 ? 'medium' : 'wide';
}

function pillar(x: number, y: number, top: number, bottom: number, radius: number): Omit<FormFields, 'id'> {
  return { kind: 'prism', role: 'pillar', x, y, s: (top + bottom) / 2, hx: radius, hy: radius, hs: (bottom - top) / 2 };
}

function ring(x: number, y: number, s: number, radius: number): Omit<FormFields, 'id'> {
  return { kind: 'ring', role: 'gate', x, y, s, hx: radius, hy: 0, hs: 0.18 };
}

interface Logged {
  tick: number;
  event: FallEvent;
}

/** One engine on an empty course, flown hands-off, with every event kept. */
class Rig {
  readonly engine: FallEngine;
  readonly events: Logged[] = [];
  /** Flow at the end of every step, by tick. */
  readonly flows: number[] = [0];
  /** Run before every step, to hold flow or speed where a test wants it. */
  before: ((state: FallState) => void) | null = null;

  constructor(spec: CourseSpec = emptySpec()) {
    this.engine = new FallEngine(new Course(spec), 'player');
  }

  get state(): FallState {
    return this.engine.state;
  }

  step(): void {
    this.before?.(this.engine.state);
    this.engine.tick();
    const state = this.engine.state;
    this.flows[state.tick] = state.flow;
    for (const event of this.engine.drainEvents()) this.events.push({ tick: state.tick, event });
  }

  /** Step until he is deeper than s. */
  fallTo(s: number, each?: (state: FallState) => void): void {
    let guard = 0;
    while (this.engine.state.s <= s) {
      this.step();
      each?.(this.engine.state);
      if (++guard > 200_000) throw new Error(`never reached ${s}`);
    }
  }

  of<T extends FallEvent['type']>(type: T): Extract<FallEvent, { type: T }>[] {
    return this.events.map((logged) => logged.event).filter((event): event is Extract<FallEvent, { type: T }> => event.type === type);
  }
}

// ── Determinism ────────────────────────────────────────────────────────────

/**
 * A fidgety person: heads for the next safe hole and wanders off it. The
 * finger moves in whole aim quanta, so the aim sits on the quantum grid: a
 * split of a slide into eighths adds up exactly, and one that is off in the
 * last bit still quantises the same.
 */
function fidget(rng: Rng): (engine: FallEngine) => [number, number] {
  let wanderX = 0;
  let wanderY = 0;
  const grid = FALL.aimQuantum;
  return (engine) => {
    const state = engine.state;
    const course = engine.course;
    if (rng() < 0.02) {
      wanderX = (rng() * 2 - 1) * 4;
      wanderY = (rng() * 2 - 1) * 4;
    }
    const target = course.pathAt(course.sectionAt(state.s) + 1);
    const wantX = Math.max(-15, Math.min(15, target.x + wanderX));
    const wantY = Math.max(-15, Math.min(15, target.y + wanderY));
    const dx = Math.round((wantX - state.aimX) * 0.2 * grid) / grid;
    const dy = Math.round((wantY - state.aimY) * 0.2 * grid) / grid;
    return [dx, dy];
  };
}

const THREE_MINUTES = 180 * FALL.ticksPerSecond;

function withoutAim(state: FallState): Omit<FallState, 'aimX' | 'aimY'> {
  const { aimX: _aimX, aimY: _aimY, ...rest } = state;
  void _aimX;
  void _aimY;
  return rest;
}

describe('a run is a pure function of its course and its inputs', () => {
  const spec = levelBySlug('the-mind-pt-1')!.course;

  it('two engines fed the same slides fly the same three minutes, however the slides are chunked', () => {
    const one = new FallEngine(new Course(spec), 'player');
    const exact = new FallEngine(new Course(spec), 'player');
    const loose = new FallEngine(new Course(spec), 'player');
    const decide = fidget(createRng(99));
    const chunking = createRng(7);
    const events: FallEvent[][] = [[], [], []];
    let quantisedApart = 0;

    for (let t = 0; t < THREE_MINUTES; t++) {
      const [dx, dy] = decide(one);
      one.steer(dx, dy);

      // The same slide in one to four dyadic pieces: the sums are exact.
      const pieces = 1 + Math.floor(chunking() * 4);
      let restX = dx;
      let restY = dy;
      for (let p = 1; p < pieces; p++) {
        const share = Math.floor(chunking() * 9) / 8;
        const partX = restX * share;
        const partY = restY * share;
        exact.steer(partX, partY);
        restX -= partX;
        restY -= partY;
      }
      exact.steer(restX, restY);

      // And in pieces that do not add up exactly; only the quantised aim must agree.
      loose.steer(dx * 0.3, dy * 0.7);
      loose.steer(dx * 0.7, dy * 0.3);

      one.tick();
      exact.tick();
      loose.tick();
      if (loose.state.qx !== one.state.qx || loose.state.qy !== one.state.qy) quantisedApart++;
      events[0].push(...one.drainEvents());
      events[1].push(...exact.drainEvents());
      events[2].push(...loose.drainEvents());
    }

    // The run did things worth checking.
    expect(one.state.threads).toBeGreaterThan(20);
    expect(one.state.kisses).toBeGreaterThan(0);
    expect(one.state.gates).toBeGreaterThan(0);
    expect(one.state.stumbles).toBeGreaterThan(0);

    expect(exact.state).toEqual(one.state);
    expect(exact.trajectory).toEqual(one.trajectory);
    expect(exact.inputs.entries).toEqual(one.inputs.entries);
    expect(events[1]).toEqual(events[0]);

    expect(quantisedApart).toBe(0);
    expect(withoutAim(loose.state)).toEqual(withoutAim(one.state));
    expect(Math.abs(loose.state.aimX - one.state.aimX)).toBeLessThan(1e-9);
    expect(loose.trajectory).toEqual(one.trajectory);
    expect(loose.inputs.entries).toEqual(one.inputs.entries);
    expect(events[2]).toEqual(events[0]);
  });

  it('a whole level replayed from its InputLog flies the same run, bit for bit', () => {
    const live = new FallEngine(new Course(spec), 'player');
    const decide = fidget(createRng(3));
    const liveEvents: FallEvent[] = [];
    while (!live.done) {
      const [dx, dy] = decide(live);
      live.steer(dx, dy);
      live.tick();
      liveEvents.push(...live.drainEvents());
    }

    // As a leaderboard would receive it: through JSON.
    const log = new InputLog();
    for (const value of JSON.parse(JSON.stringify(live.inputs.entries)) as number[]) log.entries.push(value);
    expect(log.entries).toEqual(live.inputs.entries);
    expect(log.length).toBeLessThan(live.state.tick);

    const replay = new FallEngine(new Course(spec), 'auto');
    replay.load(new Course(spec), 'replay', log);
    const replayEvents: FallEvent[] = [];
    replay.advanceTo(Infinity);
    replayEvents.push(...replay.drainEvents());

    expect(replay.state.tick).toBe(Math.round(spec.seconds * FALL.ticksPerSecond));
    expect(withoutAim(replay.state)).toEqual(withoutAim(live.state));
    expect(replay.trajectory.xs).toEqual(live.trajectory.xs);
    expect(replay.trajectory.ys).toEqual(live.trajectory.ys);
    expect(replay.trajectory.ss).toEqual(live.trajectory.ss);
    expect(replayEvents).toEqual(liveEvents);
  });

  it('only a player steers', () => {
    const engine = new FallEngine(new Course(emptySpec()), 'auto');
    engine.steer(5, 5);
    expect(engine.state.aimX).toBe(0);
    engine.setPilot('player');
    engine.steer(5, -3);
    engine.steer(100, 0);
    expect(engine.state.aimX).toBe(FALL.arena);
    expect(engine.state.aimY).toBe(-3);
  });
});

// ── Threading ──────────────────────────────────────────────────────────────

/** Fly through a floor at section 2 with one hole at the centre; returns the flow it paid. */
function threadOnce(hw: number, safe: boolean): { rig: Rig; paid: number } {
  const rig = new Rig();
  const k = 2;
  const holes = [hole(0, 0, hw, hw, safe)];
  if (!safe) holes.push(hole(10, 10, 3, 3, true));
  place(rig.engine, k, { holes });
  const floorS = rig.engine.course.floorS(k);
  rig.fallTo(floorS - 1);
  rig.state.flow = 0.5;
  rig.state.sinceGain = 0;
  let before = rig.state.flow;
  let paid = 0;
  rig.fallTo(floorS + 5, (state) => {
    if (state.prevS < floorS && state.s >= floorS) paid = state.flow - before + FLOW.drain * h;
    before = state.flow;
  });
  return { rig, paid };
}

describe('threading a hole', () => {
  it('a narrow hole off the safe path pays FLOW.thread.narrow, and beats a wide one', () => {
    const narrow = threadOnce(1.2, false);
    const medium = threadOnce(2.0, false);
    const wide = threadOnce(3.0, false);
    expect(narrow.rig.of('thread')).toEqual([expect.objectContaining({ size: 'narrow', safe: false })]);
    expect(medium.rig.of('thread')).toEqual([expect.objectContaining({ size: 'medium', safe: false })]);
    expect(wide.rig.of('thread')).toEqual([expect.objectContaining({ size: 'wide', safe: false })]);
    expect(narrow.paid).toBeCloseTo(FLOW.thread.narrow, 12);
    expect(medium.paid).toBeCloseTo(FLOW.thread.medium, 12);
    expect(wide.paid).toBeCloseTo(FLOW.thread.wide, 12);
    expect(narrow.paid).toBeGreaterThan(medium.paid);
    expect(medium.paid).toBeGreaterThan(wide.paid);
    expect(narrow.rig.state.threads).toBe(1);
    expect(narrow.rig.state.narrowThreads).toBe(1);
    expect(wide.rig.state.narrowThreads).toBe(0);
    // 0.75 m of clearance is no kiss.
    expect(narrow.rig.of('kiss')).toEqual([]);
    expect(narrow.rig.state.stumbles).toBe(0);
  });

  it('the safe hole pays FLOW.safeThread whatever its size', () => {
    for (const hw of [1.2, 2.0, 3.0]) {
      const run = threadOnce(hw, true);
      expect(run.rig.of('thread')).toEqual([expect.objectContaining({ safe: true })]);
      expect(run.paid).toBeCloseTo(FLOW.safeThread, 12);
      expect(run.rig.state.narrowThreads).toBe(0);
    }
  });

  it('stone where there is no hole is a stumble, not a thread', () => {
    const rig = new Rig();
    place(rig.engine, 2, { holes: [hole(10, 10, 3, 3, true)] });
    rig.fallTo(rig.engine.course.floorS(2) + 5);
    expect(rig.of('thread')).toEqual([]);
    expect(rig.state.stumbles).toBe(1);
  });
});

// ── Kisses ─────────────────────────────────────────────────────────────────

/** Thread a hole whose right edge is `clearance` from his body; everything else is 3 m off. */
function passEdge(clearance: number): Rig {
  const rig = new Rig();
  const right = FALL.playerRadius + clearance;
  place(rig.engine, 2, { holes: [hole((right - 3) / 2, 0, (right + 3) / 2, 3, false)] });
  rig.fallTo(rig.engine.course.floorS(2) + 10);
  return rig;
}

describe('kisses', () => {
  it('passing a floor edge with 0.2 m to spare is a kiss, and says how close', () => {
    const rig = passEdge(0.2);
    const kisses = rig.of('kiss');
    expect(kisses).toHaveLength(1);
    expect(kisses[0].clearance).toBeCloseTo(0.2, 9);
    expect(rig.state.kisses).toBe(1);
    expect(rig.state.stumbles).toBe(0);
    // It paid by how close it was: the thread, then the kiss on top.
    // It paid by how close it was, on the step it was judged.
    const at = rig.events.find((logged) => logged.event.type === 'kiss')!.tick;
    expect(rig.flows[at] - rig.flows[at - 1] + FLOW.drain * h).toBeCloseTo(kissFlow(0.2), 12);
    expect(kissFlow(0.2)).toBeGreaterThan(FLOW.kissMin);
    expect(rig.of('thread')).toEqual([expect.objectContaining({ size: 'medium', safe: false })]);
  });

  it('two metres off an edge is no kiss', () => {
    const rig = passEdge(2);
    expect(rig.of('kiss')).toEqual([]);
    expect(rig.state.kisses).toBe(0);
    expect(rig.of('thread')).toHaveLength(1);
  });

  it('a turned shard kisses the same way', () => {
    const rig = new Rig();
    const s = rig.engine.course.floorS(2) + 20;
    // A quarter turn: its hy lies along x.
    place(rig.engine, 2, {
      forms: [{ kind: 'block', role: 'shard', x: -(FALL.playerRadius + 0.3 + 0.7), y: 0.4, s, hx: 1.5, hy: 0.7, hs: 0.8, yaw: DPI / 2 }],
    });
    rig.fallTo(s + 5);
    const kisses = rig.of('kiss');
    expect(kisses).toHaveLength(1);
    expect(kisses[0].clearance).toBeCloseTo(0.3, 9);
  });
});

// ── Hugs ───────────────────────────────────────────────────────────────────

function hugPillar(clearance: number): { rig: Rig; paid: number; hugTicks: number } {
  const rig = new Rig(emptySpec({ spacing: 90 }));
  const radius = 1.5;
  const top = rig.engine.course.floorS(2) + 10;
  const bottom = top + 60;
  place(rig.engine, 2, { forms: [pillar(radius + FALL.playerRadius + clearance, 0, top, bottom, radius)] });
  rig.fallTo(top - 5);
  let flowBefore = rig.state.flow;
  let paid = 0;
  let hugTicks = 0;
  rig.fallTo(bottom + 5, (state) => {
    if (state.hugging) {
      hugTicks++;
      paid += state.flow - flowBefore + FLOW.drain * h;
    }
    flowBefore = state.flow;
  });
  return { rig, paid, hugTicks };
}

describe('hugging a pillar', () => {
  it('a metre off a pillar for about two seconds pays hugRate · seconds · (0.5 + 0.5 · closeness)', () => {
    const { rig, paid, hugTicks } = hugPillar(1);
    const seconds = rig.state.hugSeconds;
    expect(seconds).toBeGreaterThan(1.7);
    expect(seconds).toBeLessThan(2.1);
    expect(hugTicks * h).toBeCloseTo(seconds, 9);
    const closeness = 1 - 1 / FLOW.hugBand;
    const expected = FLOW.hugRate * seconds * (0.5 + 0.5 * closeness);
    expect(Math.abs(paid - expected) / expected).toBeLessThan(0.01);
    expect(rig.of('hug')).toEqual([{ type: 'hug', on: true }, { type: 'hug', on: false }]);
    expect(rig.state.stumbles).toBe(0);
  });

  it('three metres off is no hug', () => {
    const { rig, paid } = hugPillar(3);
    expect(rig.state.hugSeconds).toBe(0);
    expect(paid).toBe(0);
    expect(rig.of('hug')).toEqual([]);
  });
});

// ── Gates ──────────────────────────────────────────────────────────────────

describe('gates', () => {
  it('falling through a gate inside its inner radius pays FLOW.gate, once', () => {
    const rig = new Rig();
    const s = rig.engine.course.floorS(2) + 20;
    place(rig.engine, 2, { forms: [ring(1.0, 0.5, s, 3), ring(2.8, 0, s + 15, 3)] });
    let jump = 0;
    let before = 0;
    rig.fallTo(s + 30, (state) => {
      if (state.prevS < s && state.s >= s) jump = state.flow - before + FLOW.drain * h;
      before = state.flow;
    });
    // The first is 1.1 m off the centre of a 3 m ring; the second 2.8 m off, past its inner edge.
    expect(rig.of('gate')).toEqual([{ type: 'gate', x: 1.0, y: 0.5, s }]);
    expect(rig.state.gates).toBe(1);
    expect(jump).toBeCloseTo(FLOW.gate, 12);
    expect(rig.state.stumbles).toBe(0);
  });
});

// ── Flow and speed ─────────────────────────────────────────────────────────

describe('flow is speed', () => {
  it('flow held at one brings speed to exactly FALL.maxSpeed, at accelUp', () => {
    const rig = new Rig();
    rig.before = (state) => {
      state.flow = 1;
    };
    const rise = (FALL.maxSpeed - FALL.baseSpeed) / FALL.accelUp;
    while (rig.state.tick < Math.floor((rise - 0.5) / h)) rig.step();
    expect(rig.state.speed).toBeLessThan(FALL.maxSpeed);
    expect(rig.state.speed).toBeCloseTo(FALL.baseSpeed + FALL.accelUp * rig.state.tick * h, 6);
    while (rig.state.tick < Math.ceil((rise + 0.5) / h)) rig.step();
    expect(rig.state.speed).toBe(FALL.maxSpeed);
    expect(rig.state.topSpeed).toBe(FALL.maxSpeed);
  });

  it('flow drains at FLOW.drain, and faster after FLOW.idleDelay with no gain', () => {
    const rig = new Rig();
    rig.fallTo(10);
    rig.state.flow = 0.8;
    rig.state.sinceGain = 0;
    for (let i = 0; i < 120; i++) rig.step();
    expect(rig.state.flow).toBeCloseTo(0.8 - FLOW.drain, 9);
    for (let i = 0; i < 360; i++) rig.step();
    const seconds = 4;
    const expected = 0.8 - FLOW.drain * seconds - FLOW.idleDrain * (seconds - FLOW.idleDelay);
    expect(Math.abs(rig.state.flow - expected)).toBeLessThan(FLOW.idleDrain * h * 1.01);
    // And it never goes below nothing.
    for (let i = 0; i < 120 * 20; i++) rig.step();
    expect(rig.state.flow).toBe(0);
  });
});

// ── Stumbles ───────────────────────────────────────────────────────────────

describe('a stumble', () => {
  it('takes all flow, halves speed and ghosts him through stone, counting down only once clear', () => {
    const rig = new Rig(emptySpec({ spacing: 90 }));
    const course = rig.engine.course;
    const top = course.floorS(2) + 10;
    // A, then B straight after (still stumbling), then C once he has recovered.
    place(rig.engine, 2, { forms: [pillar(0, 0, top, top + 30, 2), pillar(0, 0, top + 33, top + 40, 2)] });
    place(rig.engine, 3, { forms: [pillar(0, 0, course.floorS(3) + 30, course.floorS(3) + 40, 2)] });

    rig.fallTo(top - 10);
    rig.before = (state) => {
      state.flow = 1;
      state.speed = FALL.maxSpeed;
    };
    rig.fallTo(top - 3);
    let hitAt = -1;
    while (rig.state.stumbles === 0) rig.step();
    rig.before = null;
    hitAt = rig.state.tick;
    expect(rig.state.flow).toBe(0);
    expect(rig.state.speed).toBe(FALL.maxSpeed * FALL.stumbleSpeed);
    expect(rig.state.stumble).toBe(FALL.stumbleSeconds);
    expect(rig.state.inside).toBe(true);

    let clearTicks = 0;
    let insideTicks = 0;
    let previous = rig.state.stumble;
    while (rig.state.stumble > 0) {
      rig.step();
      if (rig.state.inside) {
        insideTicks++;
        expect(rig.state.stumble).toBe(previous);
      } else if (previous > 0) {
        clearTicks++;
        expect(previous - rig.state.stumble).toBeCloseTo(Math.min(h, previous), 12);
      }
      previous = rig.state.stumble;
      expect(rig.state.stumbles).toBe(1);
      expect(rig.state.flow).toBe(0);
    }
    // Through A and B, ghosting, and B did not start a second stumble.
    expect(insideTicks).toBeGreaterThan(Math.round(30 / FALL.maxSpeed / h));
    expect(clearTicks).toBeGreaterThanOrEqual(Math.round(FALL.stumbleSeconds / h));
    expect(clearTicks).toBeLessThanOrEqual(Math.round(FALL.stumbleSeconds / h) + 1);
    expect(rig.state.s).toBeGreaterThan(top + 40);
    expect(rig.of('stumble').map(() => 'stumble')).toEqual(['stumble']);
    expect(rig.events.find((logged) => logged.event.type === 'stumble')?.tick).toBe(hitAt);

    // Recovered, C is a new stumble.
    rig.fallTo(course.floorS(3) + 31);
    expect(rig.state.stumbles).toBe(2);
  });

  it('never slows him below FALL.stumbleFloor', () => {
    const rig = new Rig();
    const top = rig.engine.course.floorS(2) + 10;
    place(rig.engine, 2, { forms: [pillar(0, 0, top, top + 10, 2)] });
    rig.fallTo(top - 5);
    rig.before = (state) => {
      state.speed = 20;
    };
    while (rig.state.stumbles === 0) rig.step();
    expect(rig.state.speed).toBe(FALL.stumbleFloor);
  });

  it('pays nothing while it lasts: no thread, gate, kiss or hug', () => {
    const rig = new Rig();
    const course = rig.engine.course;
    const floorS = course.floorS(3);
    const r = FALL.playerRadius;
    place(rig.engine, 2, {
      forms: [
        pillar(0, 0, floorS - 42, floorS - 12, 2),
        ring(0, 0, floorS - 9, 3),
        pillar(1.5 + r + 0.3, 0, floorS - 8, floorS - 3, 1.5),
        { kind: 'block', role: 'shard', x: -(r + 0.2 + 0.5), y: 0, s: floorS - 5.5, hx: 0.5, hy: 0.5, hs: 0.5 },
      ],
    });
    place(rig.engine, 3, { holes: [hole(0, 0, 1.2, 1.2, false), hole(10, 10, 3, 3, true)] });
    // Falling onto the first pillar's top counts as hugging it for the last metre: let that go.
    while (rig.state.stumbles === 0) rig.step();
    const hit = rig.events.length;
    const hugSeconds = rig.state.hugSeconds;
    let stumblingAtFloor = false;
    let flowed = 0;
    rig.fallTo(floorS + 10, (state) => {
      if (state.prevS < floorS && state.s >= floorS) stumblingAtFloor = state.stumble > 0;
      if (state.stumble > 0 && state.flow > 0) flowed++;
    });
    expect(stumblingAtFloor).toBe(true);
    expect(rig.state.stumbles).toBe(1);
    const after = rig.events.slice(hit).map((logged) => logged.event);
    expect(after.filter((event) => event.type !== 'hug' || event.on)).toEqual([]);
    expect(rig.state.threads + rig.state.gates + rig.state.kisses).toBe(0);
    expect(rig.state.hugSeconds).toBe(hugSeconds);
    expect(flowed).toBe(0);
    expect(rig.state.flow).toBe(0);
  });
});

// ── The end and the landing ────────────────────────────────────────────────

describe('the end of a run', () => {
  it('comes at exactly round(seconds · 120) steps, with one end event', () => {
    const rig = new Rig(emptySpec({ seconds: 7.3 }));
    const steps = rig.engine.advanceTo(Infinity);
    rig.events.push(...rig.engine.drainEvents().map((event) => ({ tick: rig.state.tick, event })));
    expect(steps).toBe(876);
    expect(rig.state.tick).toBe(876);
    expect(rig.engine.done).toBe(true);
    expect(rig.of('end')).toHaveLength(1);
    rig.step();
    expect(rig.engine.advanceTo(Infinity)).toBe(0);
    expect(rig.state.tick).toBe(876);
    expect(rig.of('end')).toHaveLength(1);
  });

  for (const stage of STAGES) {
    it(`${stage.title} (${stage.kind}) lasts exactly its song, and the autopilot falls it clean`, () => {
      const engine = new FallEngine(new Course(stage.course), 'auto');
      engine.advanceTo(Infinity);
      const ends = engine.drainEvents().filter((event) => event.type === 'end');
      expect(engine.state.tick).toBe(Math.round(stage.seconds * FALL.ticksPerSecond));
      expect(ends).toHaveLength(1);
      expect(engine.state.stumbles).toBe(0);
    });
  }

  it('the title fall never ends, and the autopilot falls ten minutes of it clean', () => {
    const engine = new FallEngine(new Course(ATTRACT_COURSE), 'auto');
    expect(engine.course.endTick).toBe(Infinity);
    engine.advanceTo(600 * FALL.ticksPerSecond);
    expect(engine.done).toBe(false);
    expect(engine.state.stumbles).toBe(0);
  });
});

// ── The course director ────────────────────────────────────────────────────

describe('the course director', () => {
  const REACH = 2.5;

  for (const slug of ['the-mind-pt-1', 'rap', 'newspeak']) {
    it(`${slug}: visits exactly the forms near him, and tells the renderer every change`, () => {
      const spec = levelBySlug(slug)!.course;
      const course = new Course(spec);
      const director = new CourseDirector(course);
      const sections = 60;
      const depth = course.floorS(sections - 8);

      // Brute force: every form of the first sections, as a band along the fall.
      const bands = Array.from({ length: sections }, (_, k) => composeSection(course, k).forms)
        .flat()
        .filter((form) => form.role !== 'scenery')
        .map((form) => ({ id: form.id, from: form.s - form.hs - REACH, to: form.s + form.hs + REACH }))
        .sort((a, b) => a.from - b.from);

      const live = new Map<number, Form>();
      let next = 0;
      let active: typeof bands = [];
      const mismatches: string[] = [];
      for (let s = 0; s < depth; s += 0.43) {
        director.update(s);
        const { added, removed } = director.drainChanges();
        for (const form of removed) {
          if (!live.delete(form.id)) mismatches.push(`removed ${form.id} that was never added`);
        }
        for (const form of added) {
          if (live.has(form.id)) mismatches.push(`added ${form.id} twice`);
          live.set(form.id, form);
        }
        if (live.size !== director.formCount) mismatches.push(`at ${s}: renderer holds ${live.size}, director ${director.formCount}`);

        while (next < bands.length && bands[next].from <= s) active.push(bands[next++]);
        active = active.filter((band) => band.to >= s);
        const expected = active.map((band) => band.id).sort((a, b) => a - b);
        const visited: number[] = [];
        director.forEachNear(s, REACH, (form) => visited.push(form.id));
        visited.sort((a, b) => a - b);
        if (expected.join() !== visited.join()) mismatches.push(`at ${s.toFixed(2)}: expected ${expected} visited ${visited}`);
        if (mismatches.length > 5) break;
      }
      expect(mismatches).toEqual([]);
    });
  }

  it('a jump ahead builds what is there, and the same stone as falling to it', () => {
    const spec = levelBySlug('makunahea')!.course;
    const course = new Course(spec);
    const jumped = new CourseDirector(course);
    jumped.update(4000);
    const fallen = new CourseDirector(new Course(spec));
    for (let s = 0; s <= 4000; s += 5) fallen.update(s);
    const ids = (director: CourseDirector) => director.forms().map((form) => form.id).sort((a, b) => a - b);
    expect(ids(jumped)).toEqual(ids(fallen));
    const k = course.sectionAt(4000);
    expect(jumped.section(k)).toEqual(fallen.section(k));
  });
});

describe('the landing', () => {
  it('stone is harmless from harmlessFrom, and pays nothing', () => {
    const rig = new Rig(emptySpec({ harmlessFrom: 6 }));
    const course = rig.engine.course;
    // Solid floors (the only hole is far off) at 5 s and after 7 s.
    place(rig.engine, 1, { holes: [hole(12, 12, 3, 3, true)] });
    place(rig.engine, 2, { holes: [hole(12, 12, 3, 3, true)] });
    place(rig.engine, 3, { holes: [hole(0, 0, 1.2, 1.2, false), hole(12, 12, 3, 3, true)] });
    rig.fallTo(course.floorS(1) + 2);
    expect(rig.state.harmless).toBe(false);
    expect(rig.state.stumbles).toBe(1);
    rig.fallTo(course.floorS(3) + 2);
    expect(rig.state.tick).toBeGreaterThan(6 * 120);
    expect(rig.state.harmless).toBe(true);
    expect(rig.state.stumbles).toBe(1);
    expect(rig.of('thread')).toEqual([]);
  });

  it('Ghost World lands: from where the song lets go, nothing he touches counts', () => {
    const level = levelBySlug('ghost-world')!;
    expect(level.landing).toBe(true);
    const course = new Course(level.course);
    expect(course.harmlessFromTick).toBe(Math.round(level.fallsAwayAt * FALL.ticksPerSecond));
    expect(course.harmlessFromTick).toBeLessThan(course.endTick);

    // Straight down the middle, hands off: he hits plenty before the landing.
    const engine = new FallEngine(course, 'player');
    engine.advanceTo(course.harmlessFromTick);
    const stumblesBefore = engine.state.stumbles;
    expect(stumblesBefore).toBeGreaterThan(0);
    engine.drainEvents();
    let flow = engine.state.flow;
    let solid = 0;
    let grew = 0;
    while (!engine.done) {
      engine.tick();
      if (!engine.state.harmless) solid++;
      if (engine.state.flow > flow) grew++;
      flow = engine.state.flow;
    }
    expect(solid).toBe(0);
    expect(grew).toBe(0);
    expect(engine.state.stumbles).toBe(stumblesBefore);
    const scored = engine.drainEvents().filter((event) => event.type !== 'end' && event.type !== 'hug');
    expect(scored).toEqual([]);
  });
});

// ── The distance field, against three.js ───────────────────────────────────

/** Where a path-space point sits in the scene: X = x, Y = −s, Z = −y. */
function toScene(x: number, y: number, s: number): THREE.Vector3 {
  return new THREE.Vector3(x, -s, -y);
}

/** The form as the renderer places it: a unit box or cylinder, moved, turned and scaled. */
function sceneObject(form: Form): THREE.Object3D {
  const object = new THREE.Object3D();
  object.position.copy(toScene(form.x, form.y, form.s));
  object.rotation.y = form.yaw;
  if (form.kind === 'block') object.scale.set(form.hx, form.hs, form.hy);
  else object.scale.set(form.hx, form.hs, form.hx);
  object.updateMatrixWorld(true);
  return object;
}

function sceneDistance(form: Form, x: number, y: number, s: number): number {
  const local = sceneObject(form).worldToLocal(toScene(x, y, s));
  const lx = local.x * form.hx;
  const ls = local.y * form.hs;
  const lz = local.z * (form.kind === 'block' ? form.hy : form.hx);
  if (form.kind === 'block') {
    const q = [Math.abs(lx) - form.hx, Math.abs(ls) - form.hs, Math.abs(lz) - form.hy];
    const outside = Math.hypot(...q.map((v) => Math.max(v, 0)));
    return outside + Math.min(Math.max(...q), 0);
  }
  const radial = Math.hypot(lx, lz) - form.hx;
  const along = Math.abs(ls) - form.hs;
  return Math.hypot(Math.max(radial, 0), Math.max(along, 0)) + Math.min(Math.max(radial, along), 0);
}

describe('the distance field matches the scene three.js draws', () => {
  const rng = createRng(2024);
  const between = (min: number, max: number) => min + (max - min) * rng();

  it('for turned blocks', () => {
    let worst = 0;
    let inside = 0;
    for (let i = 0; i < 400; i++) {
      const block = makeForm({
        kind: 'block',
        role: 'shard',
        x: between(-15, 15),
        y: between(-15, 15),
        s: between(0, 500),
        hx: between(0.3, 6),
        hy: between(0.3, 6),
        hs: between(0.3, 4),
        yaw: between(-DPI, DPI),
      });
      for (let j = 0; j < 20; j++) {
        const x = block.x + between(-1.5, 1.5) * (block.hx + block.hy);
        const y = block.y + between(-1.5, 1.5) * (block.hx + block.hy);
        const s = block.s + between(-1.5, 1.5) * block.hs;
        const engine = distanceToForm(block, x, y, s);
        if (engine < 0) inside++;
        worst = Math.max(worst, Math.abs(engine - sceneDistance(block, x, y, s)));
      }
    }
    expect(inside).toBeGreaterThan(200);
    expect(worst).toBeLessThan(1e-9);
  });

  it('for prisms, round the fall', () => {
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      const prism = makeForm({
        kind: 'prism',
        role: 'pillar',
        x: between(-15, 15),
        y: between(-15, 15),
        s: between(0, 500),
        hx: between(0.5, 3),
        hy: 0,
        hs: between(0.5, 30),
        yaw: between(-DPI, DPI),
      });
      for (let j = 0; j < 20; j++) {
        const x = prism.x + between(-3, 3) * prism.hx;
        const y = prism.y + between(-3, 3) * prism.hx;
        const s = prism.s + between(-1.5, 1.5) * prism.hs;
        worst = Math.max(worst, Math.abs(distanceToForm(prism, x, y, s) - sceneDistance(prism, x, y, s)));
      }
    }
    expect(worst).toBeLessThan(1e-9);
  });

  it('a quarter turn lays a block along y', () => {
    const block = makeForm({ kind: 'block', role: 'shard', x: 0, y: 0, s: 0, hx: 10, hy: 1, hs: 1, yaw: DPI / 2 });
    expect(distanceToForm(block, 0, 9, 0)).toBeLessThan(0);
    expect(distanceToForm(block, 9, 0, 0)).toBeCloseTo(8, 9);
  });

  it('gates have no surface', () => {
    expect(distanceToForm(makeForm(ring(0, 0, 0, 3)), 0, 0, 0)).toBe(Infinity);
  });
});
