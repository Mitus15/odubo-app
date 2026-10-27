/**
 * How a piece looks in its photo, read once on the server (see gear/page.tsx)
 * so the page arrives ready and the phone does no work for it:
 *
 *   bounds   where anything visible is (the garment, its soft edges, its
 *            glow): the photo is cropped to that and no tighter, so no edge
 *            of the piece is ever cut, and its floor meets its hem
 *   room     the colour of the room it stands in, taken from the piece itself:
 *            a pop tint of its own hue (a wine jacket on a rose, a sand hoodie
 *            on ochre, a light piece on a deeper tone of its own); a black or
 *            white piece takes the colour of its print, and only a piece with
 *            no colour on it at all stands in a quiet grey. Each room has a
 *            reason: the piece
 */

export interface PieceBounds {
  /** As fractions of the photo */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** The photo's own width over height */
  aspect: number;
}

export interface PieceLook {
  bounds: PieceBounds | null;
  room: string | null;
}

/** Anything at all visible: a crop never cuts what can be seen */
export const VISIBLE_ALPHA = 8;
/** Opaque enough to be the garment's own colour, not its glow or its edge */
export const SOLID_ALPHA = 200;
/** Air kept around what is visible, so a soft edge never meets the crop */
const MARGIN = 0.015;

/** The box of everything visible in raw pixels (alpha in the last of `channels`), or null for an empty photo */
export function boundsFromPixels(data: Uint8Array | Uint8ClampedArray, width: number, height: number, channels = 4): PieceBounds | null {
  let top = height, bottom = -1, left = width, right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + channels - 1] < VISIBLE_ALPHA) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return null;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    top: clamp(top / height - MARGIN),
    // The floor meets the lowest thing visible, so no margin under it
    bottom: clamp((bottom + 1) / height),
    left: clamp(left / width - MARGIN),
    right: clamp((right + 1) / width + MARGIN),
    aspect: width / height,
  };
}

function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

const HUES = 24;
/** Below this the piece reads as black, white or grey */
const NEUTRAL = 0.08;
/** A pixel this colourful on a plain piece is its print */
const ACCENT = 0.25;
/** A print this big (of the piece) is enough to give the room its colour */
const ACCENT_SHARE = 0.001;

/**
 * The room a piece stands in, from its own colour: the hue that most of its
 * colourful pixels share, as a pop tint. A dark piece gets a light room of its
 * hue, a light piece a deeper one, so the piece always stands out of it.
 * Null for an empty photo.
 */
export function roomFromPixels(data: Uint8Array | Uint8ClampedArray, width: number, height: number, channels = 4): string | null {
  const weight = new Float64Array(HUES);
  const hueSum = new Float64Array(HUES);
  // The print on a plain piece: its few strongly coloured pixels
  const accent = new Float64Array(HUES);
  const accentHue = new Float64Array(HUES);
  let n = 0, light = 0, sat = 0, chroma = 0, accents = 0;
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    if (channels === 4 && data[p + 3] < SOLID_ALPHA) continue;
    const [h, s, l] = hsl(data[p] / 255, data[p + 1] / 255, data[p + 2] / 255);
    const c = s * (1 - Math.abs(2 * l - 1));
    const bin = Math.floor(h * HUES) % HUES;
    weight[bin] += c;
    hueSum[bin] += c * h;
    if (c >= ACCENT) {
      accent[bin] += c;
      accentHue[bin] += c * h;
      accents += 1;
    }
    n += 1;
    light += l;
    sat += s * c;
    chroma += c;
  }
  if (!n) return null;
  const L = light / n;
  const strongest = (w: Float64Array, sum: Float64Array) => {
    let top = 0;
    for (let b = 1; b < HUES; b++) if (w[b] > w[top]) top = b;
    return w[top] ? sum[top] / w[top] : 0;
  };

  if (chroma / n < NEUTRAL) {
    // Black, white, grey: the room takes the colour of its print, if it has one,
    // else a quiet neutral of the faint hue it has
    if (accents / n >= ACCENT_SHARE) return hex(strongest(accent, accentHue), 0.6, 0.8);
    return hex(strongest(weight, hueSum), 0.08, L < 0.5 ? 0.86 : 0.42);
  }
  const S = Math.min(0.8, Math.max(0.5, chroma ? sat / chroma : 0.5));
  return hex(strongest(weight, hueSum), S, L < 0.55 ? 0.82 : 0.5);
}

/** The width the photo is read at: enough for a small seal on a chest to count */
const SAMPLE = 320;

const known = new Map<string, Promise<PieceLook>>();

/** A photo's look, read from a copy 320 wide (Shopify's CDN sizes on request); a new piece gets its room the first time it is shown. Nothing known when it cannot be read: the piece stands uncropped in the house's dark. */
export function pieceLook(url: string): Promise<PieceLook> {
  const photo = url.split('?')[0];
  let found = known.get(photo);
  if (!found) {
    found = (async () => {
      try {
        const { default: sharp } = await import('sharp');
        const res = await fetch(`${photo}?width=${SAMPLE}`, { next: { revalidate: 86400 } });
        if (!res.ok) return { bounds: null, room: null };
        const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        return {
          bounds: boundsFromPixels(data, info.width, info.height, info.channels),
          room: roomFromPixels(data, info.width, info.height, info.channels),
        };
      } catch {
        return { bounds: null, room: null };
      }
    })();
    known.set(photo, found);
  }
  return found;
}
