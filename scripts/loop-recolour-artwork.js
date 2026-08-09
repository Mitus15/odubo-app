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
const sharp = require("sharp");

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

  let lo = 1, hi = 0;
  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] < 40) continue;
    const L = lum(data[i], data[i + 1], data[i + 2]);
    if (L < lo) lo = L;
    if (L > hi) hi = L;
  }
  const span = Math.max(hi - lo, 1e-6);

  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] < 8) continue;
    const t = Math.min(1, Math.max(0, (lum(data[i], data[i + 1], data[i + 2]) - lo) / span));
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(INK[c] + (SAND[c] - INK[c]) * t);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: C } }).png().toFile(outPath);
  return `${info.width}x${info.height}`;
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

(async () => {
  const dst = process.argv[2] || 'public/loop';
  for (const n of ["dance", "fashion", "listen", "play", "spin"]) {
    console.log("poster", n, await duotone(`public/loop/posters/${n}.png`, `${dst}/posters/${n}.png`));
  }
  for (const n of ["dance", "listen", "spin"]) {
    console.log("figure", n, await warmDarks(`public/loop/figures/${n}.png`, `${dst}/figures/${n}.png`));
  }
})();
