import type { Hole } from './types';

/** An axis-aligned rectangle in the x–y plane. */
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const EPSILON = 1e-6;

export function holeRect(hole: Hole): Rect {
  return { x0: hole.x - hole.hw, x1: hole.x + hole.hw, y0: hole.y - hole.hh, y1: hole.y + hole.hh };
}

/** True when two holes, grown by `gap` on every side, would touch. */
export function holesOverlap(a: Hole, b: Hole, gap: number): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw + gap && Math.abs(a.y - b.y) < a.hh + b.hh + gap;
}

export function holeContains(hole: Hole, x: number, y: number): boolean {
  return Math.abs(x - hole.x) <= hole.hw && Math.abs(y - hole.y) <= hole.hh;
}

/**
 * A floor's stone: the square [−reach, reach]² with the holes cut out, as a
 * handful of rectangles. Sweep across x between every hole edge, take what the
 * holes leave of each strip, then merge neighbouring strips that leave the same.
 * Holes must not overlap one another (the composer keeps a gap between them).
 *
 * The pieces and the holes tile the square exactly; the tests check it.
 */
export function cutFloor(reach: number, holes: readonly Hole[]): Rect[] {
  const rects = holes.map(holeRect).map((r) => ({
    x0: Math.max(-reach, r.x0),
    x1: Math.min(reach, r.x1),
    y0: Math.max(-reach, r.y0),
    y1: Math.min(reach, r.y1),
  }));

  const edges = [-reach, reach];
  for (const r of rects) {
    if (r.x1 - r.x0 <= EPSILON) continue;
    edges.push(r.x0, r.x1);
  }
  edges.sort((a, b) => a - b);
  const xs: number[] = [];
  for (const edge of edges) {
    if (xs.length === 0 || edge - xs[xs.length - 1] > EPSILON) xs.push(edge);
  }

  const pieces: Rect[] = [];
  let open: { x0: number; spans: [number, number][] } | null = null;

  const flush = (x1: number) => {
    if (!open) return;
    for (const [y0, y1] of open.spans) pieces.push({ x0: open.x0, x1, y0, y1 });
    open = null;
  };

  for (let i = 0; i < xs.length - 1; i++) {
    const xa = xs[i];
    const xb = xs[i + 1];
    const mid = (xa + xb) / 2;
    const covering = rects
      .filter((r) => r.x0 <= mid && r.x1 >= mid && r.y1 - r.y0 > EPSILON)
      .sort((a, b) => a.y0 - b.y0);
    const spans: [number, number][] = [];
    let y = -reach;
    for (const r of covering) {
      if (r.y0 - y > EPSILON) spans.push([y, r.y0]);
      y = Math.max(y, r.y1);
    }
    if (reach - y > EPSILON) spans.push([y, reach]);

    const current = open as { x0: number; spans: [number, number][] } | null;
    if (current && sameSpans(current.spans, spans)) continue;
    flush(xa);
    open = { x0: xa, spans };
  }
  flush(xs[xs.length - 1]);
  return pieces;
}

function sameSpans(a: [number, number][], b: [number, number][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i][0] - b[i][0]) > EPSILON || Math.abs(a[i][1] - b[i][1]) > EPSILON) return false;
  }
  return true;
}
