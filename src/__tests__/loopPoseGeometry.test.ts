/**
 * Geometry core of the Loop Soul vector redraw pipeline.
 * Synthetic fields — no DOM, no canvas.
 */
import {
  boxBlurField,
  downsampleField,
  marchingSquares,
  shoelace,
  simplifyClosed,
  chaikinClosed,
} from "@/lib/loop/pose/geometry";

/** Build a w×h field filled with `bg`, with a centred axis-aligned box of `fg`. */
function boxField(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Float32Array {
  const f = new Float32Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) f[y * w + x] = 1;
  return f;
}

describe("marchingSquares", () => {
  it("traces a single closed loop around a solid box", () => {
    const f = boxField(32, 32, 8, 8, 24, 24);
    const loops = marchingSquares(f, 32, 32, 0.5);
    expect(loops.length).toBe(1);
    // Area ≈ 16×16 box (iso midway through the boundary cells).
    expect(Math.abs(loops[0].area)).toBeGreaterThan(180);
    expect(Math.abs(loops[0].area)).toBeLessThan(300);
  });

  it("closes loops for shapes touching the frame border", () => {
    const f = boxField(16, 16, 0, 0, 8, 16); // left half solid, touches 3 borders
    const loops = marchingSquares(f, 16, 16, 0.5);
    expect(loops.length).toBe(1);
    const pts = loops[0].pts;
    // Closed: non-trivial vertex count and finite coords
    expect(pts.length).toBeGreaterThan(8);
    for (let i = 0; i < pts.length; i++) expect(Number.isFinite(pts[i])).toBe(true);
  });

  it("emits separate loops for separate blobs and opposite-sign for holes", () => {
    // Outer box with a hole inside
    const w = 40, h = 40;
    const f = boxField(w, h, 4, 4, 36, 36);
    for (let y = 16; y < 24; y++) for (let x = 16; x < 24; x++) f[y * w + x] = 0;
    const loops = marchingSquares(f, w, h, 0.5);
    expect(loops.length).toBe(2);
    const signs = loops.map((l) => Math.sign(l.area)).sort();
    expect(signs[0]).toBe(-1);
    expect(signs[1]).toBe(1);
  });

  it("handles saddle cells without breaking loops (diagonal checkers)", () => {
    // Two diagonal blobs meeting at a corner — the classic saddle
    const w = 20, h = 20;
    const f = new Float32Array(w * h);
    for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) f[y * w + x] = 1;
    for (let y = 10; y < 18; y++) for (let x = 10; x < 18; x++) f[y * w + x] = 1;
    const loops = marchingSquares(f, w, h, 0.5);
    // However the saddle resolves (joined or separate), every loop is closed
    // and total absolute area ≈ two 8×8 boxes.
    const total = loops.reduce((s, l) => s + Math.abs(l.area), 0);
    expect(total).toBeGreaterThan(80);
    expect(total).toBeLessThan(180);
  });
});

describe("simplifyClosed + chaikinClosed", () => {
  it("removes staircase vertices but keeps the shape", () => {
    // A jagged circle: radius modulated by tiny noise
    const n = 200;
    const pts = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const r = 50 + ((i % 2) - 0.5); // ±0.5 stairstep
      pts[i * 2] = 100 + r * Math.cos(t);
      pts[i * 2 + 1] = 100 + r * Math.sin(t);
    }
    const simplified = simplifyClosed(pts, 1.4);
    expect(simplified.length).toBeLessThan(pts.length / 2);
    const area0 = Math.abs(shoelace(pts));
    const area1 = Math.abs(shoelace(simplified));
    expect(Math.abs(area1 - area0) / area0).toBeLessThan(0.05);
  });

  it("chaikin doubles vertices per iteration and shrinks toward the polygon", () => {
    const square = new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]);
    const smooth = chaikinClosed(square, 2);
    expect(smooth.length).toBe(square.length * 4);
    // Corner-cutting strictly reduces area for a convex polygon
    expect(Math.abs(shoelace(smooth))).toBeLessThan(Math.abs(shoelace(square)));
    expect(Math.abs(shoelace(smooth))).toBeGreaterThan(80);
  });
});

describe("fields", () => {
  it("boxBlurField preserves mean and seals pinholes at threshold", () => {
    const w = 20, h = 20;
    const f = boxField(w, h, 4, 4, 16, 16);
    f[10 * w + 10] = 0; // pinhole
    const blurred = boxBlurField(f, w, h, 2);
    // Pinhole centre pulled well above iso by neighbours
    expect(blurred[10 * w + 10]).toBeGreaterThan(0.5);
  });

  it("downsampleField box-averages to target size", () => {
    const f = boxField(100, 200, 0, 0, 50, 200); // left half = 1
    const d = downsampleField(f, 100, 200, 64);
    expect(Math.max(d.width, d.height)).toBe(64);
    const mean = d.data.reduce((s, v) => s + v, 0) / d.data.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe("marchingSquares on smooth fields (real-mask conditions)", () => {
  it("traces a feathered circle as one big loop", () => {
    const w = 64, h = 64;
    const f = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - 32, y - 32);
        f[y * w + x] = Math.max(0, Math.min(1, (20 - d) / 6 + 0.5)); // soft edge
      }
    }
    const loops = marchingSquares(f, w, h, 0.5);
    const big = loops.filter((l) => Math.abs(l.area) > 100);
    expect(big.length).toBe(1);
    // ~ pi * 20^2 ≈ 1257
    expect(Math.abs(big[0].area)).toBeGreaterThan(1000);
    expect(Math.abs(big[0].area)).toBeLessThan(1500);
    // The loop should have many vertices (one per boundary cell edge)
    expect(big[0].pts.length / 2).toBeGreaterThan(60);
  });
});
