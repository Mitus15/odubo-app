#!/usr/bin/env node
/**
 * Download the FULL KJV Bible and extract Psalms & Proverbs.
 * 
 * Source: github.com/thiagobodruk/bible — pre-parsed KJV JSON
 * License: Public domain (KJV is public domain worldwide)
 * 
 * Usage: node scripts/download_bible.mjs
 * 
 * This creates:
 *   data/en_kjv.json          — Full KJV Bible (all 66 books)
 *   data/bible-psalms-proverbs.json — Just Psalms & Proverbs (381 KB)
 * 
 * The verse picker reads from bible-psalms-proverbs.json at runtime.
 * No AI, no API calls during runtime — just a local file lookup.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log('📖 Downloading KJV Bible from github.com/thiagobodruk/bible...\n');

  // Download the full KJV Bible JSON
  const url = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
  const fullPath = path.join(DATA_DIR, 'en_kjv.json');
  
  console.log(`⬇️  Downloading full KJV Bible (66 books)...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(fullPath, buffer);
  const fullSize = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`✅ Downloaded: en_kjv.json (${fullSize} MB)`);

  // Parse and extract Psalms & Proverbs
  console.log(`\n📚 Extracting Psalms & Proverbs...`);
  const bible = JSON.parse(buffer.toString('utf-8'));
  
  const psalmsProverbs = bible.filter(b => 
    b.name === 'Psalms' || b.name === 'Proverbs'
  );

  const extractPath = path.join(DATA_DIR, 'bible-psalms-proverbs.json');
  fs.writeFileSync(extractPath, JSON.stringify(psalmsProverbs, null, 2));
  const extractSize = (fs.statSync(extractPath).size / 1024).toFixed(0);

  // Count verses
  let totalVerses = 0;
  for (const book of psalmsProverbs) {
    let bookVerses = 0;
    for (const chapter of book.chapters) {
      bookVerses += chapter.length;
    }
    totalVerses += bookVerses;
    console.log(`   ${book.name}: ${book.chapters.length} chapters, ${bookVerses} verses`);
  }

  console.log(`\n🎉 Done!`);
  console.log(`   📁 data/bible-psalms-proverbs.json (${extractSize} KB, ${totalVerses} verses)`);
  console.log(`   📁 data/en_kjv.json (${fullSize} MB, full Bible)`);
  console.log(`\n   The verse picker reads bible-psalms-proverbs.json at runtime.`);
  console.log(`   No AI, no API calls — just a local file.`);
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
