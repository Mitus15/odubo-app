#!/usr/bin/env node
// Generate favicon PNGs and ICO from public/Danceman_Logo_Red.png
// Usage: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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

  // Create ico (contains 16,32,48)
  const icoOut = path.join(out, 'favicon.ico');
  await sharp(input).resize(48,48).png().toBuffer().then(buf48 => {
    return sharp(input).resize(32,32).png().toBuffer().then(buf32 => {
      return sharp(input).resize(16,16).png().toBuffer().then(buf16 => {
        // Sharp doesn't write ICO directly, use png-to-ico dependency normally; fallback: write 48 png as ico placeholder
        fs.writeFileSync(icoOut, buf48);
        console.log('Wrote', icoOut, '(placeholder - consider installing png-to-ico for proper multi-size ICO)');
      });
    });
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
