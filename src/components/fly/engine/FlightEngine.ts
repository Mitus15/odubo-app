import { SCORING, multiplierFor } from '@/lib/fly/scoring';
import { distanceFromFlight } from './geometry';
import type { FlightEvent, FlyMode } from './types';
import { WorldDirector } from './WorldDirector';
import { WORLD } from './world';

export const FLIGHT = {
  /** The simulation runs in fixed steps, so a run plays the same on any phone. */
  step: 1 / 120,
  diveStartSpeed: 24,
  diveTopSpeed: 46,
  /** Seconds for a Dive to cover most of the way to top speed. */
  diveRampSeconds: 140,
  driftSpeed: 21,
  /** The title screen's flight, on autopilot. */
  attractSpeed: 17,
  /** How quickly speed closes on its target (per second). */
  acceleration: 1.6,
  /** The steering spring. Higher follows the finger more tightly. */
  lateralOmega: 7,
  lateralMaxSpeed: 17,
  /** Drift: a hit costs speed for this long instead of the run. */
  stumbleSeconds: 1.4,
  stumbleSpeed: 0.5,
  /** After a crash the camera keeps drifting forward at this speed. */
  crashDrift: 5,
  /** The autopilot aims this many seconds ahead on the safe line. */
  autopilotLead: 0.8,
} as const;

export type Pilot = 'player' | 'auto';

export interface RunConfig {
  rules: FlyMode;
  pilot: Pilot;
}

export interface FlightState {
  rules: FlyMode;
  pilot: Pilot;
  alive: boolean;
  paused: boolean;
  /** Seconds into this run. */
  t: number;
  /** Distance along the flight (m), and where it was one step ago. */
  s: number;
  prevS: number;
  /** Where this run began. */
  startS: number;
  x: number;
  prevX: number;
  vx: number;
  targetX: number;
  speed: number;
  /** Banked points: distance, chains and portals. */
  score: number;
  /** The chain growing now, not yet banked. */
  chain: number;
  chainSeconds: number;
  /** Seconds since the last graze, while a chain is open. */
  clearFor: number;
  /** Distance to the nearest surface (m). */
  nearest: number;
  grazing: boolean;
  bestChain: number;
  portals: number;
  /** Drift: seconds of stumble left. */
  stumble: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The flight itself, with no drawing in it: Recoolman's motion, what he
 * touches and what that is worth. Pure TypeScript, stepped at a fixed rate,
 * so it can be tested without a browser and replayed without a phone.
 */
export class FlightEngine {
  readonly state: FlightState;
  readonly director: WorldDirector;

  private accumulator = 0;
  private events: FlightEvent[] = [];
  private passedRings = new Set<number>();

  constructor(seed: number, director: WorldDirector = new WorldDirector(seed)) {
    this.director = director;
    this.state = {
      rules: 'drift',
      pilot: 'auto',
      alive: true,
      paused: false,
      t: 0,
      s: 0,
      prevS: 0,
      startS: 0,
      x: 0,
      prevX: 0,
      vx: 0,
      targetX: 0,
      speed: FLIGHT.attractSpeed,
      score: 0,
      chain: 0,
      chainSeconds: 0,
      clearFor: 0,
      nearest: Infinity,
      grazing: false,
      bestChain: 0,
      portals: 0,
      stumble: 0,
    };
    this.restart({ rules: 'drift', pilot: 'auto' });
  }

  /** True when this run keeps score. Only a Dive flown by hand does. */
  get scoring(): boolean {
    return this.state.rules === 'dive' && this.state.pilot === 'player';
  }

  /**
   * Begin a run where the flight is now. The world ahead is cleared into a
   * calm stretch, so there is no loading and no cut: the flight just continues.
   */
  restart(config: RunConfig): void {
    const state = this.state;
    state.rules = config.rules;
    state.pilot = config.pilot;
    state.alive = true;
    state.paused = false;
    state.t = 0;
    state.startS = state.s;
    state.prevS = state.s;
    state.prevX = state.x;
    state.targetX = state.x;
    state.score = 0;
    state.chain = 0;
    state.chainSeconds = 0;
    state.clearFor = 0;
    state.grazing = false;
    state.bestChain = 0;
    state.portals = 0;
    state.stumble = 0;
    this.events = [];
    this.passedRings.clear();
    this.accumulator = 0;

    const startS = state.s;
    const rules = config.rules;
    const pilot = config.pilot;
    this.director.setIntensity((s) => intensityFor(rules, pilot, s - startS));
    this.director.clearAhead(state.s, state.x);
    this.director.update(state.s);
  }

  setPaused(paused: boolean): void {
    this.state.paused = paused;
  }

  /** Move the steering target by dx metres (the finger's slide). */
  steerBy(dx: number): void {
    const state = this.state;
    if (state.pilot !== 'player' || !state.alive) return;
    state.targetX = clamp(state.targetX + dx, -WORLD.playHalfWidth, WORLD.playHalfWidth);
  }

  /**
   * Advance by dt seconds of real time. Returns how far between two steps the
   * present moment falls (0..1), for smooth drawing.
   */
  update(dt: number): number {
    if (this.state.paused) return 1;
    this.accumulator = Math.min(this.accumulator + dt, 0.25);
    while (this.accumulator >= FLIGHT.step) {
      this.tick(FLIGHT.step);
      this.accumulator -= FLIGHT.step;
    }
    return this.accumulator / FLIGHT.step;
  }

  drainEvents(): FlightEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  private tick(h: number): void {
    const state = this.state;
    state.prevS = state.s;
    state.prevX = state.x;

    if (!state.alive) {
      state.speed += (FLIGHT.crashDrift - state.speed) * Math.min(1, h * 1.5);
      state.s += state.speed * h;
      this.director.update(state.s);
      return;
    }

    state.t += h;

    // Speed closes on the rules' target; a stumble takes some of it away.
    let target = targetSpeed(state.rules, state.pilot, state.t);
    if (state.stumble > 0) {
      const recovery = 1 - state.stumble / FLIGHT.stumbleSeconds;
      target *= FLIGHT.stumbleSpeed + (1 - FLIGHT.stumbleSpeed) * recovery;
    }
    state.speed += (target - state.speed) * Math.min(1, h * FLIGHT.acceleration);

    // Steering: a critically damped spring toward the target, speed-limited.
    if (state.pilot === 'auto') {
      state.targetX = this.director.safeXAt(state.s + state.speed * FLIGHT.autopilotLead);
    }
    const omega = FLIGHT.lateralOmega;
    const accel = omega * omega * (state.targetX - state.x) - 2 * omega * state.vx;
    state.vx = clamp(state.vx + accel * h, -FLIGHT.lateralMaxSpeed, FLIGHT.lateralMaxSpeed);
    state.x += state.vx * h;
    if (Math.abs(state.x) > WORLD.playHalfWidth) {
      state.x = clamp(state.x, -WORLD.playHalfWidth, WORLD.playHalfWidth);
      state.vx = 0;
    }

    state.s += state.speed * h;
    this.director.update(state.s);

    // What is around him now.
    const near = this.director.formsNear(state.s, SCORING.grazeBand + 1);
    let nearest = Infinity;
    for (const form of near) {
      if (form.kind === 'ring') {
        this.checkPortal(form.id, form.s, form.x, form.hx);
        continue;
      }
      if (!form.solid) continue;
      const d = distanceFromFlight(form, state.x, state.s);
      if (d < nearest) nearest = d;
    }
    state.nearest = nearest;

    if (nearest < WORLD.playerRadius) {
      this.hit();
    } else if (state.stumble > 0) {
      state.stumble = Math.max(0, state.stumble - h);
    }
    if (!state.alive) return;

    if (this.scoring) {
      state.score += state.speed * h * SCORING.perMetre;
      this.scoreGraze(h, nearest);
    }
  }

  private hit(): void {
    const state = this.state;
    if (state.pilot === 'auto') return;
    if (state.rules === 'dive') {
      state.alive = false;
      state.chain = 0;
      state.chainSeconds = 0;
      state.grazing = false;
      this.events.push({ type: 'crash' });
      return;
    }
    // Drift: the world forgives. He ghosts through, slowed, and the stumble
    // only starts to wear off once he is clear (tick stops counting it down
    // while he is inside something).
    if (state.stumble <= 0) {
      state.stumble = FLIGHT.stumbleSeconds;
      this.events.push({ type: 'stumble' });
    }
  }

  private scoreGraze(h: number, nearest: number): void {
    const state = this.state;
    const band = SCORING.grazeBand;
    if (nearest < band) {
      if (state.chain === 0) this.events.push({ type: 'chain-start' });
      const closeness = 1 - clamp((nearest - WORLD.playerRadius) / (band - WORLD.playerRadius), 0, 1);
      const rate = SCORING.chainRateEdge + (SCORING.chainRateSurface - SCORING.chainRateEdge) * closeness * closeness;
      state.chain += h * rate * (state.speed / FLIGHT.diveStartSpeed);
      state.chainSeconds += h;
      state.clearFor = 0;
      state.grazing = true;
      return;
    }
    state.grazing = false;
    if (state.chain === 0) return;
    state.chainSeconds += h;
    state.clearFor += h;
    if (state.clearFor >= SCORING.bankDelay) this.bank();
  }

  private bank(): void {
    const state = this.state;
    const multiplier = multiplierFor(state.chainSeconds);
    const points = Math.round(state.chain) * multiplier;
    state.score += points;
    state.bestChain = Math.max(state.bestChain, points);
    this.events.push({ type: 'bank', points, multiplier });
    state.chain = 0;
    state.chainSeconds = 0;
    state.clearFor = 0;
  }

  private checkPortal(id: number, ringS: number, ringX: number, radius: number): void {
    const state = this.state;
    if (this.passedRings.has(id)) return;
    if (state.prevS < ringS && state.s >= ringS) {
      this.passedRings.add(id);
      if (Math.abs(state.x - ringX) <= radius - WORLD.playerRadius) {
        state.portals += 1;
        if (this.scoring) state.score += SCORING.portal;
        this.events.push({ type: 'portal', points: this.scoring ? SCORING.portal : 0 });
      }
    }
  }
}

/** The speed each kind of flight is heading for, t seconds into the run. */
export function targetSpeed(rules: FlyMode, pilot: Pilot, t: number): number {
  if (pilot === 'auto') return FLIGHT.attractSpeed;
  if (rules === 'drift') return FLIGHT.driftSpeed;
  const ramp = 1 - Math.exp(-t / FLIGHT.diveRampSeconds);
  return FLIGHT.diveStartSpeed + (FLIGHT.diveTopSpeed - FLIGHT.diveStartSpeed) * ramp;
}

/**
 * How crowded the world is, `into` metres into a run. Until the music
 * composes it (phase 2), sections come and go on a slow swell, and a Dive
 * tightens as it goes on.
 */
export function intensityFor(rules: FlyMode, pilot: Pilot, into: number): number {
  const swell = 0.5 + 0.5 * Math.sin(into / 260);
  if (pilot === 'auto') return 0.2 + 0.15 * swell;
  if (rules === 'drift') return 0.15 + 0.3 * swell;
  const warm = clamp(into / 700, 0, 1);
  return clamp(0.12 + 0.5 * warm + 0.35 * swell * warm, 0, 1);
}
