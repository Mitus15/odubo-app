/**
 * Where path space lands in the three.js scene.
 *
 *   world X =  x
 *   world Y = −(s − originS)    he falls down the Y axis
 *   world Z = −y                 up the screen is away from the camera
 *
 * A block's yaw is a three.js rotation.y of the same angle (see geometry.ts).
 *
 * A fall covers tens of kilometres, and a GPU's 32-bit floats shimmer out
 * there, so the world is re-centred on him every couple of kilometres, and
 * whenever a new run starts. Anything that caches world positions watches
 * `version` and rewrites when it changes.
 */
export class WorldFrame {
  originS = 0;
  version = 0;

  private static readonly REBASE_EVERY = 2000;

  /** Re-centre if the fall has gone far enough (or gone back to the top). */
  follow(s: number): boolean {
    if (s - this.originS < WorldFrame.REBASE_EVERY && s >= this.originS) return false;
    this.originS = Math.floor(s);
    this.version += 1;
    return true;
  }

  /** Start over at depth s (a new run). */
  reset(s = 0): void {
    this.originS = Math.floor(s);
    this.version += 1;
  }

  /** World Y of depth s. */
  y(s: number): number {
    return -(s - this.originS);
  }

  /** World Z of path y. */
  z(y: number): number {
    return -y;
  }
}
