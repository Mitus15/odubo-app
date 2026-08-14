import sharp from "sharp";
import QRCode from "qrcode";
import opentype from "opentype.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INK, QR_OPTS, measure, type FontWeight } from "../../src/lib/loop/brand";
import type { DisplayList, Op } from "../../src/lib/loop/poster/layout";

/**
 * Node side of the poster engine: resolve image sources from the repo
 * (prepare), then rasterise a display list with sharp (render).
 *
 * Text is emitted as GLYPH OUTLINES — real vector paths extracted from the
 * committed Jost TTFs with opentype.js — not as SVG <text>. The first attempt
 * used <text> + fontconfig and the font self-check caught it immediately:
 * sharp's macOS build resolves fonts through CoreText, silently ignoring
 * FONTCONFIG_FILE, which is exactly how the old kit ended up depending on one
 * laptop's font book. Outlines need no font resolution at all, on any
 * machine, ever — and they come from the same files the layout's metrics
 * table was generated from, so shapes and spacing agree by construction.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type Prepared = {
  sizes: Record<string, { w: number; h: number }>;
  raw: Map<string, { kind: "raster" | "svg" | "qr"; data: Buffer }>;
};

/* ── the faces ──────────────────────────────────────────────────────────── */

const FONT_FILES: Record<FontWeight, string> = {
  500: "public/loop/fonts/Jost-500.ttf",
  700: "public/loop/fonts/Jost-700.ttf",
};

const fontCache = new Map<FontWeight, opentype.Font>();

async function face(weight: FontWeight): Promise<opentype.Font> {
  const cached = fontCache.get(weight);
  if (cached) return cached;
  const buf = await fs.readFile(path.join(ROOT, FONT_FILES[weight]));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  fontCache.set(weight, font);
  return font;
}

/**
 * Extract one glyph's outline as SVG path data — validated.
 *
 * opentype.js's lazy glyph parsing intermittently emits NaN coordinates (same
 * glyph, same position, clean on a re-call), and librsvg's response to an
 * invalid token is to silently discard the REST OF THE PATH — which is how a
 * poster once rendered as a giant "Co" with eight letters missing and the o's
 * counter filled in. Every glyph is checked here; a corrupt extraction is
 * retried once, then refused loudly. Silence is the one failure mode this
 * pipeline is not allowed to have.
 */
function glyphPathData(
  font: opentype.Font,
  ch: string,
  x: number,
  y: number,
  size: number,
): string {
  for (let attempt = 0; attempt < 2; attempt++) {
    const d = font.getPath(ch, x, y, size).toPathData(2);
    if (!/NaN|Infinity/.test(d)) return d;
  }
  throw new Error(
    `glyph outline for ${JSON.stringify(ch)} produced NaN twice — font file may be corrupt`,
  );
}

/**
 * Fail loudly if the shipped fonts and the committed metrics table have
 * drifted apart (e.g. a font swap without re-running gen-font-metrics). The
 * layout fitted every line against the table; if the outlines advance
 * differently, text would render at the wrong width without erroring.
 */
export async function assertFontResolves(): Promise<void> {
  const probeText = "Come Dance · MUSIC MODE MOVEMENT 0123456789";
  for (const weight of [500, 700] as FontWeight[]) {
    const font = await face(weight);
    if (font.charToGlyph("C").index === 0) {
      throw new Error(`${FONT_FILES[weight]} has no Latin glyphs — wrong or corrupt font file.`);
    }
    const size = 100;
    const outlineWidth = font.getAdvanceWidth(probeText, size);
    const tableWidth = measure(probeText, { size, weight });
    const drift = Math.abs(outlineWidth - tableWidth) / tableWidth;
    if (drift > 0.01) {
      throw new Error(
        `Font/metrics drift at weight ${weight}: outlines measure ${Math.round(outlineWidth)}px ` +
          `but the committed table says ${Math.round(tableWidth)}px (${(drift * 100).toFixed(1)}%). ` +
          `Re-run: node scripts/loop/gen-font-metrics.mjs`,
      );
    }
  }
}

/* ── prepare ────────────────────────────────────────────────────────────── */

/**
 * Ink a brand SVG. Both rewrites, deliberately: the root `fill` covers
 * attribute-less paths (scotts-bw.svg); the `fill:` rewrite covers `<style>`
 * class fills (odubo.svg's `.cls-2` beats a root attribute).
 */
function inkSvg(text: string): { svg: string; w: number; h: number } {
  const vb = text.match(/viewBox="([\d.\s-]+)"/)?.[1]?.split(/\s+/).map(Number);
  const [, , vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 300, 150];
  const svg = text
    .replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, `fill:${INK}`)
    .replace(/<svg/, `<svg fill="${INK}" width="${vw}" height="${vh}"`);
  return { svg, w: vw, h: vh };
}

const QR_RENDER_PX = 1024;

export async function prepareSharp(srcs: string[]): Promise<Prepared> {
  const sizes: Prepared["sizes"] = {};
  const raw: Prepared["raw"] = new Map();

  for (const src of new Set(srcs)) {
    if (src.startsWith("qr:")) {
      const buf = await QRCode.toBuffer(src.slice(3), { width: QR_RENDER_PX, ...QR_OPTS });
      sizes[src] = { w: QR_RENDER_PX, h: QR_RENDER_PX };
      raw.set(src, { kind: "qr", data: buf });
    } else if (src.endsWith(".svg")) {
      const text = await fs.readFile(path.join(ROOT, "public", src), "utf8");
      const { svg, w, h } = inkSvg(text);
      sizes[src] = { w, h };
      raw.set(src, { kind: "svg", data: Buffer.from(svg) });
    } else {
      // Repo-relative under public/, or remote (tournament album artwork).
      const buf = src.startsWith("http")
        ? Buffer.from(
            await (await fetch(src).then((r) => {
              if (!r.ok) throw new Error(`artwork fetch failed (${r.status}): ${src}`);
              return r;
            })).arrayBuffer(),
          )
        : await fs.readFile(path.join(ROOT, "public", src));
      const meta = await sharp(buf).metadata();
      sizes[src] = { w: meta.width ?? 0, h: meta.height ?? 0 };
      raw.set(src, { kind: "raster", data: buf });
    }
  }

  return { sizes, raw };
}

/* ── render ─────────────────────────────────────────────────────────────── */

async function vectorOpsToSvg(ops: Op[], W: number, H: number): Promise<Buffer> {
  const parts: string[] = [];
  for (const op of ops) {
    switch (op.kind) {
      case "rect":
        parts.push(
          `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="${op.fill}"/>`,
        );
        break;
      case "glyphs": {
        const font = await face(op.weight);
        const d = op.glyphs
          .map((g) => glyphPathData(font, g.ch, g.x, op.y, op.size))
          .filter(Boolean)
          .join(" ");
        if (d) parts.push(`<path d="${d}" fill="${op.fill}" opacity="${op.opacity}"/>`);
        break;
      }
      case "arcGlyphs": {
        const font = await face(op.weight);
        for (const g of op.glyphs) {
          const w = font.getAdvanceWidth(g.ch, op.size);
          const d = glyphPathData(font, g.ch, -w / 2, 0, op.size);
          if (!d) continue;
          const deg = ((g.rot * 180) / Math.PI).toFixed(2);
          parts.push(
            `<g transform="translate(${g.x.toFixed(1)} ${g.y.toFixed(1)}) rotate(${deg})">` +
              `<path d="${d}" fill="${op.fill}" opacity="${op.opacity}"/></g>`,
          );
        }
        break;
      }
      case "rule": {
        const dash = op.dash ? ` stroke-dasharray="${op.dash[0]} ${op.dash[1]}"` : "";
        parts.push(
          `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" ` +
            `stroke="${INK}" stroke-width="${op.width}" opacity="${op.opacity}"${dash}/>`,
        );
        break;
      }
      case "image":
        throw new Error("image ops are composited, not SVG-drawn");
    }
  }
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`,
  );
}

export async function renderSharp(list: DisplayList, prepared: Prepared): Promise<Buffer> {
  type Layer = { input: Buffer; left: number; top: number };
  const layers: Layer[] = [];
  let pendingVector: Op[] = [];

  const flushVector = async () => {
    if (pendingVector.length === 0) return;
    layers.push({ input: await vectorOpsToSvg(pendingVector, list.w, list.h), left: 0, top: 0 });
    pendingVector = [];
  };

  for (const op of list.ops) {
    if (op.kind !== "image") {
      pendingVector.push(op);
      continue;
    }
    // Op order is paint order: flush accumulated vector work before an image.
    await flushVector();
    const src = prepared.raw.get(op.src);
    if (!src) throw new Error(`image not prepared: ${op.src}`);
    let input: Buffer;
    if (src.kind === "svg") {
      input = await sharp(src.data, { density: 900 }).resize(op.w, op.h).png().toBuffer();
    } else if (src.kind === "qr") {
      // Nearest keeps the modules square-edged.
      input = await sharp(src.data).resize(op.w, op.h, { kernel: "nearest" }).png().toBuffer();
    } else {
      input = await sharp(src.data).resize(op.w, op.h).png().toBuffer();
    }
    if (op.opacity != null && op.opacity < 1) {
      input = await sharp(input)
        .ensureAlpha()
        .linear([1, 1, 1, op.opacity], [0, 0, 0, 0])
        .png()
        .toBuffer();
    }
    layers.push({ input, left: op.x, top: op.y });
  }
  await flushVector();

  return sharp({
    create: { width: list.w, height: list.h, channels: 3, background: "#ffffff" },
  })
    .composite(layers)
    .png()
    .toBuffer();
}
