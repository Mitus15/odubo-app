import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  INK,
  SAND,
  SLOGAN,
  ANTHEM_PHRASE,
  TRIAD,
  measure,
  type FontWeight,
} from "../../src/lib/loop/brand";
import { face, glyphPathData, assertFontResolves } from "./poster-render-sharp";

/**
 * Loop Soul merch kit — every brand element as its own transparent PNG.
 *
 *   npx tsx scripts/loop/merch-kit.ts
 *   npx tsx scripts/loop/merch-kit.ts --out=/some/dir
 *
 * One file per element, so a garment can be composed freely — wordmark on the
 * front, slogan across the back, triad down a sleeve. No placement variants:
 * every file ships at its maximum clean size and is trimmed tight to the
 * artwork, so scaling DOWN in a design tool is always safe and positioning is
 * exact. (Scaling up is the only thing that can hurt you — the ceilings are in
 * README.md.)
 *
 * Two colourways, because the garment is the background: ink for light
 * garments, sand for dark. The poster kit's artwork lives ON a sand field;
 * printing that on a tee would put a beige rectangle on the shirt.
 *
 * Type is rendered as Jost glyph OUTLINES from the committed fonts — the same
 * pipeline as the posters, so a tee and a poster speak in one voice and the
 * kit renders identically on any machine. (The first kit set SVG <text> in
 * "Avenir Next", which only exists on one laptop.)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

const DPI = 300;
/** Type is vector-derived, so it's rendered big enough for any garment. */
const TYPE_WIDTH = 4500; // 15" at 300 DPI

/** Locked brand colours (docs/decisions/loop-soul-brand-language.md). */
const COLOURWAYS: Record<string, { hex: string; rgb: { r: number; g: number; b: number } }> = {
  ink: { hex: INK, rgb: { r: 0x2a, g: 0x0f, b: 0x0a } },
  sand: { hex: SAND, rgb: { r: 0xd9, g: 0xaa, b: 0x7a } },
};

const FIGURES = ["crowd", "dance", "spin", "listen"];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true] as const;
  }),
) as Record<string, string | true>;

/**
 * Recolour artwork to a flat brand colour while keeping its alpha.
 * The silhouette is a SHAPE — between colourways the only thing that changes is
 * which flat colour fills it, so take the alpha as the shape and fill it.
 */
async function recolour(buf: Buffer, { r, g, b }: { r: number; g: number; b: number }) {
  const img = sharp(buf).ensureAlpha();
  const { width, height } = await img.metadata();
  const alpha = await img.clone().extractChannel(3).toBuffer();
  return sharp({ create: { width: width!, height: height!, channels: 3, background: { r, g, b } } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

/** Trim transparent padding and tag 300 DPI so print size is unambiguous. */
async function finish(buf: Buffer) {
  return sharp(buf).trim().withMetadata({ density: DPI }).png().toBuffer();
}

/** The wordmark, from vector — recoloured at render so it stays crisp. */
async function wordmark(colour: string, widthPx: number) {
  let svg = await fs.readFile(path.join(ROOT, "public/loop/branding/loop-soul.svg"), "utf8");
  svg = svg.replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, `fill:${colour}`);
  svg = svg.replace(/<svg/, `<svg fill="${colour}"`);
  return sharp(Buffer.from(svg), { density: 900 }).resize({ width: widthPx }).png().toBuffer();
}

type TypeLine = { text: string; size: number; weight: FontWeight; track: number; gap?: number };

/**
 * Type set in one voice, per the brand rules: centred, tracked, no punctuation
 * added — as Jost outlines, never <text>.
 */
async function type(lines: TypeLine[], colour: string, widthPx: number) {
  const W = 3000;
  let y = 0;
  const parts: string[] = [];
  for (const l of lines) {
    y += l.size * 1.12;
    const font = await face(l.weight);
    const total = measure(l.text, { size: l.size, weight: l.weight, track: l.track });
    let x = (W - total) / 2;
    const d: string[] = [];
    for (const ch of l.text) {
      d.push(glyphPathData(font, ch, x, y, l.size));
      x += measure(ch, { size: l.size, weight: l.weight }) + l.size * l.track;
    }
    parts.push(`<path d="${d.filter(Boolean).join(" ")}" fill="${colour}"/>`);
    y += l.gap ?? 0;
  }
  const svg = `<svg width="${W}" height="${Math.ceil(y + 60)}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
  return sharp(Buffer.from(svg), { density: 300 }).trim().resize({ width: widthPx }).png().toBuffer();
}

/* ------------------------------------------------------------------ run */

async function main() {
  // Refuse to render a single pixel in a substitute typeface.
  await assertFontResolves();

  const out =
    typeof args.out === "string"
      ? args.out
      : path.join(process.env.HOME!, "Documents/Loop-soul-the-entertainment-room/tapstitch-2026-08");

  // Start clean so removed/renamed elements can't linger and get sent to a printer.
  for (const name of Object.keys(COLOURWAYS)) {
    await fs.rm(path.join(out, name), { recursive: true, force: true });
  }

  const sizes: { file: string; w: number; h: number }[] = [];

  for (const [name, colour] of Object.entries(COLOURWAYS)) {
    const dir = path.join(out, name);
    await fs.mkdir(dir, { recursive: true });
    const write = async (file: string, buf: Buffer) => {
      const done = await finish(buf);
      await fs.writeFile(path.join(dir, file), done);
      if (name === "ink") {
        const m = await sharp(done).metadata();
        sizes.push({ file, w: m.width!, h: m.height! });
      }
    };

    // ── the figures ───────────────────────────────────────────────────────
    for (const fig of FIGURES) {
      const src = await fs.readFile(path.join(ROOT, "public/loop/figures", `${fig}.png`));
      await write(`${fig}.png`, await recolour(src, colour.rgb));
    }

    // ── the logo ──────────────────────────────────────────────────────────
    await write("wordmark.png", await wordmark(colour.hex, TYPE_WIDTH));

    // ── the type ──────────────────────────────────────────────────────────
    // One line reads across a back or a chest strip; stacked suits a front.
    await write(
      "slogan.png",
      await type([{ text: SLOGAN, size: 120, weight: 700, track: 0.02 }], colour.hex, TYPE_WIDTH),
    );
    await write(
      "slogan-stacked.png",
      await type(
        [
          { text: "Come", size: 150, weight: 700, track: 0.02, gap: 10 },
          { text: "Dance", size: 150, weight: 700, track: 0.02 },
        ],
        colour.hex,
        Math.round(TYPE_WIDTH * 0.62),
      ),
    );
    // The anthem phrase — a SECONDARY piece, never the slogan (brand doc).
    // Mixed case as written, never punctuated, never "cleaned up".
    await write(
      "anthem-phrase.png",
      await type([{ text: ANTHEM_PHRASE, size: 110, weight: 700, track: 0.02 }], colour.hex, TYPE_WIDTH),
    );
    await write(
      "anthem-phrase-stacked.png",
      await type(
        [
          { text: "What we", size: 140, weight: 700, track: 0.02, gap: 10 },
          { text: "dancin' to", size: 140, weight: 700, track: 0.02 },
        ],
        colour.hex,
        Math.round(TYPE_WIDTH * 0.62),
      ),
    );
    await write(
      "triad.png",
      await type([{ text: TRIAD, size: 60, weight: 500, track: 0.4 }], colour.hex, TYPE_WIDTH),
    );

    // ── the full stack, for when one piece must carry the whole brand ─────
    const wm = await wordmark(colour.hex, 1800);
    const wmMeta = await sharp(wm).metadata();
    const stack = await type(
      [
        { text: SLOGAN, size: 120, weight: 700, track: 0.02, gap: 42 },
        { text: TRIAD, size: 46, weight: 500, track: 0.4 },
      ],
      colour.hex,
      2400,
    );
    const stackMeta = await sharp(stack).metadata();
    const w = Math.max(wmMeta.width!, stackMeta.width!);
    const gap = 120;
    await write(
      "lockup.png",
      await sharp({
        create: {
          width: w,
          height: wmMeta.height! + gap + stackMeta.height!,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          { input: wm, left: Math.round((w - wmMeta.width!) / 2), top: 0 },
          { input: stack, left: Math.round((w - stackMeta.width!) / 2), top: wmMeta.height! + gap },
        ])
        .png()
        .toBuffer(),
    );

    console.log(`${name.padEnd(5)} → ${dir}`);
  }

  // Vector, for embroidery and anything that must scale without limit.
  const vec = path.join(out, "vector");
  await fs.mkdir(vec, { recursive: true });
  await fs.copyFile(
    path.join(ROOT, "public/loop/branding/loop-soul.svg"),
    path.join(vec, "loop-soul-wordmark.svg"),
  );

  /**
   * Report the real ceiling per file. 300 DPI is what a printer asks for; 150
   * is the practical floor for direct-to-garment, where ink spreads into the
   * weave. Quoting only 300 would say the figures can't be a front print when
   * they can; quoting only 150 invites a soft print on a garment someone paid
   * for.
   */
  console.log("\nMax print width — scale DOWN freely, never up:\n");
  console.log("  file                        pixels        @300 DPI     @150 DPI");
  for (const s of sizes.sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(
      `  ${s.file.padEnd(27)} ${`${s.w}×${s.h}`.padEnd(13)} ${`${(s.w / 300).toFixed(1)}"`.padEnd(12)} ${(s.w / 150).toFixed(1)}"`,
    );
  }
  console.log("\nout:", out);
}

main().catch((e) => {
  console.error(String((e as Error).message ?? e));
  process.exit(1);
});
