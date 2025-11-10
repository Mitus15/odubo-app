#!/usr/bin/env node
/*
 Apply Cloudflare D1 migrations via the D1 REST API (no wrangler).

 Reads .env.local for:
  - CLOUDFLARE_ACCOUNT_ID
  - CLOUDFLARE_D1_DATABASE_ID
  - CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN (Bearer)
  - CLOUDFLARE_D1_API_URL or DATABASE_URL (base URL, e.g., https://api.cloudflare.com/client/v4/accounts/.../d1/database/<id>)

 Tracks applied migrations in a table named `odubo_migrations`.
 Executes each .sql file in ./database/migrations in lexicographical order if not yet applied.
*/

import fs from 'fs';
import path from 'path';
import process from 'process';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(ROOT, 'database', 'migrations');

function loadEnvInline(filePath) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    for (const lineRaw of txt.split(/\r?\n/)) {
      const line = lineRaw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      // Basic ${VAR} substitution using existing env or parsed values
      value = value.replace(/\$\{([^}]+)\}/g, (_, k) => process.env[k] || '');
      process.env[key] = value;
    }
  } catch (e) {
    // ignore if missing
  }
}

// Load .env.local if present
loadEnvInline(ENV_PATH);

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '';
const DB_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '';
const API_TOKEN = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_GLOBAL_API_TOKEN || '';
const BASE_URL = (process.env.CLOUDFLARE_D1_API_URL || process.env.DATABASE_URL || '').replace(/\/$/, '');

if (!ACCOUNT_ID || !DB_ID || !API_TOKEN) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, or an API token (CLOUDFLARE_D1_API_TOKEN/CLOUDFLARE_API_TOKEN).');
  process.exit(1);
}
if (!BASE_URL) {
  console.error('Missing CLOUDFLARE_D1_API_URL or DATABASE_URL for the D1 REST endpoint base.');
  process.exit(1);
}

const QUERY_URL = `${BASE_URL}/query`;

async function runQuery(sql, params = []) {
  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg = json?.errors?.map(e => e.message).join('; ') || json?.error || res.statusText;
    throw new Error(`D1 query error: ${msg}\nSQL: ${sql.slice(0, 200)}...`);
  }
  return json;
}

async function ensureMigrationsTable() {
  await runQuery(
    `CREATE TABLE IF NOT EXISTS odubo_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`
  );
}

async function isApplied(name) {
  const out = await runQuery('SELECT 1 FROM odubo_migrations WHERE name = ? LIMIT 1', [name]);
  const rows = out?.result || out?.results || out?.result?.results || [];
  return Array.isArray(rows) && rows.length > 0;
}

function splitSqlStatements(content) {
  // Very simple splitter: splits on semicolons at line end. This will work for our schema/migrations style.
  const cleaned = content
    .replace(/^\uFEFF/, '') // strip BOM
    .replace(/\r\n/g, '\n');
  const parts = cleaned
    .split(/;\s*(?:\n|$)/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts;
}

async function applyMigration(filePath) {
  const name = path.basename(filePath);
  const sqlText = fs.readFileSync(filePath, 'utf8');
  const statements = splitSqlStatements(sqlText);
  if (statements.length === 0) {
    console.log(`- ${name}: empty, skipping`);
    return;
  }

  console.log(`- Applying ${name} (${statements.length} statements)`);
  for (const stmt of statements) {
    await runQuery(stmt);
  }
  await runQuery('INSERT OR IGNORE INTO odubo_migrations(name) VALUES (?)', [name]);
  console.log(`  ✓ ${name} applied`);
}

(async () => {
  console.log('D1 API migration runner');
  console.log(`  Account: ${ACCOUNT_ID}`);
  console.log(`  DB:      ${DB_ID}`);
  console.log(`  URL:     ${QUERY_URL}`);
  console.log(`  Dir:     ${MIGRATIONS_DIR}`);

  await ensureMigrationsTable();

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const f of files) {
    const full = path.join(MIGRATIONS_DIR, f);
    const applied = await isApplied(f).catch(() => false);
    if (applied) {
      console.log(`- ${f}: already applied`);
      continue;
    }
    await applyMigration(full);
  }

  console.log('✅ All migrations completed');
})().catch(err => {
  console.error('❌ Migration run failed:', err.message);
  process.exit(1);
});
