/**
 * Circular scrubbing — the maths behind dragging the play ring like a record.
 *
 * Pure and import-free so it can be tested without a DOM: the geometry is the
 * part that is easy to get subtly wrong (a seam that teleports you to the other
 * end of the song is the classic failure), and it is much cheaper to prove here
 * than to chase through a pointer event on a phone.
 */

/** Radians from 12 o'clock, clockwise, expressed as a fraction of a full turn. */
export function angleToFrac(
  cx: number,
  cy: number,
  x: number,
  y: number,
): number {
  // Screen coordinates: y grows downward, so 12 o'clock is atan2(-r, 0) =
  // -π/2. Adding a quarter turn puts the origin at the top and makes the
  // sweep clockwise, which is the direction the ring is drawn.
  const a = Math.atan2(y - cy, x - cx) + Math.PI / 2;
  return (((a / (2 * Math.PI)) % 1) + 1) % 1;
}

/**
 * Advance a position by the shortest way round.
 *
 * The naive `frac` alone teleports: dragging clockwise past 12 o'clock takes
 * the value from 0.99 to 0.01, which reads as a jump to the start of the track.
 * Taking the SHORT arc between samples and accumulating it instead means the
 * seam behaves like the end of the record — you push against it and stop —
 * rather than wrapping the listener somewhere they did not ask to go.
 */
export function stepFrac(
  current: number,
  lastFrac: number,
  nextFrac: number,
): number {
  let d = nextFrac - lastFrac;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  const next = current + d;
  return next < 0 ? 0 : next > 1 ? 1 : next;
}
