/**
 * The rules of the fall, in one place.
 *
 * The engine plays by these numbers, and a future leaderboard re-flies every
 * submitted run with the same numbers, so a depth the rules cannot produce is
 * a depth the board can refuse. Change one and bump COURSE_VERSION: every
 * course, best and ghost is keyed by it.
 *
 * Path space: `s` is depth fallen (metres, down is +), `x` and `y` are the
 * cross-section he steers in (x to the right of the screen, y up it).
 */

/** Every course, best and ghost is keyed by this. Bump it when courses change. */
export const COURSE_VERSION = 1;

export const FALL = {
  /** Fixed simulation step. A run is the same on every phone. */
  ticksPerSecond: 120,
  step: 1 / 120,
  /** He steers anywhere within this half-width, on both axes (m). */
  arena: 18,
  /** Floors reach this far out, so their edges are never a free lane (m). */
  floorReach: 40,
  /** His body, for collisions (m). Kinder than his wingspan. */
  playerRadius: 0.45,
  /** No solid form is thinner along the fall than this (m). See the speed bound. */
  minThickness: 0.8,
  /** Fall speed with no flow, and with all of it (m/s). */
  baseSpeed: 30,
  maxSpeed: 70,
  /** How fast speed closes on its target, rising and falling (m/s²). */
  accelUp: 6,
  accelDown: 10,
  /** Sideways speed limit: a share of the fall speed, never below a floor (m/s). */
  glide: 0.45,
  minLateral: 12,
  /** The steering spring, critically damped. Higher follows the finger tighter. */
  omega: 7,
  /** Aim is quantised to 1/64 m per step, so a run can be replayed exactly. */
  aimQuantum: 64,
  /** How fast held keys move the aim (m/s). */
  keyRate: 22,
  /** A hit: this long passing through stone, slowed, with no gains (s). */
  stumbleSeconds: 1.4,
  stumbleSpeed: 0.5,
  stumbleFloor: 15,
  stumbleLateral: 0.6,
  /** The world's reaction-time budget, for the flyability bound (s). */
  reactSeconds: 0.35,
  /** Safety share of the reachable shift the safe path may use. */
  shiftShare: 0.7,
} as const;

/** What clean lines are worth, as flow (0..1). Flow is speed. */
export const FLOW = {
  /**
   * Threading a hole off the safe path, by the hole's size. The safe hole pays
   * a little whatever its size: it is the way down, not a choice.
   */
  thread: { narrow: 0.14, medium: 0.07, wide: 0.015 },
  safeThread: 0.015,
  gate: 0.06,
  /** A kiss: passing an edge with this little clearance (m). */
  kissBand: 0.6,
  kissMin: 0.03,
  kissMax: 0.08,
  /** A hug: falling alongside a pillar within this clearance (m), per second. */
  hugBand: 1.05,
  hugRate: 0.12,
  /**
   * Flow always drains (per second), so only gains that outpace it build
   * speed: the safe hole alone never will. After `idleDelay` seconds with no
   * gain at all it drains faster.
   */
  drain: 0.02,
  idleDelay: 2.5,
  idleDrain: 0.04,
} as const;

/** Hole sizes by their narrower side (m). */
export const HOLE = {
  narrowUpTo: 2.8,
  mediumUpTo: 4.6,
} as const;

export type HoleSize = 'narrow' | 'medium' | 'wide';

export function holeSizeFor(width: number, height: number): HoleSize {
  const side = Math.min(width, height);
  if (side <= HOLE.narrowUpTo) return 'narrow';
  if (side <= HOLE.mediumUpTo) return 'medium';
  return 'wide';
}

/**
 * How far the safe path may move between two floors `spacing` metres apart
 * and still be reachable at top speed by someone who reacts in time.
 */
export function maxShift(spacing: number): number {
  const reachable = FALL.glide * (spacing - FALL.maxSpeed * FALL.reactSeconds);
  return Math.max(0, FALL.shiftShare * reachable);
}

/** Flow gained by a kiss with this much clearance (m). Closer pays more. */
export function kissFlow(clearance: number): number {
  const closeness = 1 - Math.min(1, Math.max(0, clearance / FLOW.kissBand));
  return FLOW.kissMin + (FLOW.kissMax - FLOW.kissMin) * closeness;
}

export type Medal = 'gold' | 'silver' | 'bronze' | null;

/**
 * A level's medals, as average fall speeds (m/s) over its song. Each level
 * sets its own, like a racing game's target times: a lattice pays less than a
 * field of plates, so the same speed is worth more there. Bronze always asks
 * for some risk; the safe path alone holds base speed and never medals.
 */
export interface MedalRates {
  bronze: number;
  silver: number;
  gold: number;
}

export function medalDepths(seconds: number, rates: MedalRates): MedalRates {
  return {
    bronze: Math.round(rates.bronze * seconds),
    silver: Math.round(rates.silver * seconds),
    gold: Math.round(rates.gold * seconds),
  };
}

export function medalFor(depth: number, seconds: number, rates: MedalRates): Medal {
  const at = medalDepths(seconds, rates);
  if (depth >= at.gold) return 'gold';
  if (depth >= at.silver) return 'silver';
  if (depth >= at.bronze) return 'bronze';
  return null;
}
