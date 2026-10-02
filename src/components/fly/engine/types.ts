import type { HoleSize } from '@/lib/fly/rules';

/**
 * Path space: the world as the fall sees it.
 *
 *   s  depth fallen (metres; down is +)
 *   x  across the screen (metres; right is +)
 *   y  up the screen (metres; away from the camera is +)
 *
 * The renderer maps path space into the three.js scene; the engine never needs to.
 */

export type FormKind = 'block' | 'prism' | 'ring';

/** What a form is for: how it scores, and how it is drawn. */
export type FormRole = 'floor' | 'pillar' | 'shard' | 'gate' | 'scenery';

export interface Form {
  id: number;
  /** Forms that score together: every piece of one floor shares its floor's group. */
  group: number;
  kind: FormKind;
  role: FormRole;
  x: number;
  y: number;
  s: number;
  /**
   * Half extents.
   *   block: hx across x, hy across y, hs along the fall.
   *   prism: a cylinder along the fall, radius hx, half length hs.
   *   ring:  lies across the fall, radius hx, tube radius hs.
   */
  hx: number;
  hy: number;
  hs: number;
  /** Turn in the x–y plane (radians), and its cosine and sine, worked out once. */
  yaw: number;
  cos: number;
  sin: number;
  /** 0..1, which shade of the layer's stone. */
  shade: number;
  accent: boolean;
  /** Counts for collisions, kisses and hugs. Gates and scenery do not. */
  solid: boolean;
}

/** A hole in a floor: the way through. */
export interface Hole {
  x: number;
  y: number;
  /** Half width (x) and half height (y). */
  hw: number;
  hh: number;
  size: HoleSize;
  /** The hole on the safe path. There is always exactly one per floor. */
  safe: boolean;
}

/** A floor across the fall, for threading. Its stone is ordinary block forms. */
export interface Floor {
  id: number;
  s: number;
  /** Half thickness along the fall. */
  hs: number;
  holes: Hole[];
}

export type FallEvent =
  | { type: 'thread'; size: HoleSize; safe: boolean; x: number; y: number; s: number }
  | { type: 'kiss'; clearance: number; x: number; y: number; s: number }
  | { type: 'hug'; on: boolean }
  | { type: 'gate'; x: number; y: number; s: number }
  | { type: 'stumble' }
  | { type: 'end' };
