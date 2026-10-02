import { COURSE_VERSION, FALL, maxShift } from '@/lib/fly/rules';
import type { CourseSpec } from '@/lib/fly/album';
import { dcos, dsin, DPI } from './detmath';
import { between, createRng, hash32, type Rng } from './rng';

/** The calm before the first floor (m): five seconds at base speed. */
export const FIRST_FLOOR = 150;
/** The safe path keeps this far inside the arena (m). */
export const PATH_MARGIN = 3;
/** Every section composer leaves this much air around the safe path's line (m). */
export const CORRIDOR = 2.6;

export interface PathPoint {
  x: number;
  y: number;
}

let instances = 0;

/**
 * One course: the same stone for everyone who falls this song.
 *
 * A course is a run of floors `spacing` metres apart, each with a hole on the
 * safe path. The safe path is a walk from the centre, one step per floor, never
 * longer than someone at top speed can travel after reacting in time
 * (maxShift), so every floor can always be threaded. It is drawn from its own
 * random stream, in order, as far as it is needed; the stone of each section
 * comes from a seed of its own (see patterns.ts), so it never depends on what
 * was built before it, on timing, or on the title screen.
 */
export class Course {
  readonly spec: CourseSpec;
  readonly seed: number;
  readonly spacing: number;
  readonly shift: number;
  readonly endTick: number;
  readonly harmlessFromTick: number;
  /** Changes whenever a new course is made; the renderer resets on it. */
  readonly instance: number;

  private readonly path: PathPoint[] = [{ x: 0, y: 0 }];
  private readonly pathRng: Rng;
  private readonly referenceDepth: number;

  constructor(spec: CourseSpec) {
    this.spec = spec;
    this.seed = hash32(COURSE_VERSION, spec.key);
    this.spacing = spec.spacing;
    this.shift = maxShift(spec.spacing);
    this.endTick = Number.isFinite(spec.seconds) ? Math.round(spec.seconds * FALL.ticksPerSecond) : Infinity;
    this.harmlessFromTick =
      spec.harmlessFrom === null ? Infinity : Math.round(spec.harmlessFrom * FALL.ticksPerSecond);
    this.pathRng = createRng(hash32(this.seed, 0x5a7e));
    // How deep someone falling at base speed gets by the end of the song.
    this.referenceDepth = (Number.isFinite(spec.seconds) ? spec.seconds : 300) * FALL.baseSpeed;
    instances += 1;
    this.instance = instances;
  }

  /** Depth of floor k (k ≥ 1). Section 0 is the calm opening. */
  floorS(k: number): number {
    return FIRST_FLOOR + (k - 1) * this.spacing;
  }

  /** The section s falls in: 0 before the first floor, k from floor k on. */
  sectionAt(s: number): number {
    if (s < FIRST_FLOOR) return 0;
    return 1 + Math.floor((s - FIRST_FLOOR) / this.spacing);
  }

  /** Where the safe path crosses floor k (k = 0 is the start, at the centre). */
  pathAt(k: number): PathPoint {
    while (this.path.length <= k) this.extendPath();
    return this.path[k];
  }

  /** The safe path at depth s: a straight line from floor to floor. */
  safeAt(s: number, out: PathPoint = { x: 0, y: 0 }): PathPoint {
    const k = this.sectionAt(s);
    const fromS = k === 0 ? 0 : this.floorS(k);
    const toS = this.floorS(k + 1);
    const a = this.pathAt(k);
    const b = this.pathAt(k + 1);
    let t = (s - fromS) / (toS - fromS);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    return out;
  }

  /**
   * How crowded section k is, 0..1. It rises with depth: someone falling at
   * base speed reaches the middle of it by the end of the song, and every
   * metre deeper, earned with flow, is harder stone. A slow swell and a
   * breather every eleventh section keep it breathing.
   */
  intensityAt(k: number): number {
    const spec = this.spec;
    const depth = k === 0 ? 0 : this.floorS(k);
    const u = depth / this.referenceDepth;
    const level = spec.levelIndex > 0 ? 0.04 * (spec.levelIndex - 1) : 0;
    let intensity = 0.12 + level + 0.5 * (u < 1 ? u : 1) + (0.3 * (u > 1 ? u - 1 : 0)) / 1.3 + spec.difficulty;
    const wave = (k % 9) / 8;
    const swell = 1 - (2 * wave - 1 < 0 ? 1 - 2 * wave : 2 * wave - 1);
    intensity *= 0.85 + 0.15 * swell;
    if (k > 0 && k % 11 === 0) intensity *= 0.55;
    return intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  }

  /** True on the breather sections: open air, a moment to look down. */
  isBreather(k: number): boolean {
    return k > 0 && k % 11 === 0;
  }

  private extendPath(): void {
    const k = this.path.length;
    const from = this.path[k - 1];
    const rng = this.pathRng;
    const limit = FALL.arena - PATH_MARGIN;
    const intensity = this.intensityAt(k);
    const length = this.shift * between(rng, 0.2, 1) * (0.55 + 0.45 * intensity);
    const angle = 2 * DPI * rng();
    let dx = length * dcos(angle);
    let dy = length * dsin(angle);
    // Bounce off the edges rather than slide along them: the step keeps its length.
    if (from.x + dx > limit || from.x + dx < -limit) dx = -dx;
    if (from.y + dy > limit || from.y + dy < -limit) dy = -dy;
    this.path.push({
      x: clampTo(from.x + dx, limit),
      y: clampTo(from.y + dy, limit),
    });
  }
}

function clampTo(v: number, limit: number): number {
  return v < -limit ? -limit : v > limit ? limit : v;
}
