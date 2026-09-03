/**
 * Zone blending for the stem field.
 *
 * Ported from the Fract engine (~/Documents/Apps/fract/src/engine/blend.ts) so
 * the two stay honest about producing the same mix from the same pack. The
 * behaviour is deliberately identical; only the module boundary differs.
 *
 * Pure — no AudioContext, no DOM — so the mix at any point on the disc can be
 * asserted in a test rather than listened for.
 */

export type Vec2 = readonly [number, number];

export interface FieldLoop {
  id: string;
  label?: string;
  src?: string;
  character?: number;
  role?: 'ring' | 'aux';
}

export interface FieldZone {
  id: string;
  label: string;
  /** Unit-disc coordinates, magnitude <= 1. */
  pos: Vec2;
  /** loopId -> level 0..1. Omitted loops are silent in this zone. */
  mix: Record<string, number>;
}

export interface FieldPack {
  id: string;
  title: string;
  bpm: number;
  loopBars: number;
  beatsPerBar: number;
  /** Gaussian falloff width, in disc units. */
  spread: number;
  loops: FieldLoop[];
  zones: FieldZone[];
}

const dist2 = (a: Vec2, b: Vec2) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
};

/**
 * Gaussian falloff rather than inverse-distance weighting.
 *
 * IDW has a singularity at zero distance and leaves distant zones a permanent
 * floor, so every position ends up sounding like a little of everything. A
 * Gaussian decays fast enough that far zones stop mattering, needs no special
 * case at d = 0, and still normalises to a sensible mix anywhere on the disc.
 */
export function zoneWeights(
  p: Vec2,
  zones: readonly FieldZone[],
  spread: number
): number[] {
  const s2 = spread * spread;
  const raw = zones.map((z) => Math.exp(-dist2(p, z.pos) / s2));
  let total = 0;
  for (const w of raw) total += w;

  if (!(total > 0)) {
    // Numerically adrift from every zone: fall back to the nearest outright.
    let best = 0;
    let bestD = Infinity;
    zones.forEach((z, i) => {
      const d = dist2(p, z.pos);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return zones.map((_, i) => (i === best ? 1 : 0));
  }

  return raw.map((w) => w / total);
}

export interface BlendResult {
  weights: number[];
  /** Level per loop id, 0..1. */
  levels: Record<string, number>;
  /** Index of the strongest zone — what the readout names. */
  dominant: number;
}

/** Blend the zone recipes at a point into a level for every loop in the pack. */
export function blendAt(p: Vec2, pack: FieldPack): BlendResult {
  const weights = zoneWeights(p, pack.zones, pack.spread);

  const levels: Record<string, number> = {};
  for (const loop of pack.loops) levels[loop.id] = 0;

  let dominant = 0;
  for (let i = 0; i < pack.zones.length; i++) {
    const w = weights[i] ?? 0;
    if (w > (weights[dominant] ?? 0)) dominant = i;
    if (w <= 0) continue;
    const mix = pack.zones[i]?.mix ?? {};
    for (const id in mix) {
      if (id in levels) levels[id] += w * (mix[id] ?? 0);
    }
  }

  return { weights, levels, dominant };
}

/** Clamp a point to the unit disc — the field has no outside. */
export function clampToDisc(p: Vec2): Vec2 {
  const m = Math.hypot(p[0], p[1]);
  return m <= 1 ? p : [p[0] / m, p[1] / m];
}
