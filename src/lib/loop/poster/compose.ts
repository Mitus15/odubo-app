"use client";

/**
 * Poster Studio composition engine — recreates the Loop Soul marketing poster
 * (the 2400×3300 artworks in public/loop/posters/) on a canvas from parts:
 * sand field → figure → arced tagline → wordmark SVG → optional event details
 * → Scott's mark → QR code back to the app.
 *
 * The wordmark is ALWAYS the real SVG (see Logo.tsx: never typeset it); it and
 * Scott's mark are recoloured to ink by injecting a fill on the SVG source.
 * Arc text is drawn per-character along a quadratic (SVG-as-image can't load
 * webfonts, so the canvas draws it directly with the loaded Inter face).
 */

import QRCode from "qrcode";

const SAND = "#d9aa7a";
const INK = "#2a0f0a";

export const POSTER_SIZES = {
  print: { w: 2400, h: 3300, label: "Print · 8×11in 300dpi" },
  feed: { w: 1080, h: 1350, label: "Feed · 4:5" },
  story: { w: 1080, h: 1920, label: "Story · 9:16" },
} as const;

export type PosterSize = keyof typeof POSTER_SIZES;

export type PosterSpec = {
  size: PosterSize;
  /** Figure image URL (brand cut-out, uploaded object URL, or Wall media). */
  figureSrc: string | null;
  tagline: string;
  qrUrl: string;
  showDetails: boolean;
  details: { title: string; theme: string; venue: string; dateLabel: string };
  /** Resolved CSS font-family string for Inter (read from the themed DOM). */
  fontSans: string;
};

const svgCache = new Map<string, HTMLImageElement>();

/** Load an SVG recoloured to ink (injected fill) as a drawable image. The
 *  brand SVGs are viewBox-only (no width/height → no intrinsic size → NaN
 *  draw math), so explicit dimensions are injected from the viewBox. */
async function loadInkSvg(path: string): Promise<HTMLImageElement | null> {
  const cached = svgCache.get(path);
  if (cached) return cached;
  try {
    const text = await (await fetch(path)).text();
    const vb = text.match(/viewBox="([\d.\s-]+)"/)?.[1]?.split(/\s+/).map(Number);
    const [, , vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 300, 150];
    const inked = text.replace(
      /<svg/,
      `<svg fill="${INK}" width="${vw}" height="${vh}"`,
    );
    // data: URL, not a blob URL — SVG blob decoding fails in some engines.
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(inked)}`;
    await img.decode();
    if (!img.width || !img.height) return null;
    svgCache.set(path, img);
    return img;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the figure image."));
    img.src = src;
  });
}

/** Draw text per-character along a quadratic bezier (downward arc, as on the
 *  source posters), rotating each glyph to the local tangent. */
function drawArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  font: string,
  color: string,
): void {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const point = (t: number): [number, number] => {
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return [
      a * p0[0] + b * p1[0] + c * p2[0],
      a * p0[1] + b * p1[1] + c * p2[1],
    ];
  };

  // Arc length approximation for even glyph spacing.
  const SAMPLES = 200;
  const lengths: number[] = [0];
  let prev = point(0);
  for (let i = 1; i <= SAMPLES; i++) {
    const cur = point(i / SAMPLES);
    lengths.push(lengths[i - 1] + Math.hypot(cur[0] - prev[0], cur[1] - prev[1]));
    prev = cur;
  }
  const total = lengths[SAMPLES];
  const tAt = (dist: number): number => {
    let lo = 0, hi = SAMPLES;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] < dist) lo = mid + 1;
      else hi = mid;
    }
    return lo / SAMPLES;
  };

  // Auto-shrink so long questions never pile up at the arc's end.
  let widths = [...text].map((ch) => ctx.measureText(ch).width);
  let textLen = widths.reduce((s, w) => s + w, 0);
  if (textLen > total * 0.92) {
    const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
    if (sizeMatch) {
      const shrunk = Math.floor(parseFloat(sizeMatch[1]) * ((total * 0.92) / textLen));
      ctx.font = font.replace(/(\d+(?:\.\d+)?)px/, `${shrunk}px`);
      widths = [...text].map((ch) => ctx.measureText(ch).width);
      textLen = widths.reduce((s, w) => s + w, 0);
    }
  }
  let cursor = Math.max(0, (total - textLen) / 2);

  for (let i = 0; i < text.length; i++) {
    const half = widths[i] / 2;
    const t = tAt(cursor + half);
    const [x, y] = point(t);
    const [xa, ya] = point(Math.max(0, t - 0.01));
    const [xb, yb] = point(Math.min(1, t + 0.01));
    const angle = Math.atan2(yb - ya, xb - xa);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    cursor += widths[i];
  }
  ctx.restore();
}

/** Compose the full poster; returns the canvas (caller previews or exports). */
export async function composePoster(spec: PosterSpec): Promise<HTMLCanvasElement> {
  const { w: W, h: H } = POSTER_SIZES[spec.size];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable.");

  await document.fonts.ready;

  // 1. The field.
  ctx.fillStyle = SAND;
  ctx.fillRect(0, 0, W, H);

  const pad = W * 0.06;

  // 2. The figure — bottom-anchored, left-of-centre (arc text rides the right).
  if (spec.figureSrc) {
    const img = await loadImage(spec.figureSrc);
    const maxH = H * 0.5;
    const maxW = W * 0.72;
    const scale = Math.min(maxH / img.height, maxW / img.width);
    const fw = img.width * scale;
    const fh = img.height * scale;
    ctx.drawImage(img, W * 0.42 - fw / 2, H * 0.9 - fh, fw, fh);
  }

  // 3. Arced tagline, flowing down the right side (source-poster idiom).
  if (spec.tagline.trim()) {
    const fontSize = Math.round(W * 0.045);
    drawArcText(
      ctx,
      spec.tagline.trim(),
      [W * 0.56, H * 0.34],
      [W * 0.8, H * 0.42],
      [W * 0.9, H * 0.62],
      `700 ${fontSize}px ${spec.fontSans}`,
      INK,
    );
  }

  // 4. Wordmark — the real SVG, top-right.
  const mark = await loadInkSvg("/loop/branding/loop-soul.svg");
  if (mark) {
    const mw = W * 0.26;
    const mh = (mark.height / mark.width) * mw;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(mark, W - mw - pad, pad, mw, mh);
    ctx.globalAlpha = 1;
  }

  // 5. Event details — top-left block (poster header idiom).
  if (spec.showDetails) {
    const d = spec.details;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let y = pad;
    if (d.title) {
      ctx.font = `700 ${Math.round(W * 0.018)}px ${spec.fontSans}`;
      ctx.globalAlpha = 0.7;
      drawTracked(ctx, d.title.toUpperCase(), pad, y, W * 0.004);
      ctx.globalAlpha = 1;
      y += W * 0.032;
    }
    if (d.theme) {
      ctx.font = `900 ${Math.round(W * 0.055)}px ${spec.fontSans}`;
      ctx.fillText(d.theme, pad, y);
      y += W * 0.07;
    }
    ctx.font = `600 ${Math.round(W * 0.017)}px ${spec.fontSans}`;
    ctx.globalAlpha = 0.75;
    if (d.dateLabel) {
      drawTracked(ctx, d.dateLabel.toUpperCase(), pad, y, W * 0.003);
      y += W * 0.028;
    }
    if (d.venue) drawTracked(ctx, d.venue.toUpperCase(), pad, y, W * 0.003);
    ctx.globalAlpha = 1;
  }

  // 6. Brand row — Odubo PRESENTS (centre), Scott's as VENUE PARTNER (left).
  const labelFont = `700 ${Math.round(W * 0.012)}px ${spec.fontSans}`;
  const odubo = await loadInkSvg("/loop/branding/odubo.svg");
  if (odubo) {
    const oh = H * 0.045;
    const ow = (odubo.width / odubo.height) * oh;
    const oy = H - oh - pad * 0.7;
    ctx.fillStyle = INK;
    ctx.font = labelFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.globalAlpha = 0.6;
    ctx.fillText("P R E S E N T E D   B Y", W / 2, oy - H * 0.008);
    ctx.globalAlpha = 1;
    ctx.drawImage(odubo, W / 2 - ow / 2, oy, ow, oh);
  }
  const scotts = await loadInkSvg("/loop/branding/scotts-bw.svg");
  if (scotts) {
    const sh = H * 0.02;
    const sw = (scotts.width / scotts.height) * sh;
    const sy = H - sh - pad * 0.7;
    ctx.fillStyle = INK;
    ctx.font = labelFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.globalAlpha = 0.6;
    ctx.fillText("V E N U E   P A R T N E R", pad, sy - H * 0.008);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(scotts, pad, sy, sw, sh);
    ctx.globalAlpha = 1;
  }

  // 7. QR back to the app — bottom-right, ink on sand, with quiet zone.
  if (spec.qrUrl.trim()) {
    const qrSize = Math.round(W * 0.13);
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, spec.qrUrl.trim(), {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: INK, light: SAND },
    });
    ctx.drawImage(qrCanvas, W - qrSize - pad * 0.7, H - qrSize - pad * 0.7);
  }

  return canvas;
}

/** Letter-tracked uppercase line (canvas has no letter-spacing). */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}
