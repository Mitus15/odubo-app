/**
 * The colour sampler: what a frame of a video is made of, read from its own
 * pixels, the way Photoshop's sampler reads a point. The site sets each room
 * from the video in it (lib/levelsServer), so no colour is ever written down:
 * a new dance in a new colour gets its room the first time it is shown, and so
 * would any video set in a room later (a dance to his own songs, the game).
 *
 * It reads the first moment he stands in the room (settled), and the page's
 * still and the video's start are that moment too, so they meet.
 *
 *   field    what he dances on: the frame's edges, where he never is (both
 *            sides, mid height, and the top), as their median, so a stray
 *            hand or a seal does not move it
 *   figure   what he is drawn in: of everything far from the field in the
 *            middle of the frame, the colour most of it shares (his silhouette
 *            is one flat fill; the painted strokes on it are smaller), or null
 *            when nothing in the frame stands out from the field
 *
 * The page writes in the figure where it reads (room.ts, writingOn), so its
 * words, symbols and the HUD are drawn in the same ink as the dancer.
 */

export interface VideoLook {
  field: string;
  figure: string | null;
  /** The moment the look was read at, seconds in: the first where he stands in the room (see settled) */
  at: number;
}

/** How far (summed over r, g, b) a pixel must be from the field to be something on it */
const ON_FIELD = 96;
/** The figure's colours, binned this coarsely, so a flat fill's compression noise falls in one bin */
const BIN = 16;

function hex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Of the frame's area, the most he may cover and still be standing in the room, not up at the phone */
const MOST_OF_FRAME = 0.18;
/** Of the frame's edges, the most that may be something other than the field (a hand passing, a seal) */
const EDGE_SPILL = 0.01;
/** Of the frame's area, the least he covers to be in it at all: a copy's fade in starts on its field alone */
const IN_FRAME = 0.01;

/**
 * Whether he stands in the room in this frame: he is in it, the edges are the
 * field all round, and he covers no more than a share of the frame. A piece that opens
 * with him walking back from the phone is not settled until he is in place
 * (Memories, its first four seconds), so its still and its look are taken
 * from the first moment that is.
 */
export function settled(data: Uint8Array | Uint8ClampedArray, width: number, height: number, channels = 3): boolean {
  const { field, figure } = lookFromPixels(data, width, height, channels);
  if (!figure) return false;
  const rgb =(h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const f = rgb(field);
  const k = figure ? rgb(figure) : null;
  const dist = (x: number, y: number, c: number[]) => {
    const i = (y * width + x) * channels;
    return Math.abs(data[i] - c[0]) + Math.abs(data[i + 1] - c[1]) + Math.abs(data[i + 2] - c[2]);
  };
  const off = (x: number, y: number) => dist(x, y, f) >= ON_FIELD;
  // Along the bottom the floor is its own tone (the lacquer, his reflection): there only his own ink counts
  const ink = (x: number, y: number) => !!k && dist(x, y, k) < ON_FIELD;
  // All four edges: a close-up comes in from a side, or stands on the bottom of the frame (Planet Rock's first frame, a leg)
  const band = Math.max(1, Math.round(width * 0.04));
  const rim = Math.max(1, Math.round(height * 0.02));
  let edge = 0, edges = 0;
  for (let y = 0; y < height; y += 2) {
    // the sides above the floor are field; on the floor, only his ink
    const near = y > height * 0.8 ? ink : off;
    for (let x = 0; x < band; x++) {
      edge += Number(near(x, y)) + Number(near(width - 1 - x, y));
      edges += 2;
    }
  }
  for (let x = band; x < width - band; x += 2) {
    for (let y = 0; y < rim; y++) {
      edge += Number(off(x, y)) + Number(ink(x, height - 1 - y));
      edges += 2;
    }
  }
  let on = 0, all = 0;
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      on += Number(off(x, y));
      all += 1;
    }
  }
  const covers = on / Math.max(1, all);
  return edge / Math.max(1, edges) <= EDGE_SPILL && covers >= IN_FRAME && covers <= MOST_OF_FRAME;
}

/** A frame's look, from its raw pixels (r, g, b first in each pixel of `channels`) */
export function lookFromPixels(data: Uint8Array | Uint8ClampedArray, width: number, height: number, channels = 3, at = 0): VideoLook {
  const px = (x: number, y: number) => (y * width + x) * channels;

  // The field: both side bands from 15% to 70% down, and a band across the top
  const r: number[] = [], g: number[] = [], b: number[] = [];
  const take = (x: number, y: number) => {
    const i = px(x, y);
    r.push(data[i]);
    g.push(data[i + 1]);
    b.push(data[i + 2]);
  };
  const side = Math.max(1, Math.round(width * 0.03));
  for (let y = Math.round(height * 0.15); y < Math.round(height * 0.7); y += 2) {
    for (let x = 0; x < side; x++) {
      take(x, y);
      take(width - 1 - x, y);
    }
  }
  for (let y = Math.round(height * 0.01); y < Math.round(height * 0.06); y += 2) for (let x = 0; x < width; x += 3) take(x, y);
  const field = [median(r), median(g), median(b)];

  // The figure: the commonest colour of what stands out from the field in the middle of the frame
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = Math.round(height * 0.2); y < Math.round(height * 0.9); y += 2) {
    for (let x = Math.round(width * 0.15); x < Math.round(width * 0.85); x += 2) {
      const i = px(x, y);
      const d = Math.abs(data[i] - field[0]) + Math.abs(data[i + 1] - field[1]) + Math.abs(data[i + 2] - field[2]);
      if (d < ON_FIELD) continue;
      const key = ((data[i] / BIN) | 0) * 4096 + ((data[i + 1] / BIN) | 0) * 64 + ((data[i + 2] / BIN) | 0);
      const bin = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      bin.n += 1;
      bin.r += data[i];
      bin.g += data[i + 1];
      bin.b += data[i + 2];
      bins.set(key, bin);
    }
  }
  let top: { n: number; r: number; g: number; b: number } | null = null;
  for (const bin of bins.values()) if (!top || bin.n > top.n) top = bin;
  return {
    field: hex(field[0], field[1], field[2]),
    figure: top ? hex(top.r / top.n, top.g / top.n, top.b / top.n) : null,
    at,
  };
}
