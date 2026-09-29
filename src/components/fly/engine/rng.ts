/** A seeded random source, so the same seed always builds the same world. */
export type Rng = () => number;

/** mulberry32: tiny, fast, and good enough for placing monoliths. */
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

export function between(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function sign(rng: Rng): 1 | -1 {
  return rng() < 0.5 ? -1 : 1;
}
