#!/usr/bin/env node
// Generate favicon PNGs and ICO from public/Danceman_Logo_Red.png
// Usage: npm run generate-icons

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const input = path.join(__dirname, '..', 'public', 'Danceman_Logo_Red.png');
const out = path.join(__dirname, '..', 'public');
const sizes = [16, 32, 48, 180, 192, 512];
const PADDING_RATIO = 0.16; // a bit more padding to avoid edge cropping
const VERTICAL_NUDGE_RATIO = 0.08; // stronger downward nudge to avoid top crop

async function run() {
  if (!fs.existsSync(input)) {
    console.error('Source image not found:', input);
    process.exit(1);
  }

  const trimmed = sharp(input).trim(); // remove transparent/solid margins first

  for (const s of sizes) {
    // Create a square canvas; scale the logo to "cover" to avoid side bars, then nudge down a bit
    const inner = Math.max(1, Math.round(s * (1 - PADDING_RATIO)));
    const outFile = path.join(out, `favicon-${s}x${s}.png`);
    const base = sharp({ create: { width: s, height: s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
    const logo = await trimmed.clone().resize(inner, inner, { fit: 'cover' }).png().toBuffer();
    const left = Math.max(0, Math.round((s - inner) / 2));
    const maxTop = Math.max(0, s - inner);
    const nudge = Math.round(s * VERTICAL_NUDGE_RATIO);
    const top = Math.min(maxTop, Math.max(0, Math.round((s - inner) / 2 + nudge)));
    await base.composite([{ input: logo, left, top }]).png({ quality: 90 }).toFile(outFile);
    console.log('Wrote', outFile);
  }

  // Create ico (contains 16,32,48) - prefer png-to-ico when available
  const icoOut = path.join(out, 'favicon.ico');

  try {
    // Dynamically import png-to-ico if the user has installed it
    const pngToIco = (await import('png-to-ico')).default;

    const buf16 = await sharp(path.join(out, 'favicon-16x16.png')).toBuffer();
    const buf32 = await sharp(path.join(out, 'favicon-32x32.png')).toBuffer();
    const buf48 = await sharp(path.join(out, 'favicon-48x48.png')).toBuffer();

    const icoBuf = await pngToIco([buf16, buf32, buf48]);
    await fs.promises.writeFile(icoOut, icoBuf);
    console.log('Wrote', icoOut, '(multi-size ICO via png-to-ico)');
  } catch (err) {
    // Fallback: write 48px PNG as placeholder .ico
    const buf48 = await sharp(input).resize(48, 48).png().toBuffer();
    await fs.promises.writeFile(icoOut, buf48);
    console.log('Wrote', icoOut, '(placeholder - install png-to-ico for proper multi-size ICO)');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
