/**
 * A piece's look (lib/store/pieceLook): where it is in its photo, and the room
 * its own colour gives it. Any new piece is answered the same way.
 */
import { boundsFromPixels, roomFromPixels } from '@/lib/store/pieceLook';

jest.mock('sharp', () => ({}), { virtual: true });

const W = 100;
const H = 100;

/** A photo: transparent, with a rectangle of one colour, and optionally a small patch of another */
function photo(
  fill: [number, number, number],
  box = { x0: 20, y0: 10, x1: 80, y1: 90 },
  patch?: { colour: [number, number, number]; x0: number; y0: number; size: number },
): Uint8Array {
  const data = new Uint8Array(W * H * 4);
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const p = (y * W + x) * 4;
      const inPatch = patch && x >= patch.x0 && x < patch.x0 + patch.size && y >= patch.y0 && y < patch.y0 + patch.size;
      const [r, g, b] = inPatch ? patch!.colour : fill;
      data.set([r, g, b, 255], p);
    }
  }
  return data;
}

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return -1;
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}
function lightness(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

describe('boundsFromPixels', () => {
  it('keeps everything visible, with a little air, and meets the hem exactly', () => {
    const b = boundsFromPixels(photo([120, 20, 30]), W, H)!;
    expect(b.top).toBeCloseTo(0.085, 3);
    expect(b.left).toBeCloseTo(0.185, 3);
    expect(b.right).toBeCloseTo(0.815, 3);
    expect(b.bottom).toBeCloseTo(0.9, 3);
    expect(b.aspect).toBe(1);
  });
  it('counts a soft edge as part of the piece, so it is never cut', () => {
    const data = photo([120, 20, 30]);
    data[(5 * W + 50) * 4 + 3] = 20; // a faint wisp above the collar
    expect(boundsFromPixels(data, W, H)!.top).toBe(0.035);
  });
  it('is nothing for an empty photo', () => {
    expect(boundsFromPixels(new Uint8Array(W * H * 4), W, H)).toBeNull();
  });
});

describe('roomFromPixels', () => {
  it('stands a dark coloured piece in a light room of its own hue (wine on rose)', () => {
    const room = roomFromPixels(photo([110, 25, 35]), W, H)!;
    expect(Math.abs(((hue(room) - 352 + 540) % 360) - 180)).toBeLessThan(12);
    expect(lightness(room)).toBeGreaterThan(0.75);
  });
  it('stands a light piece in a deeper room of its own hue (sand on ochre)', () => {
    const room = roomFromPixels(photo([214, 196, 160]), W, H)!;
    expect(hue(room)).toBeGreaterThan(30);
    expect(hue(room)).toBeLessThan(50);
    expect(lightness(room)).toBeLessThan(0.6);
  });
  it('gives a black piece the colour of its print', () => {
    const room = roomFromPixels(photo([18, 18, 20], undefined, { colour: [200, 90, 40], x0: 40, y0: 30, size: 5 }), W, H)!;
    expect(hue(room)).toBeGreaterThan(10);
    expect(hue(room)).toBeLessThan(35);
  });
  it('puts a piece with no colour on it at all in a quiet grey', () => {
    const room = roomFromPixels(photo([16, 16, 16]), W, H)!;
    expect(lightness(room)).toBeGreaterThan(0.8);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(room.slice(i, i + 2), 16));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
  });
  it('answers a colour no piece has had before', () => {
    const room = roomFromPixels(photo([20, 120, 60]), W, H)!; // a green no piece has yet
    expect(hue(room)).toBeGreaterThan(130);
    expect(hue(room)).toBeLessThan(160);
  });
  it('is nothing for an empty photo', () => {
    expect(roomFromPixels(new Uint8Array(W * H * 4), W, H)).toBeNull();
  });
});
