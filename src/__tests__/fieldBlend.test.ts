/**
 * The mix at a point on the disc.
 *
 * This is the part a listener actually hears, so it is asserted rather than
 * listened for. The pack here mirrors the shape of the real News Peak pack:
 * a full mix at the centre and each part isolated at its own edge.
 */
import { blendAt, clampToDisc, zoneWeights, type FieldPack } from '@/lib/field/blend';

const pack: FieldPack = {
  id: 'test',
  title: 'test',
  bpm: 100,
  loopBars: 4,
  beatsPerBar: 4,
  spread: 0.22,
  loops: [{ id: 'drums' }, { id: 'bass' }, { id: 'vox' }],
  zones: [
    { id: 'mix', label: 'the mix', pos: [0, 0], mix: { drums: 1, bass: 1, vox: 1 } },
    { id: 'd', label: 'drums alone', pos: [0, -1], mix: { drums: 1 } },
    { id: 'b', label: 'bass alone', pos: [-1, 0], mix: { bass: 1 } },
    { id: 'v', label: 'vox alone', pos: [1, 0], mix: { vox: 1 } },
  ],
};

describe('zoneWeights', () => {
  it('normalises to 1 wherever you stand', () => {
    for (const p of [[0, 0], [0.5, 0.5], [-1, 0], [0.3, -0.7]] as const) {
      const sum = zoneWeights(p, pack.zones, pack.spread).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('puts almost all the weight on the zone you are standing in', () => {
    const w = zoneWeights([0, -1], pack.zones, pack.spread);
    expect(w[1]).toBeGreaterThan(0.99);
  });

  it('falls back to the nearest zone when every weight underflows', () => {
    // Far outside the disc with a tight spread, every exp() is 0.
    const w = zoneWeights([1e6, 0], pack.zones, 0.01);
    expect(w.filter((x) => x === 1)).toHaveLength(1);
    expect(w[3]).toBe(1); // the vox zone at [1, 0] is nearest
  });
});

describe('blendAt', () => {
  it('gives the full mix at the centre', () => {
    const { levels } = blendAt([0, 0], pack);
    expect(levels.drums).toBeGreaterThan(0.9);
    expect(levels.bass).toBeGreaterThan(0.9);
    expect(levels.vox).toBeGreaterThan(0.9);
  });

  it('isolates a part at its own edge', () => {
    const { levels } = blendAt([0, -1], pack);
    expect(levels.drums).toBeGreaterThan(0.99);
    expect(levels.bass).toBeLessThan(0.01);
    expect(levels.vox).toBeLessThan(0.01);
  });

  it('names the zone you are closest to', () => {
    expect(pack.zones[blendAt([1, 0], pack).dominant].label).toBe('vox alone');
    expect(pack.zones[blendAt([0, 0], pack).dominant].label).toBe('the mix');
  });

  it('crossfades rather than stepping between two edges', () => {
    // Halfway between bass-alone and the centre, both should be audible.
    const { levels } = blendAt([-0.5, 0], pack);
    expect(levels.bass).toBeGreaterThan(0.3);
    expect(levels.drums).toBeGreaterThan(0.05);
    expect(levels.drums).toBeLessThan(levels.bass);
  });

  it('reports every loop in the pack, including silent ones', () => {
    const { levels } = blendAt([0, -1], pack);
    expect(Object.keys(levels).sort()).toEqual(['bass', 'drums', 'vox']);
  });

  it('never exceeds unity for a loop', () => {
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      for (const r of [0, 0.4, 0.8, 1]) {
        const { levels } = blendAt([Math.cos(a) * r, Math.sin(a) * r], pack);
        for (const v of Object.values(levels)) {
          expect(v).toBeLessThanOrEqual(1.0001);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('clampToDisc', () => {
  it('leaves a point inside alone', () => {
    expect(clampToDisc([0.3, -0.4])).toEqual([0.3, -0.4]);
  });

  it('pulls a point outside onto the rim, keeping its direction', () => {
    const [x, y] = clampToDisc([3, 4]);
    expect(Math.hypot(x, y)).toBeCloseTo(1, 10);
    expect(y / x).toBeCloseTo(4 / 3, 10);
  });
});
