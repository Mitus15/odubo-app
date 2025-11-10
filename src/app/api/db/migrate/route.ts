import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import path from 'path';
import fs from 'fs/promises';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

function getMigrationsDir() {
  const root = process.cwd();
  return path.join(root, 'database', 'migrations');
}

async function ensureMigrationsTable() {
  try {
    await executeQuery(`CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch (e) {
    // ignore, may already exist
  }
}

async function listLocalMigrations() {
  const dir = getMigrationsDir();
  const entries = await fs.readdir(dir);
  const sqlFiles = entries
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.disabled'))
    .sort();
  return sqlFiles;
}

async function listAppliedMigrations(): Promise<string[]> {
  try {
    const rows = await queryDatabase(`SELECT id FROM migrations ORDER BY id ASC`);
    return rows.map((r: any) => String(r.id));
  } catch (e: any) {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
  }

  try {
    await ensureMigrationsTable();
    const local = await listLocalMigrations();
    const applied = await listAppliedMigrations();
    const pending = local.filter((f) => !applied.includes(f));

    const results: { id: string; status: 'applied' | 'skipped' | 'failed'; error?: string }[] = [];
    for (const file of pending) {
      const full = path.join(getMigrationsDir(), file);
      const sql = await fs.readFile(full, 'utf8');
      try {
        // Apply the migration
        await executeQuery(sql);
        // Record it
        await executeQuery(`INSERT INTO migrations (id) VALUES (?)`, [file]);
        results.push({ id: file, status: 'applied' });
      } catch (e: any) {
        results.push({ id: file, status: 'failed', error: e?.message || String(e) });
        // Stop on first failure to avoid partials depending on order
        break;
      }
    }

    const appliedNow = results.filter(r => r.status === 'applied').map(r => r.id);
    const stillPending = local.filter((f) => ![...applied, ...appliedNow].includes(f));
    return NextResponse.json({ ok: true, results, summary: { appliedNow, stillPending } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
