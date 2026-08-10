/**
 * Recolour the Loop Soul artwork from the electric-green identity to the house
 * palette. Two treatments, because the assets are two different kinds of thing:
 *
 *  - posters/*  full poster prints with the green field baked in. Duotone,
 *    normalised so the field (brightest) lands on sand and the silhouettes
 *    (darkest) land on ink. Preserves every tonal relationship in between.
 *  - figures/*  transparent cut-out silhouettes whose shadows carry a green
 *    tint. These must STAY dark, so no normalisation — just rotate the hue of
 *    the darks from green-dominant to warm oxblood-dominant.
 *
 * Run once, already applied: `node scripts/loop-recolour-artwork.js`. Kept in
 * the repo so the transform is auditable and re-runnable against the original
 * green artwork in git history — it is lossy and not reversible in place.
 */
import sharp from "sharp";

const INK = [42, 15, 10]; // #2a0f0a
const SAND = [217, 170, 122]; // #d9aa7a

const srgbToLin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = (r, g, b) =>
  0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);

async function duotone(inPath, outPath) {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const C = info.channels;

  // Anchor on the FIELD, not on each image's own min/max. The posters were
  // printed at slightly different densities, so per-image normalisation gave
  // every poster a different ground — one bright sand, the next muddy brown.
  // The field is by far the most common colour, so the modal bucket finds it,
  // and pinning that one luminance to sand makes the whole set share a ground.
  const buckets = new Map();
  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] < 40) continue;
    const k = `${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  const [mr, mg, mb] = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0][0]
    .split(",")
    .map((v) => v * 8 + 4);
  const field = Math.max(lum(mr, mg, mb), 1e-6);

  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] < 8) continue;
    const t = Math.min(1, lum(data[i], data[i + 1], data[i + 2]) / field);
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(INK[c] + (SAND[c] - INK[c]) * t);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: C } }).png().toFile(outPath);
  return `${info.width}x${info.height} field=#${[mr, mg, mb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

async function warmDarks(inPath, outPath) {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const C = info.channels;
  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] < 8) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Green carries the tone in the source, so it becomes the red channel;
    // the rest is damped to keep the result a warm brown rather than magenta.
    data[i] = Math.min(255, Math.round(g));
    data[i + 1] = Math.min(255, Math.round(r * 0.55 + b * 0.2));
    data[i + 2] = Math.min(255, Math.round(b * 0.5));
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: C } }).png().toFile(outPath);
  return `${info.width}x${info.height}`;
}

// Usage: node scripts/loop-recolour-artwork.js [srcDir] [dstDir]
// Both default to public/loop. Pass a srcDir holding the ORIGINAL green artwork
// (recoverable from git history) when re-running — the transform is lossy, so
// running it twice over its own output compounds the shift.
(async () => {
  const src = process.argv[2] || "public/loop";
  const dst = process.argv[3] || src;
  for (const n of ["dance", "fashion", "listen", "play", "spin"]) {
    console.log("poster", n, await duotone(`${src}/posters/${n}.png`, `${dst}/posters/${n}.png`));
  }
  for (const n of ["dance", "listen", "spin"]) {
    console.log("figure", n, await warmDarks(`${src}/figures/${n}.png`, `${dst}/figures/${n}.png`));
  }
})();
