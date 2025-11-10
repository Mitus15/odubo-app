#!/usr/bin/env node
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read DATABASE_URL and token from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const dbUrl = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const apiToken = env.match(/CLOUDFLARE_D1_API_TOKEN=(.+)/)?.[1]?.trim() || 
                 env.match(/CLOUDFLARE_API_TOKEN=(.+)/)?.[1]?.trim();

if (!dbUrl || !apiToken) {
  console.error('Missing DATABASE_URL or API token in .env.local');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

async function ensureMigrationsTable() {
  const sql = `CREATE TABLE IF NOT EXISTS migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )`;
  
  const res = await fetch(`${dbUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ sql, params: [] })
  });
  
  const data = await res.json();
  if (!res.ok || !data.success) {
    console.error('Failed to create migrations table:', data);
  }
}

async function getAppliedMigrations() {
  const res = await fetch(`${dbUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ sql: 'SELECT id FROM migrations ORDER BY id ASC', params: [] })
  });
  
  const data = await res.json();
  if (!res.ok || !data.result) return [];
  return (data.result[0]?.results || []).map(r => r.id);
}

async function applyMigration(file, sql) {
  console.log(`Applying ${file}...`);
  
  // Apply the migration SQL
  const res = await fetch(`${dbUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ sql, params: [] })
  });
  
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(`Migration failed: ${JSON.stringify(data)}`);
  }
  
  // Record it
  const recordRes = await fetch(`${dbUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ 
      sql: 'INSERT INTO migrations (id) VALUES (?)', 
      params: [file] 
    })
  });
  
  const recordData = await recordRes.json();
  if (!recordRes.ok || recordData.success === false) {
    throw new Error(`Failed to record migration: ${JSON.stringify(recordData)}`);
  }
  
  console.log(`✅ ${file} applied`);
}

async function run() {
  await ensureMigrationsTable();
  
  const applied = await getAppliedMigrations();
  console.log(`Applied migrations: ${applied.length}`);
  
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.disabled'))
    .sort();
  
  const pending = files.filter(f => !applied.includes(f));
  console.log(`Pending migrations: ${pending.length}`);
  
  for (const file of pending) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    
    try {
      await applyMigration(file, sql);
    } catch (e) {
      console.error(`❌ ${file} failed:`, e.message);
      break;
    }
  }
  
  console.log('✅ All migrations completed.');
}

run().catch(e => {
  console.error('Migration error:', e);
  process.exit(1);
});
