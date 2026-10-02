/**
 * The shape of the world, shared by the director that composes it, the engine
 * that flies through it and the renderer that draws it. If these three ever
 * disagree, what you see is not what you hit.
 */
export const WORLD = {
  /** Metres of world composed at a time. */
  segment: 40,
  /** Composed this far ahead of Recoolman. Fog swallows it before this. */
  ahead: 460,
  /** Kept this far behind him; the camera sits a few metres back. */
  behind: 50,
  /** How far either side of centre he may steer. */
  playHalfWidth: 22,
  /** How far either side the scenery reaches. */
  fieldHalfWidth: 95,
  /** An open stretch after every start, so no run begins in a wall. */
  calm: 180,
  /**
   * The glide line falls this many metres per metre flown. The flight is a
   * long dive into the world, so forms rise past him as he descends.
   */
  glideSlope: 0.18,
  /** Recoolman's body, for collisions (m). Kinder than his wingspan. */
  playerRadius: 0.45,
} as const;

/** Height of the glide line at s, in world metres. */
export function glideHeight(s: number): number {
  return -WORLD.glideSlope * s;
}
