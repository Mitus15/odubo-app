import { WORLD } from '../engine/world';

/**
 * Where path space lands in the three.js scene.
 *
 * The flight runs along −z and falls along the glide line. A long Drift can
 * cover tens of kilometres, and a GPU's 32-bit floats start to shimmer out
 * there, so the world is re-centred on him every couple of kilometres. Anything
 * that caches world positions watches `version` and rewrites when it changes.
 */
export class WorldFrame {
  originS = 0;
  version = 0;

  private static readonly REBASE_EVERY = 2000;

  /** Re-centre if the flight has gone far enough. Returns true when it did. */
  follow(s: number): boolean {
    if (s - this.originS < WorldFrame.REBASE_EVERY && s >= this.originS) return false;
    this.originS = Math.floor(s);
    this.version += 1;
    return true;
  }

  /** World y of a point `y` metres above the glide line at s. */
  y(y: number, s: number): number {
    return y - WORLD.glideSlope * (s - this.originS);
  }

  z(s: number): number {
    return -(s - this.originS);
  }
}
