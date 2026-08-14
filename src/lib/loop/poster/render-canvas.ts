"use client";

import QRCode from "qrcode";
import { FONT_FAMILY, INK, QR_OPTS } from "../brand";
import type { DisplayList } from "./layout";

/**
 * Browser side of the poster engine: resolve every image the layout will
 * place (prepare), then draw a display list to a canvas (render). All layout
 * decisions — including every glyph's position — were made in layout.ts; this
 * file only executes them, so it can never disagree with the Node renderer
 * about where anything sits.
 */

export type PreparedImages = {
  sizes: Record<string, { w: number; h: number }>;
  images: Map<string, CanvasImageSource>;
};

const svgCache = new Map<string, HTMLImageElement>();

/**
 * Load a brand SVG recoloured to ink. BOTH rewrites matter: the root `fill`
 * attribute covers paths with no fill of their own (scotts-bw.svg), and the
 * `fill:` rewrite covers `<style>` class fills (odubo.svg uses `.cls-2 {
 * fill: … }`, which BEATS a root attribute — the old canvas loader missed
 * this and was correct only because the baked colour happened to be ink).
 */
async function loadInkSvg(path: string): Promise<HTMLImageElement> {
  const cached = svgCache.get(path);
  if (cached) return cached;
  const text = await (await fetch(path)).text();
  const vb = text.match(/viewBox="([\d.\s-]+)"/)?.[1]?.split(/\s+/).map(Number);
  const [, , vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 300, 150];
  const inked = text
    .replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, `fill:${INK}`)
    .replace(/<svg/, `<svg fill="${INK}" width="${vw}" height="${vh}"`);
  const img = new Image();
  // data: URL, not blob — SVG blob decoding fails in some engines.
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(inked)}`;
  await img.decode();
  if (!img.width || !img.height) throw new Error(`SVG failed to decode: ${path}`);
  svgCache.set(path, img);
  return img;
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

/** Generated big and scaled down at draw; smoothing is disabled for QR draws. */
const QR_RENDER_PX = 1024;

/** Resolve intrinsic sizes + drawables for every src a spec references. */
export async function prepareImages(srcs: string[]): Promise<PreparedImages> {
  const sizes: PreparedImages["sizes"] = {};
  const images = new Map<string, CanvasImageSource>();

  await Promise.all(
    [...new Set(srcs)].map(async (src) => {
      if (src.startsWith("qr:")) {
        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, src.slice(3), { width: QR_RENDER_PX, ...QR_OPTS });
        sizes[src] = { w: canvas.width, h: canvas.height };
        images.set(src, canvas);
      } else if (src.endsWith(".svg")) {
        const img = await loadInkSvg(src);
        sizes[src] = { w: img.width, h: img.height };
        images.set(src, img);
      } else {
        const img = await loadImage(src);
        sizes[src] = { w: img.width, h: img.height };
        images.set(src, img);
      }
    }),
  );

  return { sizes, images };
}

/** Draw a display list. The face must be loaded first — canvas fillText does
 *  not trigger lazy @font-face loading on its own. */
export async function renderCanvas(
  list: DisplayList,
  prepared: PreparedImages,
): Promise<HTMLCanvasElement> {
  await Promise.all([
    document.fonts.load(`500 100px "${FONT_FAMILY}"`),
    document.fonts.load(`700 100px "${FONT_FAMILY}"`),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = list.w;
  canvas.height = list.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable.");
  ctx.textBaseline = "alphabetic";
  ctx.imageSmoothingQuality = "high";

  for (const op of list.ops) {
    switch (op.kind) {
      case "rect": {
        ctx.fillStyle = op.fill;
        ctx.fillRect(op.x, op.y, op.w, op.h);
        break;
      }
      case "image": {
        const img = prepared.images.get(op.src);
        if (!img) throw new Error(`image not prepared: ${op.src}`);
        ctx.save();
        if (op.opacity != null) ctx.globalAlpha = op.opacity;
        // QR modules must stay square-edged; everything else smooths.
        ctx.imageSmoothingEnabled = !op.src.startsWith("qr:");
        ctx.drawImage(img, op.x, op.y, op.w, op.h);
        ctx.restore();
        break;
      }
      case "glyphs": {
        ctx.save();
        ctx.font = `${op.weight} ${op.size}px "${FONT_FAMILY}"`;
        ctx.fillStyle = op.fill;
        ctx.globalAlpha = op.opacity;
        ctx.textAlign = "left";
        for (const g of op.glyphs) ctx.fillText(g.ch, g.x, op.y);
        ctx.restore();
        break;
      }
      case "arcGlyphs": {
        ctx.save();
        ctx.font = `${op.weight} ${op.size}px "${FONT_FAMILY}"`;
        ctx.fillStyle = op.fill;
        ctx.globalAlpha = op.opacity;
        ctx.textAlign = "center";
        for (const g of op.glyphs) {
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.rotate(g.rot);
          ctx.fillText(g.ch, 0, 0);
          ctx.restore();
        }
        ctx.restore();
        break;
      }
      case "rule": {
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.globalAlpha = op.opacity;
        ctx.lineWidth = op.width;
        if (op.dash) ctx.setLineDash(op.dash);
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();
        ctx.restore();
        break;
      }
    }
  }

  return canvas;
}
