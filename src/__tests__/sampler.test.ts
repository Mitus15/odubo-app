/**
 * The colour sampler (lib/sampler): a room's colours read from the video in
 * it, never written down, so a new piece in a new colour has its room at once.
 */
import { lookFromPixels, settled } from '@/lib/sampler';
import { writingOn, ROOM_INK, ROOM_SAND } from '@/lib/room';

/** A frame: a flat field, a figure filling a box in the middle, and a stray stroke on him */
function frame(field: number[], figure: number[], w = 90, h = 160) {
  const data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inFigure = x > w * 0.35 && x < w * 0.65 && y > h * 0.3 && y < h * 0.85;
      const stroke = inFigure && x === Math.round(w * 0.5);
      const c = stroke ? [240, 210, 170] : inFigure ? figure : field;
      data.set(c, (y * w + x) * 3);
    }
  return { data, w, h };
}

describe('lookFromPixels', () => {
  it('reads the field from the edges and the figure from what stands out in the middle', () => {
    const { data, w, h } = frame([245, 147, 166], [42, 15, 10]);
    expect(lookFromPixels(data, w, h)).toEqual({ field: '#f593a6', figure: '#2a0f0a', at: 0 });
  });

  it('takes any colour a new piece brings, a light blue as well as a rose', () => {
    const { data, w, h } = frame([160, 200, 240], [42, 15, 10]);
    expect(lookFromPixels(data, w, h).field).toBe('#a0c8f0');
  });

  it('has no figure on an empty field', () => {
    const { data, w, h } = frame([245, 147, 166], [245, 147, 166]);
    expect(lookFromPixels(data, w, h).figure).toBeNull();
  });
});

describe('writingOn', () => {
  it("writes in the dancer's own ink where it reads", () => {
    expect(writingOn('#f593a6', '#2a0f0a')).toBe('#2a0f0a');
    expect(writingOn('#f593a6', '#311208')).toBe('#311208');
  });

  it('falls back to the house ink or sand where his ink would not read', () => {
    expect(writingOn('#1b2a6b', '#2a0f0a')).toBe(ROOM_SAND);
    expect(writingOn('#f593a6', null)).toBe(ROOM_INK);
  });
});

describe('settled', () => {
  it('is a frame where he stands in the room', () => {
    const { data, w, h } = frame([0, 47, 167], [42, 15, 10]);
    expect(settled(data, w, h)).toBe(true);
  });

  it('is not one where he is up at the phone, filling the frame to its edges', () => {
    const w = 90, h = 160;
    const data = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(x < w * 0.7 ? [42, 15, 10] : [0, 47, 167], (y * w + x) * 3);
    expect(settled(data, w, h)).toBe(false);
  });

  it('is not the field alone, the first frame of a fade in', () => {
    const w = 90, h = 160;
    const data = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) data.set([244, 145, 165], i * 3);
    expect(settled(data, w, h)).toBe(false);
  });
});
