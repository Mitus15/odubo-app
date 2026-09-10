import { SAND } from "@/lib/loop/pose/palette";

/**
 * A stylized shot, composed as the album's cover.
 *
 * The contest asks people to make the record's face, and until they can SEE
 * their shot as a cover they are being asked to imagine it. A poster-shaped
 * photograph and a square sleeve with a wordmark on it are different objects,
 * and only one of them is the thing being offered — so the preview has to be
 * the sleeve.
 *
 * Square because covers are square, centre-cropped because that is what every
 * streaming service will do to it anyway: better to show someone the crop now
 * than to have it applied to them later.
 */

const SIZE = 2048; // what the album's own artwork ships at
const WORDMARK = "/loop/branding/loop-soul.svg";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

/**
 * Compose `frame` (already stylized) into a square cover.
 *
 * Returns a NEW canvas — the source is left alone, because the caller still
 * needs the poster-shaped version for the Wall.
 */
export async function composeCover(
  frame: HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  const out = document.createElement("canvas");
  out.width = SIZE;
  out.height = SIZE;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("no 2d context for the cover");

  // Sand ground, so a source with transparency or an odd aspect never shows
  // through as white — white is not in this palette.
  ctx.fillStyle = `rgb(${SAND[0]}, ${SAND[1]}, ${SAND[2]})`;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Centre-crop to square: scale so the SHORT edge fills, then centre the long
  // one. Cropping the middle keeps a subject who was framed centrally, which
  // is how people photograph themselves.
  const scale = Math.max(SIZE / frame.width, SIZE / frame.height);
  const w = frame.width * scale;
  const h = frame.height * scale;
  ctx.drawImage(frame, (SIZE - w) / 2, (SIZE - h) / 2, w, h);

  // The wordmark, top-right, at the same weight the record's own sleeve uses.
  const pad = Math.round(SIZE * 0.06);
  const mark = await loadImage(WORDMARK).catch(() => null);
  if (mark) {
    const mw = Math.round(SIZE * 0.26);
    const mh = (mark.height / mark.width) * mw || mw * 0.5;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(mark, SIZE - mw - pad, pad, mw, mh);
    ctx.globalAlpha = 1;
  } else {
    // A cover with no mark on it is not recognisably this record's cover, so
    // fall back to type rather than shipping a bare crop.
    ctx.fillStyle = "#2a0f0a";
    ctx.font = `500 ${Math.round(SIZE * 0.05)}px Jost, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("loop soul", SIZE - pad, pad);
  }

  return out;
}
