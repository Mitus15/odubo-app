import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import path from 'path';
import fs from 'fs/promises';
import { queryDatabase } from '@/lib/db';

function getMigrationsDir() {
  // Workspace root
  const root = process.cwd();
  return path.join(root, 'database', 'migrations');
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
    // If table doesn't exist, treat as none applied
    return [];
  }
}

export async function GET(_req: NextRequest) {
  try {
    const local = await listLocalMigrations();
    const applied = await listAppliedMigrations();
    const pending = local.filter((f) => !applied.includes(f));
    return NextResponse.json({ ok: true, local, applied, pending, count: { local: local.length, applied: applied.length, pending: pending.length } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
