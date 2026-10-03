/** A seeded random source, so the same seed always builds the same world. */
export type Rng = () => number;

/** mulberry32: tiny, fast, and good enough for placing stone. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mix two integers into one well-spread 32-bit seed (murmur3's finaliser over
 * a combine). A course gives every section its own seed this way, so a
 * section's stone never depends on which sections were built before it.
 */
export function hash32(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The random source for item `index` of whatever `seed` names. */
export function rngFor(seed: number, index: number): Rng {
  return createRng(hash32(seed, index));
}

export function between(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function sign(rng: Rng): 1 | -1 {
  return rng() < 0.5 ? -1 : 1;
}

/** One of `options`, weighted. Weights of zero are never chosen. */
export function pick<T extends string>(rng: Rng, weights: Readonly<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  let total = 0;
  for (const [, weight] of entries) total += Math.max(0, weight);
  let roll = rng() * total;
  for (const [option, weight] of entries) {
    if (weight <= 0) continue;
    roll -= weight;
    if (roll < 0) return option;
  }
  return entries[entries.length - 1][0];
}
