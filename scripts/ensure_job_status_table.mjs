#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
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
      value = value.replace(/\$\{([^}]+)\}/g, (_, k) => process.env[k] || '');
      process.env[key] = value;
    }
  } catch {}
}
loadEnvInline(ENV_PATH);

const BASE_URL = (process.env.CLOUDFLARE_D1_API_URL || process.env.DATABASE_URL || '').replace(/\/$/, '');
const API_TOKEN = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
if (!BASE_URL || !API_TOKEN) {
  console.error('Missing DATABASE_URL/CLOUDFLARE_D1_API_URL or API token');
  process.exit(1);
}

async function run(sql) {
  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: [] })
  });
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  if (!res.ok || json.success === false) {
    console.error('Query error:', JSON.stringify(json));
    process.exit(1);
  }
  return json;
}

const CREATE = `CREATE TABLE IF NOT EXISTS job_status (
  jobId TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  videoId INTEGER,
  cfVideoId TEXT,
  errorDetails TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);`;
const INDEX = `CREATE INDEX IF NOT EXISTS idx_job_status_video ON job_status(videoId);`;

const main = async () => {
  console.log('Ensuring job_status table exists...');
  await run(CREATE);
  await run(INDEX);
  console.log('✅ job_status ready');
};

main().catch(e => { console.error(e); process.exit(1); });
