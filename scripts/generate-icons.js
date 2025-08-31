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

async function run() {
  if (!fs.existsSync(input)) {
    console.error('Source image not found:', input);
    process.exit(1);
  }

  for (const s of sizes) {
    const outFile = path.join(out, `favicon-${s}x${s}.png`);
    await sharp(input).resize(s, s).png({ quality: 90 }).toFile(outFile);
    console.log('Wrote', outFile);
  }

  // Create ico (contains 16,32,48) - prefer png-to-ico when available
  const icoOut = path.join(out, 'favicon.ico');

  try {
    // Dynamically import png-to-ico if the user has installed it
    const pngToIco = (await import('png-to-ico')).default;

    const buf16 = await sharp(input).resize(16, 16).png().toBuffer();
    const buf32 = await sharp(input).resize(32, 32).png().toBuffer();
    const buf48 = await sharp(input).resize(48, 48).png().toBuffer();

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
