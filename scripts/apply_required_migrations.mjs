// Apply minimal required D1 migrations via HTTP API using DATABASE_URL and CLOUDFLARE_D1_API_TOKEN
// - 003_add_is_admin_to_users.sql
// - 019_add_audit_logs.sql

import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
const D1_TOKEN = process.env.CLOUDFLARE_D1_API_TOKEN;

if (!DATABASE_URL || !D1_TOKEN) {
  console.error('Missing DATABASE_URL or CLOUDFLARE_D1_API_TOKEN env. Check .env.local');
  process.exit(1);
}

async function runStatement(sql, params = []) {
  const res = await fetch(`${DATABASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${D1_TOKEN}`
    },
    body: JSON.stringify({ sql, params })
  });
  const data = await res.json().catch(async () => ({ raw: await res.text() }));
  if (!res.ok || data.success === false) {
    const msg = JSON.stringify(data);
    throw new Error(`D1 error for SQL: ${sql.slice(0,80)}... -> ${msg}`);
  }
  return data;
}

function splitStatements(sqlText) {
  // Remove transaction wrappers that D1 HTTP API doesn't support
  const cleaned = sqlText
    .replace(/BEGIN\s+TRANSACTION;?/gi, '')
    .replace(/COMMIT;?/gi, '')
    .replace(/ROLLBACK;?/gi, '');
  
  // Simple split on semicolons; ignore empty fragments
  return cleaned
    .split(/;\s*\n|;\s*$/gm)
    .map(s => s.trim())
    .filter(Boolean);
}

async function applyFile(relativePath) {
  const full = path.resolve(__dirname, '..', relativePath);
  const content = await fs.readFile(full, 'utf8');
  const statements = splitStatements(content);
  console.log(`Applying ${relativePath} (${statements.length} statements)...`);
  for (const stmt of statements) {
    // Skip pure comments
    const noComments = stmt.replace(/^--.*$/gm, '').trim();
    if (!noComments) continue;
    try {
      await runStatement(noComments);
    } catch (err) {
      const em = String(err?.message || err);
      // Ignore benign duplicates
      if (/duplicate column name|already exists/i.test(em)) {
        console.log('   (skip) duplicate/exists:', noComments.slice(0, 60), '...');
        continue;
      }
      throw err;
    }
  }
  console.log(`✔ Applied ${relativePath}`);
}

async function main() {
  try {
    await applyFile('database/migrations/003_add_is_admin_to_users.sql');
    await applyFile('database/migrations/019_add_audit_logs.sql');
    await applyFile('database/migrations/020_add_events_table.sql');
  await applyFile('database/migrations/022_create_featured_pages.sql');
    // Ensure optional featured extras are present
    try { await applyFile('database/migrations/023_add_is_active_to_featured.sql'); } catch {}
    try { await applyFile('database/migrations/024_enforce_single_featured.sql'); } catch {}
    try { await applyFile('database/migrations/024_create_featured_single.sql'); } catch {}
    try { await applyFile('database/migrations/029_add_time_text_to_featured.sql'); } catch {}
    // New: video thumbnail timestamp pct
    await applyFile('database/migrations/021_add_video_thumbnail_pct.sql');
    // Verify
    const pragma = await runStatement('PRAGMA table_info(users)');
    const cols = pragma?.result?.[0]?.results || [];
    const hasIsAdmin = cols.some(c => (c.name || c.column_name) === 'is_admin');
    console.log('users columns:', cols.map(c => c.name || c.column_name));
    console.log('is_admin present:', hasIsAdmin);

    const auditCheck = await runStatement("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'");
    const hasAudit = !!(auditCheck?.result?.[0]?.results?.length);
    console.log('audit_logs present:', hasAudit);
  } catch (err) {
    console.error('Migration apply failed:', err);
    process.exit(1);
  }
}

main();
