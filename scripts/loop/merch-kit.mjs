/**
 * Loop Soul merch kit — print-ready artwork for Tap Stitch (or any printer).
 *
 *   node scripts/loop/merch-kit.mjs
 *   node scripts/loop/merch-kit.mjs --out=/some/dir
 *
 * The poster kit makes pieces that live ON a sand field. Garments are the
 * opposite problem: the artwork has to sit on fabric whose colour we don't
 * control, so every file here is TRANSPARENT and comes in two colourways —
 * ink for light garments, sand for dark ones. Printing the sand-backed poster
 * art on a tee would put a beige rectangle on the shirt.
 *
 * Everything is generated at 300 DPI and tagged as such, sized to a real
 * physical print area in inches. Nothing is upscaled past its source: the
 * script reports the true maximum print size for each raster asset so a figure
 * can't be blown up to 12" and come out soft on a garment someone paid for.
 *
 * The wordmark comes from the SVG, so it is resolution-independent and is also
 * the file to hand over for embroidery.
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

const DPI = 300;

/** Locked brand colours (docs/decisions/loop-soul-brand-language.md). */
const COLOURWAYS = {
  ink: { hex: "#2a0f0a", rgb: { r: 0x2a, g: 0x0f, b: 0x0a }, wear: "light garments — sand, cream, natural, white" },
  sand: { hex: "#d9aa7a", rgb: { r: 0xd9, g: 0xaa, b: 0x7a }, wear: "dark garments — black, oxblood, charcoal" },
};

/** Print areas, in inches. Width is the constraint; height is the ceiling. */
const PLACEMENTS = {
  full: { w: 12, h: 15, label: "front or back" },
  chest: { w: 4, h: 4, label: "left chest" },
  sleeve: { w: 3, h: 3, label: "sleeve" },
};

const FIGURES = ["crowd", "dance", "spin", "listen"];

const BRAND = { slogan: "WHAT WE DANCIN' TO", triad: "MUSIC · MODE · MOVEMENT", sans: "Avenir Next" };

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const px = (inches) => Math.round(inches * DPI);
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Recolour artwork to a flat brand colour while keeping its alpha.
 *
 * The figures are already ink-on-transparent, but "make it sand for dark
 * shirts" must not mean inverting or levels-shifting — the silhouette is a
 * SHAPE, and the only thing that changes between colourways is which flat
 * colour fills it. Take the alpha as the shape, fill with the colour.
 */
async function recolour(buf, { r, g, b }) {
  const img = sharp(buf).ensureAlpha();
  const { width, height } = await img.metadata();
  const alpha = await img.clone().extractChannel(3).toBuffer();
  return sharp({ create: { width, height, channels: 3, background: { r, g, b } } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

/** Fit within a print box without ever upscaling; report what we actually got. */
async function fitToPrint(buf, place) {
  const meta = await sharp(buf).metadata();
  const boxW = px(place.w);
  const boxH = px(place.h);
  const scale = Math.min(boxW / meta.width, boxH / meta.height, 1);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const out = await sharp(buf)
    .resize({ width: w, height: h, fit: "inside" })
    .withMetadata({ density: DPI })
    .png()
    .toBuffer();
  return { buf: out, w, h, inches: { w: +(w / DPI).toFixed(2), h: +(h / DPI).toFixed(2) }, capped: scale === 1 };
}

/** The wordmark, from vector — recoloured at render time so it stays crisp. */
async function wordmarkPng(colour, widthPx) {
  let svg = await fs.readFile(path.join(ROOT, "public/loop/branding/loop-soul.svg"), "utf8");
  svg = svg.replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, `fill:${colour}`);
  svg = svg.replace(/<svg/, `<svg fill="${colour}"`);
  return sharp(Buffer.from(svg), { density: 900 }).resize({ width: widthPx }).png().toBuffer();
}

/** A text lockup set in one voice, per the brand rules. */
async function textPng(lines, colour, widthPx) {
  const W = 2400;
  let y = 0;
  const parts = [];
  for (const l of lines) {
    y += l.size * 1.15;
    parts.push(
      `<text x="${W / 2}" y="${y.toFixed(0)}" font-family="${BRAND.sans}" font-weight="${l.weight}" ` +
        `font-size="${l.size}" fill="${colour}" letter-spacing="${(l.size * l.track).toFixed(1)}" ` +
        `text-anchor="middle">${esc(l.text)}</text>`,
    );
    y += l.gap ?? 0;
  }
  const H = Math.ceil(y + 40);
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
  return sharp(Buffer.from(svg), { density: 300 })
    .trim()
    .resize({ width: widthPx })
    .png()
    .toBuffer();
}

/* ------------------------------------------------------------------ run */

const out = args.out || path.join(process.env.HOME, "Documents/Loop-soul-the-entertainment-room/tapstitch-2026-08");
const report = [];

for (const [name, colour] of Object.entries(COLOURWAYS)) {
  const dir = path.join(out, name);
  await fs.mkdir(dir, { recursive: true });

  // Figures — raster sources, so honour their true resolution ceiling.
  for (const fig of FIGURES) {
    const src = await fs.readFile(path.join(ROOT, "public/loop/figures", `${fig}.png`));
    const tinted = await recolour(src, colour.rgb);
    for (const [pname, place] of Object.entries(PLACEMENTS)) {
      const fit = await fitToPrint(tinted, place);
      const file = `${fig}-${pname}.png`;
      await fs.writeFile(path.join(dir, file), fit.buf);
      if (name === "ink") {
        report.push({ asset: fig, placement: pname, ...fit.inches, capped: fit.capped });
      }
    }
  }

  // Wordmark — vector source, so it can be generated at any size cleanly.
  for (const [pname, place] of Object.entries(PLACEMENTS)) {
    const buf = await wordmarkPng(colour.hex, px(place.w));
    const fit = await fitToPrint(buf, place);
    await fs.writeFile(path.join(dir, `wordmark-${pname}.png`), fit.buf);
    if (name === "ink") report.push({ asset: "wordmark", placement: pname, ...fit.inches, capped: false });
  }

  // Slogan and the full stacked lockup.
  const slogan = await textPng([{ text: BRAND.slogan, size: 120, weight: 700, track: 0.02 }], colour.hex, px(PLACEMENTS.full.w));
  await fs.writeFile(path.join(dir, "slogan-full.png"), await (await fitToPrint(slogan, PLACEMENTS.full)).buf);

  const triad = await textPng([{ text: BRAND.triad, size: 60, weight: 600, track: 0.4 }], colour.hex, px(PLACEMENTS.chest.w));
  await fs.writeFile(path.join(dir, "triad-chest.png"), await (await fitToPrint(triad, PLACEMENTS.chest)).buf);

  // Wordmark above slogan above triad — the piece that reads as the brand.
  const wm = await wordmarkPng(colour.hex, 1200);
  const wmMeta = await sharp(wm).metadata();
  const type = await textPng(
    [
      { text: BRAND.slogan, size: 120, weight: 700, track: 0.02, gap: 40 },
      { text: BRAND.triad, size: 46, weight: 600, track: 0.4 },
    ],
    colour.hex,
    1600,
  );
  const typeMeta = await sharp(type).metadata();
  const lockW = Math.max(wmMeta.width, typeMeta.width);
  const gap = 90;
  const lockH = wmMeta.height + gap + typeMeta.height;
  const lockup = await sharp({
    create: { width: lockW, height: lockH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: wm, left: Math.round((lockW - wmMeta.width) / 2), top: 0 },
      { input: type, left: Math.round((lockW - typeMeta.width) / 2), top: wmMeta.height + gap },
    ])
    .png()
    .toBuffer();
  await fs.writeFile(path.join(dir, "lockup-full.png"), (await fitToPrint(lockup, PLACEMENTS.full)).buf);

  console.log(`${name.padEnd(5)} → ${dir}`);
}

// Vector, for embroidery and anything that needs to scale.
const vec = path.join(out, "vector");
await fs.mkdir(vec, { recursive: true });
await fs.copyFile(
  path.join(ROOT, "public/loop/branding/loop-soul.svg"),
  path.join(vec, "loop-soul-wordmark.svg"),
);

/**
 * Print-size ceilings, at both standards that matter.
 *
 * 300 DPI is the ideal and what a printer will ask for. 150 DPI is the
 * practical floor for direct-to-garment on cotton — the ink spreads into the
 * weave, so garment printing tolerates roughly half what paper does. Reporting
 * only the 300 number would say "these can't be a front print" when they can;
 * reporting only 150 would invite a soft print on a shirt someone paid for.
 */
console.log("\nMax print size — do NOT scale beyond these:\n");
console.log("  asset       @300 DPI (ideal)      @150 DPI (DTG floor)");
for (const r of report.filter((r) => r.placement === "full")) {
  const at150 = `${(r.w * 2).toFixed(1)}" × ${(r.h * 2).toFixed(1)}"`;
  console.log(
    `  ${r.asset.padEnd(11)} ${`${r.w}" × ${r.h}"`.padEnd(21)} ${r.capped ? at150 : "vector — any size"}`,
  );
}
console.log("\nout:", out);
