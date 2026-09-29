/**
 * The rules of the flight, in one place.
 *
 * The engine plays by these numbers, and the leaderboard checks every
 * submitted run against the same numbers, so a score the rules cannot
 * produce is a score the board can refuse.
 */

export const SCORING = {
  /** Points per metre flown in a Dive. */
  perMetre: 1,
  /** Within this distance (m) of a surface, a chain grows. */
  grazeBand: 2.5,
  /** Chain growth per second at the edge of the band. */
  chainRateEdge: 45,
  /** Chain growth per second when brushing the surface. */
  chainRateSurface: 460,
  /** Seconds clear of every surface before a chain banks. */
  bankDelay: 0.6,
  /** Chain lengths (seconds) at which the multiplier steps to x2, x3, x4, x5. */
  multiplierSteps: [3, 6, 10, 15] as readonly number[],
  /** Flying through a portal. */
  portal: 1000,
} as const;

/** The multiplier a chain of this many seconds earns when it banks. */
export function multiplierFor(chainSeconds: number): number {
  let multiplier = 1;
  for (const step of SCORING.multiplierSteps) {
    if (chainSeconds >= step) multiplier += 1;
  }
  return multiplier;
}
