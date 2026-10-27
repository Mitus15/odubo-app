/**
 * The room: the world he dances in, which the site is set in.
 *
 * Every dance piece is shot as a dancer on one flat colour that goes on
 * forever, the field, with a lacquer floor. The colours are the second
 * album's pop-art palette: concept pieces, not the brand's colours, and more
 * come with every piece, so nothing here knows any colour by name. The
 * video's field is exactly the colour its campaign holds (sampled flat edge to
 * edge: #f592a6 against #f593a6), so a page painted in that colour has no
 * edge around the video: the room carries on to the edges of the screen.
 * Writing in the room is the house's ink or sand, whichever reads better on
 * the field it is given.
 */
import type { Level } from '@/lib/levels';

export const ROOM_INK = '#2a0f0a';
export const ROOM_SAND = '#f0d3ad';
/** The room before any level is out, and the outro after the last: the house's ink */
export const ROOM_DARK = ROOM_INK;

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The writing on a field: ink, the dancer's own colour, wherever it reads
 * (contrast 4.5 or more); otherwise whichever of ink and sand reads better.
 * Any colour a new piece brings is answered the same way.
 */
export function onRoom(colour: string): string {
  if (!/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(colour)) return ROOM_INK;
  const ink = contrast(colour, ROOM_INK);
  if (ink >= 4.5) return ROOM_INK;
  return contrast(colour, ROOM_SAND) > ink ? ROOM_SAND : ROOM_INK;
}

/** The room a page is set in: the level the visitor came from (?room=), else the newest, else the house's ink */
export function roomFor(levels: Level[], from?: string | null): { colour: string; on: string; level: Level | null } {
  const level = (from && levels.find((l) => l.id === from)) || levels[0] || null;
  const colour = level?.colour || ROOM_DARK;
  return { colour, on: onRoom(colour), level };
}
