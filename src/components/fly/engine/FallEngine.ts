import { FALL, FLOW, kissFlow } from '@/lib/fly/rules';
import type { Course } from './course';
import { CourseDirector } from './CourseDirector';
import { holeContains } from './floor';
import { distanceToForm } from './geometry';
import { InputCursor, InputLog, SAMPLE_EVERY, Trajectory } from './record';
import type { FallEvent, Form, Hole } from './types';

/** Who is steering: a person, the autopilot (title, cutscenes), or a recorded run. */
export type Pilot = 'player' | 'auto' | 'replay';

export interface FallState {
  /** Steps since the start of the run; the run's time is tick / 120. */
  tick: number;
  /** Depth (m), and where it was one step ago. */
  s: number;
  prevS: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  /** Where the finger is steering him (m), before it is quantised. */
  aimX: number;
  aimY: number;
  /** The quantised aim the step used (1/64 m units). */
  qx: number;
  qy: number;
  /** Fall speed (m/s) and flow (0..1). Flow is what speed is made of. */
  speed: number;
  flow: number;
  /** Seconds since flow last grew. */
  sinceGain: number;
  /** Seconds of stumble left. Counts down only once he is clear of stone. */
  stumble: number;
  /** Inside stone this step (only possible while stumbling). */
  inside: boolean;
  /** Distance from his body to the nearest stone (m). */
  nearest: number;
  hugging: boolean;
  /** The landing: stone is no longer solid. */
  harmless: boolean;
  done: boolean;
  // What the run did, for the result screen.
  threads: number;
  narrowThreads: number;
  kisses: number;
  gates: number;
  stumbles: number;
  hugSeconds: number;
  topSpeed: number;
}

interface KissWatch {
  /** Least clearance seen so far (m). */
  min: number;
  /** Resolved once he is deeper than this. */
  until: number;
  /** Touched: no kiss. */
  hit: boolean;
}

const SCAN = FALL.playerRadius + Math.max(FLOW.kissBand, FLOW.hugBand) + 0.5;

function freshState(): FallState {
  return {
    tick: 0,
    s: 0,
    prevS: 0,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    aimX: 0,
    aimY: 0,
    qx: 0,
    qy: 0,
    speed: FALL.baseSpeed,
    flow: 0,
    sinceGain: 0,
    stumble: 0,
    inside: false,
    nearest: Infinity,
    hugging: false,
    harmless: false,
    done: false,
    threads: 0,
    narrowThreads: 0,
    kisses: 0,
    gates: 0,
    stumbles: 0,
    hugSeconds: 0,
    topSpeed: FALL.baseSpeed,
  };
}

/**
 * The fall itself, with no drawing in it: Recoolman's motion, what he touches
 * and what clean lines are worth. Pure TypeScript, one fixed step at a time,
 * and only + − × ÷ and Math.sqrt inside a step, so a run replays bit for bit
 * on any phone or server from its InputLog.
 *
 * Every run starts the same way: tick 0, depth 0, the centre, base speed, no
 * flow. Space is the course (the stone is laid out by depth); time is the song
 * (a run lasts exactly as long as its song).
 */
export class FallEngine {
  course: Course;
  readonly director: CourseDirector;
  readonly state: FallState = freshState();
  pilot: Pilot = 'auto';
  readonly inputs = new InputLog();
  readonly trajectory = new Trajectory();
  /** Counts loads, so the renderer knows to start its world over. */
  generation = 0;

  private events: FallEvent[] = [];
  private holdX = 0;
  private holdY = 0;
  private cursor: InputCursor | null = null;
  private watches = new Map<number, KissWatch>();
  private gatesSeen = new Set<number>();
  // Per-step scratch, so the step allocates nothing.
  private nearest = Infinity;
  private hugCloseness = 0;
  private gained = false;
  private gateFlow = 0;
  private readonly visit = (form: Form) => this.consider(form);

  constructor(course: Course, pilot: Pilot = 'auto') {
    this.course = course;
    this.director = new CourseDirector(course);
    this.load(course, pilot);
  }

  /** Begin a run on `course` from the top. A replay pilot needs the run's log. */
  load(course: Course, pilot: Pilot, replay?: InputLog): void {
    this.course = course;
    this.pilot = pilot;
    Object.assign(this.state, freshState());
    this.events = [];
    this.holdX = 0;
    this.holdY = 0;
    this.cursor = pilot === 'replay' && replay ? new InputCursor(replay) : null;
    this.watches.clear();
    this.gatesSeen.clear();
    this.inputs.clear();
    this.trajectory.clear();
    this.director.reset(course);
    this.director.update(0);
    this.trajectory.push(0, 0, 0);
    this.generation += 1;
  }

  /** Hand the controls over (title to run, autopilot to player) without a restart. */
  setPilot(pilot: Pilot): void {
    this.pilot = pilot;
    this.state.aimX = this.state.qx / FALL.aimQuantum;
    this.state.aimY = this.state.qy / FALL.aimQuantum;
  }

  /** The finger slid (dx, dy) metres. Takes effect at the next step. */
  steer(dx: number, dy: number): void {
    if (this.pilot !== 'player' || this.state.done) return;
    const state = this.state;
    state.aimX = clampArena(state.aimX + dx);
    state.aimY = clampArena(state.aimY + dy);
  }

  /** Held keys, as two axes in −1..1. Applied inside every step. */
  hold(ax: number, ay: number): void {
    this.holdX = ax;
    this.holdY = ay;
  }

  get done(): boolean {
    return this.state.done;
  }

  drainEvents(): FallEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  /** Step until `tick` (or the end of the run). Returns how many steps ran. */
  advanceTo(tick: number, limit = Infinity): number {
    let steps = 0;
    while (this.state.tick < tick && !this.state.done && steps < limit) {
      this.tick();
      steps++;
    }
    return steps;
  }

  /** One fixed step of 1/120 s. */
  tick(): void {
    const state = this.state;
    if (state.done) return;
    const h = FALL.step;
    const course = this.course;

    state.prevS = state.s;
    state.prevX = state.x;
    state.prevY = state.y;
    state.harmless = state.tick >= course.harmlessFromTick;

    this.chooseAim();

    // Speed closes on what flow is worth; a stumble takes some of it away.
    let target = FALL.baseSpeed + (FALL.maxSpeed - FALL.baseSpeed) * state.flow;
    if (state.stumble > 0) {
      const recovered = 1 - state.stumble / FALL.stumbleSeconds;
      target *= FALL.stumbleSpeed + (1 - FALL.stumbleSpeed) * recovered;
    }
    if (state.speed < target) {
      state.speed = state.speed + FALL.accelUp * h > target ? target : state.speed + FALL.accelUp * h;
    } else {
      state.speed = state.speed - FALL.accelDown * h < target ? target : state.speed - FALL.accelDown * h;
    }
    if (state.speed > state.topSpeed) state.topSpeed = state.speed;

    // Steering: a critically damped spring toward the aim, speed-limited.
    const omega = FALL.omega;
    const tx = state.qx / FALL.aimQuantum;
    const ty = state.qy / FALL.aimQuantum;
    state.vx += (omega * omega * (tx - state.x) - 2 * omega * state.vx) * h;
    state.vy += (omega * omega * (ty - state.y) - 2 * omega * state.vy) * h;
    let cap = FALL.glide * state.speed;
    if (cap < FALL.minLateral) cap = FALL.minLateral;
    if (state.stumble > 0) cap *= FALL.stumbleLateral;
    const lateral = state.vx * state.vx + state.vy * state.vy;
    if (lateral > cap * cap) {
      const scale = cap / Math.sqrt(lateral);
      state.vx *= scale;
      state.vy *= scale;
    }
    state.x += state.vx * h;
    state.y += state.vy * h;
    if (state.x > FALL.arena || state.x < -FALL.arena) {
      state.x = clampArena(state.x);
      state.vx = 0;
    }
    if (state.y > FALL.arena || state.y < -FALL.arena) {
      state.y = clampArena(state.y);
      state.vy = 0;
    }

    state.s += state.speed * h;
    this.director.update(state.s);

    // What is around him now.
    this.nearest = Infinity;
    this.hugCloseness = 0;
    this.gained = false;
    this.gateFlow = 0;
    this.director.forEachNear(state.s, SCAN, this.visit);
    state.nearest = this.nearest;

    const touching = !state.harmless && this.nearest < FALL.playerRadius;
    if (touching) {
      if (state.stumble <= 0) this.stumble();
      state.inside = true;
    } else {
      state.inside = false;
      if (state.stumble > 0) state.stumble = state.stumble - h < 0 ? 0 : state.stumble - h;
    }

    const free = !state.harmless && state.stumble <= 0;
    this.resolveKisses(free);
    this.checkThread(free);
    if (free && this.gateFlow > 0) this.gain(this.gateFlow);

    const hugging = free && this.hugCloseness > 0;
    if (hugging) {
      this.gain(FLOW.hugRate * h * (0.5 + 0.5 * this.hugCloseness));
      state.hugSeconds += h;
    }
    if (hugging !== state.hugging) {
      state.hugging = hugging;
      this.events.push({ type: 'hug', on: hugging });
    }

    if (this.gained) {
      state.sinceGain = 0;
    } else {
      state.sinceGain += h;
      if (state.sinceGain > FLOW.idleDelay) state.flow -= FLOW.idleDrain * h;
    }
    state.flow -= FLOW.drain * h;
    if (state.flow < 0) state.flow = 0;
    if (state.flow > 1) state.flow = 1;

    state.tick += 1;
    if (state.tick % SAMPLE_EVERY === 0) this.trajectory.push(state.x, state.y, state.s);
    if (state.tick >= course.endTick) {
      state.done = true;
      state.hugging = false;
      this.events.push({ type: 'end' });
    }
  }

  // ── Inside a step ────────────────────────────────────────────────────────

  private chooseAim(): void {
    const state = this.state;
    const quantum = FALL.aimQuantum;
    if (this.pilot === 'replay' && this.cursor) {
      this.cursor.at(state.tick);
      state.qx = this.cursor.qx;
      state.qy = this.cursor.qy;
      return;
    }
    if (this.pilot === 'auto') {
      // Straight for the next floor's safe hole, as a person would.
      const target = this.course.pathAt(this.course.sectionAt(state.s) + 1);
      state.aimX = target.x;
      state.aimY = target.y;
    } else {
      const keyStep = FALL.keyRate * FALL.step;
      if (this.holdX !== 0) state.aimX = clampArena(state.aimX + this.holdX * keyStep);
      if (this.holdY !== 0) state.aimY = clampArena(state.aimY + this.holdY * keyStep);
    }
    state.qx = Math.round(state.aimX * quantum);
    state.qy = Math.round(state.aimY * quantum);
    this.inputs.record(state.tick, state.qx, state.qy);
  }

  private consider(form: Form): void {
    const state = this.state;
    if (form.kind === 'ring') {
      this.checkGate(form);
      return;
    }
    if (!form.solid) return;
    const distance = distanceToForm(form, state.x, state.y, state.s);
    if (distance < this.nearest) this.nearest = distance;
    const clearance = distance - FALL.playerRadius;

    if (form.role === 'pillar') {
      if (clearance < FLOW.hugBand) {
        const closeness = 1 - (clearance < 0 ? 0 : clearance) / FLOW.hugBand;
        if (closeness > this.hugCloseness) this.hugCloseness = closeness;
      }
      return;
    }

    // Floors and shards: watch the pass, and judge it once he is through.
    const until = form.s + form.hs + FALL.playerRadius + FLOW.kissBand;
    let watch = this.watches.get(form.group);
    if (!watch) {
      if (clearance >= FLOW.kissBand) return;
      watch = { min: clearance, until, hit: state.stumble > 0 };
      this.watches.set(form.group, watch);
    }
    if (clearance < watch.min) watch.min = clearance;
    if (until > watch.until) watch.until = until;
  }

  private checkGate(form: Form): void {
    const state = this.state;
    if (this.gatesSeen.has(form.id)) return;
    if (state.prevS < form.s && state.s >= form.s) {
      this.gatesSeen.add(form.id);
      const dx = state.x - form.x;
      const dy = state.y - form.y;
      const inner = form.hx - FALL.playerRadius;
      if (dx * dx + dy * dy <= inner * inner && !state.harmless && state.stumble <= 0) {
        state.gates += 1;
        this.gateFlow += FLOW.gate;
        this.events.push({ type: 'gate', x: form.x, y: form.y, s: form.s });
      }
    }
  }

  private resolveKisses(free: boolean): void {
    const state = this.state;
    for (const [group, watch] of this.watches) {
      if (state.stumble > 0) watch.hit = true;
      if (state.s <= watch.until) continue;
      this.watches.delete(group);
      if (!free || watch.hit || watch.min < 0 || watch.min >= FLOW.kissBand) continue;
      state.kisses += 1;
      this.gain(kissFlow(watch.min));
      this.events.push({ type: 'kiss', clearance: watch.min, x: state.x, y: state.y, s: state.s });
    }
  }

  private checkThread(free: boolean): void {
    const state = this.state;
    const course = this.course;
    // Floors are at least 55 m apart, so one step crosses at most one.
    const k = course.sectionAt(state.s);
    if (k < 1 || course.sectionAt(state.prevS) >= k) return;
    const floor = this.director.floor(k);
    if (!floor || !free) return;
    let through: Hole | null = null;
    for (const hole of floor.holes) {
      if (holeContains(hole, state.x, state.y)) {
        through = hole;
        break;
      }
    }
    if (!through) return;
    state.threads += 1;
    if (!through.safe && through.size === 'narrow') state.narrowThreads += 1;
    this.gain(through.safe ? FLOW.safeThread : FLOW.thread[through.size]);
    this.events.push({ type: 'thread', size: through.size, safe: through.safe, x: state.x, y: state.y, s: state.s });
  }

  private gain(amount: number): void {
    this.state.flow += amount;
    this.gained = true;
  }

  private stumble(): void {
    const state = this.state;
    state.stumble = FALL.stumbleSeconds;
    state.flow = 0;
    const slowed = state.speed * FALL.stumbleSpeed;
    state.speed = slowed > FALL.stumbleFloor ? slowed : FALL.stumbleFloor;
    state.stumbles += 1;
    for (const watch of this.watches.values()) watch.hit = true;
    this.events.push({ type: 'stumble' });
  }
}

function clampArena(v: number): number {
  return v < -FALL.arena ? -FALL.arena : v > FALL.arena ? FALL.arena : v;
}
