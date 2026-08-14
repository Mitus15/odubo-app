/**
 * Generate the committed font-metrics table from the shipped Jost TTFs.
 *
 *   node scripts/loop/gen-font-metrics.mjs
 *
 * Writes src/lib/loop/poster/font-metrics.ts — per-character advance widths
 * (fraction of an em) for each shipped weight, plus the cap-height ratio.
 *
 * Why a committed table instead of measuring at runtime: the poster layout
 * sizes its lines FROM the measure (`fitSize`), so whatever measures the text
 * decides the point size. If the browser measured with ctx.measureText and
 * Node measured with a heuristic, the same poster would render at two
 * different slogan sizes — divergence smuggled back in through measurement.
 * One deterministic table, generated from the one committed font, read by
 * both runtimes, ends that argument. Re-run this script only when the font
 * files change (e.g. a licensed Futura swap).
 */
import opentype from "opentype.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const WEIGHTS = {
  500: "public/loop/fonts/Jost-500.ttf",
  700: "public/loop/fonts/Jost-700.ttf",
};

// Every character the brand system sets, plus full printable ASCII so an
// arbitrary tagline or track title measures correctly. Unknowns at runtime
// fall back to the widest advance in the table (safe over-estimate).
const CHARS =
  " !\"#$%&'()*+,-./0123456789:;<=>?@" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" +
  "abcdefghijklmnopqrstuvwxyz{|}~" +
  "·—–’‘“”×∞é";

const out = { capHeight: 0, weights: {} };

for (const [weight, rel] of Object.entries(WEIGHTS)) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const upm = font.unitsPerEm;
  out.capHeight = (font.tables.os2?.sCapHeight ?? upm * 0.7) / upm;

  const adv = {};
  for (const ch of CHARS) {
    const glyph = font.charToGlyph(ch);
    // .notdef comes back for unmapped chars — skip so runtime falls back to max.
    if (glyph.index === 0) continue;
    adv[ch] = +(glyph.advanceWidth / upm).toFixed(4);
  }
  out.weights[weight] = adv;
}

const ts = `/**
 * GENERATED — do not edit by hand. Run: node scripts/loop/gen-font-metrics.mjs
 *
 * Per-character advance widths (fraction of an em) for the shipped Jost
 * weights, plus the cap-height ratio. This table IS the measurement contract
 * both poster renderers share — see scripts/loop/gen-font-metrics.mjs for why.
 */
export const FONT_METRICS = ${JSON.stringify(out, null, 2)} as const;
`;

const dest = path.join(ROOT, "src/lib/loop/poster/font-metrics.ts");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, ts);
console.log("→", dest, `(${Object.keys(out.weights).length} weights, capHeight ${out.capHeight})`);
