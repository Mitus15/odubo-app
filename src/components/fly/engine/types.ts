/**
 * Path space: the world as the flight sees it.
 *
 *   x  across the flight (metres, left negative)
 *   y  above the glide line (metres; Recoolman always flies at y = 0)
 *   s  along the flight (metres from where the world began)
 *
 * The renderer maps path space to world space; the engine never needs to.
 */

export type FlyMode = 'dive' | 'drift';

export type FormKind = 'block' | 'prism' | 'ring';

export interface Form {
  id: number;
  kind: FormKind;
  x: number;
  y: number;
  s: number;
  /**
   * Half extents. block: (hx, hy, hs). prism: radius hx, half height hy.
   * ring: radius hx, tube radius hy.
   */
  hx: number;
  hy: number;
  hs: number;
  /** Turn about the vertical axis, radians. */
  yaw: number;
  /** Tilt about the flight axis, radians. Tilted forms are scenery only. */
  roll: number;
  /** 0..1, which shade of the region's tone. */
  shade: number;
  accent: boolean;
  /** Counts for collisions and grazes. Rings and tilted scenery do not. */
  solid: boolean;
  /** How far the form reaches along the flight from its centre (m). */
  reach: number;
}

export type FlightEvent =
  | { type: 'chain-start' }
  | { type: 'bank'; points: number; multiplier: number }
  | { type: 'portal'; points: number }
  | { type: 'crash' }
  | { type: 'stumble' };
