/**
 * Pure 2D field/contour geometry for the vector redraw pipeline.
 * No palette imports, no DOM — every function is unit-testable in isolation.
 *
 * The pipeline these serve (see vectorize.ts): a confidence field is blurred,
 * traced at an iso value into closed loops (marching squares with linear
 * interpolation), each loop is simplified (closed-loop Douglas-Peucker) and
 * corner-cut smooth (Chaikin) — producing the clean, deliberately-drawn
 * contours the poster look needs, instead of per-pixel noise.
 */

export type Loop = {
  /** Closed polygon vertices [x0,y0, x1,y1, …] in field coordinates. */
  pts: Float32Array;
  /** Signed shoelace area — sign distinguishes outer loops from holes. */
  area: number;
};

/** Separable box blur of a single-channel field. Blur-then-threshold acts as a
 *  cheap morphological open+close: pinholes seal, spurs shave off. */
export function boxBlurField(field: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return field;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) { s += field[y * w + xx]; c++; }
      }
      tmp[y * w + x] = s / c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; c++; }
      }
      out[y * w + x] = s / c;
    }
  }
  return out;
}

/** Box-average downsample of a field to `targetLongSide` (keeps aspect).
 *  Averaging IS denoising — never nearest-neighbour a mask before tracing. */
export function downsampleField(
  field: Float32Array,
  w: number,
  h: number,
  targetLongSide: number,
): { data: Float32Array; width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= targetLongSide) return { data: field, width: w, height: h };
  const scale = targetLongSide / long;
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy0 = Math.floor((y * h) / dh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * h) / dh));
    for (let x = 0; x < dw; x++) {
      const sx0 = Math.floor((x * w) / dw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * w) / dw));
      let s = 0, c = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) { s += field[yy * w + xx]; c++; }
      }
      out[y * dw + x] = s / c;
    }
  }
  return { data: out, width: dw, height: dh };
}

/* ─────────────────────────── marching squares ─────────────────────────── */

/**
 * Trace all closed iso-contours of `field` at `iso`.
 *
 * Works on the (w-1)×(h-1) cell grid. Crossing positions are LINEARLY
 * INTERPOLATED along cell edges — that interpolation is what makes a 256-res
 * trace look smooth at 720p. Saddle cells (cases 5/10) are disambiguated by
 * the cell's centre sample. Loops are closed; open chains (field touching the
 * border) are closed by walking the border implicitly: we pad the field
 * virtually with `iso - 1` (outside), so every contour is guaranteed closed.
 */
export function marchingSquares(field: Float32Array, w: number, h: number, iso: number): Loop[] {
  // Padded lookup: outside the field is "below iso", so shapes touching the
  // frame edge still produce closed loops.
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? iso - 1 : field[y * w + x];

  const pw = w + 2; // padded dims (virtual sample at -1 .. w)
  const ph = h + 2;

  // Each cell (cx,cy) spans samples (cx-1..cx, cy-1..cy) in field coords.
  // Edge ids: 0=top,1=right,2=bottom,3=left. Visited flags per cell+edge.
  const visited = new Uint8Array(pw * ph * 4);
  const loops: Loop[] = [];

  const sample = (cx: number, cy: number, corner: number): number => {
    // corners: 0=TL 1=TR 2=BR 3=BL in field coords (cell origin at cx-1,cy-1)
    const ox = corner === 1 || corner === 2 ? 0 : -1;
    const oy = corner === 2 || corner === 3 ? 0 : -1;
    return at(cx + ox, cy + oy);
  };

  // Interpolated point on a cell edge (in field coordinates).
  const edgePoint = (cx: number, cy: number, edge: number): [number, number] => {
    // Edge endpoints as corner indices
    const ends: [number, number][] = [[0, 1], [1, 2], [3, 2], [0, 3]];
    const [ca, cb] = ends[edge];
    const va = sample(cx, cy, ca);
    const vb = sample(cx, cy, cb);
    const t = va === vb ? 0.5 : (iso - va) / (vb - va);
    // Corner coordinates in field space
    const cxs = [cx - 1, cx, cx, cx - 1];
    const cys = [cy - 1, cy - 1, cy, cy];
    const ax = cxs[ca], ay = cys[ca];
    const bx = cxs[cb], by = cys[cb];
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  };

  // For each marching-squares case, the directed segments (entryEdge → exitEdge).
  // Case bit i set = corner i above iso (corners TL,TR,BR,BL → bits 0,1,2,3).
  const caseSegs = (cx: number, cy: number): [number, number][] => {
    let c = 0;
    if (sample(cx, cy, 0) >= iso) c |= 1;
    if (sample(cx, cy, 1) >= iso) c |= 2;
    if (sample(cx, cy, 2) >= iso) c |= 4;
    if (sample(cx, cy, 3) >= iso) c |= 8;
    switch (c) {
      case 0: case 15: return [];
      case 1: return [[3, 0]];
      case 2: return [[0, 1]];
      case 3: return [[3, 1]];
      case 4: return [[1, 2]];
      case 6: return [[0, 2]];
      case 7: return [[3, 2]];
      case 8: return [[2, 3]];
      case 9: return [[2, 0]];
      case 11: return [[2, 1]];
      case 12: return [[1, 3]];
      case 13: return [[1, 0]];
      case 14: return [[0, 3]];
      case 5: { // TL+BR saddle — resolve by centre sample
        const centre = (sample(cx, cy, 0) + sample(cx, cy, 1) + sample(cx, cy, 2) + sample(cx, cy, 3)) / 4;
        return centre >= iso ? [[3, 2], [1, 0]] : [[3, 0], [1, 2]];
      }
      case 10: { // TR+BL saddle
        const centre = (sample(cx, cy, 0) + sample(cx, cy, 1) + sample(cx, cy, 2) + sample(cx, cy, 3)) / 4;
        return centre >= iso ? [[0, 1], [2, 3]] : [[0, 3], [2, 1]];
      }
      default: return [];
    }
  };

  // Neighbour crossing: leaving cell via edge E enters neighbour via opposite edge.
  const step = (cx: number, cy: number, exitEdge: number): [number, number, number] => {
    switch (exitEdge) {
      case 0: return [cx, cy - 1, 2];
      case 1: return [cx + 1, cy, 3];
      case 2: return [cx, cy + 1, 0];
      default: return [cx - 1, cy, 1];
    }
  };

  const key = (cx: number, cy: number, edge: number) => ((cy + 0) * pw + cx) * 4 + edge;

  for (let cy = 0; cy <= h; cy++) {
    for (let cx = 0; cx <= w; cx++) {
      for (const [entry0] of caseSegs(cx, cy)) {
        if (visited[key(cx, cy, entry0)]) continue;

        // Walk the contour from this entry edge until we loop.
        const pts: number[] = [];
        let px = cx, py = cy, entry = entry0;
        let guard = pw * ph * 4;
        while (guard-- > 0) {
          if (visited[key(px, py, entry)]) break;
          visited[key(px, py, entry)] = 1;
          const segs = caseSegs(px, py);
          const seg = segs.find(([e]) => e === entry);
          if (!seg) break;
          const exit = seg[1];
          const [x, y] = edgePoint(px, py, exit);
          pts.push(x, y);
          [px, py, entry] = step(px, py, exit);
          if (px === cx && py === cy && entry === entry0) break;
        }

        if (pts.length >= 6) {
          const arr = new Float32Array(pts);
          loops.push({ pts: arr, area: shoelace(arr) });
        }
      }
    }
  }
  return loops;
}

/** Signed shoelace area of a closed polygon. */
export function shoelace(pts: Float32Array): number {
  let a = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
  }
  return a / 2;
}

/* ─────────────────────── simplify + smooth (closed) ─────────────────────── */

/**
 * Closed-loop Douglas-Peucker. Anchors the recursion at the two most-distant
 * vertices, simplifies both halves, and rejoins. Epsilon is in field pixels —
 * it doubles as the anti-jitter snap for video (sub-epsilon frame wobble
 * collapses to the same polygon).
 */
export function simplifyClosed(pts: Float32Array, epsilon: number): Float32Array {
  const n = pts.length / 2;
  if (n <= 4 || epsilon <= 0) return pts;

  // Find the two most-distant vertices (approx: farthest from vertex 0, then
  // farthest from that one — adequate for contour loops).
  let a = 0, best = -1;
  for (let i = 1; i < n; i++) {
    const d = dist2(pts, 0, i);
    if (d > best) { best = d; a = i; }
  }
  let b = 0; best = -1;
  for (let i = 0; i < n; i++) {
    if (i === a) continue;
    const d = dist2(pts, a, i);
    if (d > best) { best = d; b = i; }
  }
  const [lo, hi] = a < b ? [a, b] : [b, a];

  const half1 = indicesRange(lo, hi, n);
  const half2 = indicesRange(hi, lo, n);
  const keep = new Uint8Array(n);
  keep[lo] = 1;
  keep[hi] = 1;
  rdp(pts, half1, 0, half1.length - 1, epsilon, keep);
  rdp(pts, half2, 0, half2.length - 1, epsilon, keep);

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  }
  return out.length >= 6 ? new Float32Array(out) : pts;
}

function indicesRange(from: number, to: number, n: number): number[] {
  const out: number[] = [];
  let i = from;
  while (true) {
    out.push(i);
    if (i === to) break;
    i = (i + 1) % n;
  }
  return out;
}

function dist2(pts: Float32Array, i: number, j: number): number {
  const dx = pts[i * 2] - pts[j * 2];
  const dy = pts[i * 2 + 1] - pts[j * 2 + 1];
  return dx * dx + dy * dy;
}

function rdp(
  pts: Float32Array,
  idx: number[],
  lo: number,
  hi: number,
  epsilon: number,
  keep: Uint8Array,
): void {
  if (hi - lo < 2) return;
  const ax = pts[idx[lo] * 2], ay = pts[idx[lo] * 2 + 1];
  const bx = pts[idx[hi] * 2], by = pts[idx[hi] * 2 + 1];
  const abx = bx - ax, aby = by - ay;
  const ab2 = abx * abx + aby * aby || 1e-12;

  let worst = -1, wi = -1;
  for (let i = lo + 1; i < hi; i++) {
    const px = pts[idx[i] * 2] - ax;
    const py = pts[idx[i] * 2 + 1] - ay;
    const cross = px * aby - py * abx;
    const d = (cross * cross) / ab2; // squared perpendicular distance
    if (d > worst) { worst = d; wi = i; }
  }
  if (worst > epsilon * epsilon) {
    keep[idx[wi]] = 1;
    rdp(pts, idx, lo, wi, epsilon, keep);
    rdp(pts, idx, wi, hi, epsilon, keep);
  }
}

/**
 * Chaikin corner-cutting on a closed loop. Never overshoots (unlike splines),
 * so the result reads as a confident cut, not a wobble. Vertex count doubles
 * per iteration.
 */
export function chaikinClosed(pts: Float32Array, iterations: number): Float32Array {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const n = cur.length / 2;
    const next = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = cur[i * 2], ay = cur[i * 2 + 1];
      const bx = cur[j * 2], by = cur[j * 2 + 1];
      next[i * 4] = ax * 0.75 + bx * 0.25;
      next[i * 4 + 1] = ay * 0.75 + by * 0.25;
      next[i * 4 + 2] = ax * 0.25 + bx * 0.75;
      next[i * 4 + 3] = ay * 0.25 + by * 0.75;
    }
    cur = next;
  }
  return cur;
}
