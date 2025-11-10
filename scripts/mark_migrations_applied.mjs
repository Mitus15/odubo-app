#!/usr/bin/env node
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const dbUrl = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const apiToken = env.match(/CLOUDFLARE_D1_API_TOKEN=(.+)/)?.[1]?.trim() || 
                 env.match(/CLOUDFLARE_API_TOKEN=(.+)/)?.[1]?.trim();

if (!dbUrl || !apiToken) {
  console.error('Missing DATABASE_URL or API token');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

async function markAsApplied(file) {
  const res = await fetch(`${dbUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ 
      sql: 'INSERT OR IGNORE INTO migrations (id) VALUES (?)', 
      params: [file] 
    })
  });
  
  const data = await res.json();
  if (!res.ok || data.success === false) {
    console.error(`Failed to mark ${file}:`, data);
  } else {
    console.log(`✅ Marked ${file} as applied`);
  }
}

async function run() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.disabled'))
    .sort();
  
  // Mark migrations 001-029 as applied
  const toMark = files.filter(f => {
    const num = parseInt(f.match(/^(\d+)/)?.[1] || '0');
    return num < 30;
  });
  
  console.log(`Marking ${toMark.length} existing migrations as applied...`);
  
  for (const file of toMark) {
    await markAsApplied(file);
  }
  
  console.log('✅ Done. Now run the main migration script.');
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
