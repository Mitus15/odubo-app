import { angleToFrac, stepFrac } from "@/lib/loop/scrub";

describe("angleToFrac", () => {
  // Centre (100,100); the four cardinal points of a 50px ring.
  const f = (x: number, y: number) => angleToFrac(100, 100, x, y);

  it("puts 12 o'clock at the start of the track", () => {
    expect(f(100, 50)).toBeCloseTo(0, 6);
  });

  it("sweeps clockwise — quarter, half, three-quarter turns", () => {
    expect(f(150, 100)).toBeCloseTo(0.25, 6);
    expect(f(100, 150)).toBeCloseTo(0.5, 6);
    expect(f(50, 100)).toBeCloseTo(0.75, 6);
  });

  it("never returns a negative fraction", () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const r = (deg * Math.PI) / 180;
      const v = f(100 + 50 * Math.sin(r), 100 - 50 * Math.cos(r));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("ignores distance from the centre — only the angle matters", () => {
    expect(f(150, 100)).toBeCloseTo(f(300, 100), 6);
  });
});

describe("stepFrac", () => {
  it("advances by the difference when nowhere near the seam", () => {
    expect(stepFrac(0.4, 0.4, 0.45)).toBeCloseTo(0.45, 6);
  });

  it("takes the short arc forward across 12 o'clock", () => {
    // 0.98 → 0.02 is +0.04 the short way, not −0.96 the long way.
    expect(stepFrac(0.5, 0.98, 0.02)).toBeCloseTo(0.54, 6);
  });

  it("takes the short arc backward across 12 o'clock", () => {
    expect(stepFrac(0.5, 0.02, 0.98)).toBeCloseTo(0.46, 6);
  });

  it("stops at the end of the record instead of wrapping to the start", () => {
    expect(stepFrac(0.99, 0.99, 0.05)).toBe(1);
    expect(stepFrac(0.01, 0.01, 0.95)).toBe(0);
  });

  it("survives a full lap without drifting", () => {
    let pos = 0;
    let last = 0;
    for (let i = 1; i <= 20; i++) {
      const next = (i * 0.05) % 1;
      pos = stepFrac(pos, last, next);
      last = next;
    }
    expect(pos).toBeCloseTo(1, 6);
  });
});
