import { NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { verifyUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';

type Step = { name: string; sql: string };

function steps(): Step[] {
  return [
    {
      name: 'create_galleries',
      sql: `CREATE TABLE IF NOT EXISTS galleries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT 'Moments',
        description TEXT,
        created_by TEXT,
        starts_at TEXT,
        ends_at TEXT,
        config TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`
    },
    { name: 'index_galleries_code', sql: `CREATE INDEX IF NOT EXISTS idx_galleries_code ON galleries(code);` },
    { name: 'index_galleries_created_by', sql: `CREATE INDEX IF NOT EXISTS idx_galleries_created_by ON galleries(created_by);` },
    {
      name: 'create_gallery_photos',
      sql: `CREATE TABLE IF NOT EXISTS gallery_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gallery_id INTEGER NOT NULL,
        uid TEXT NOT NULL,
        r2_key TEXT NOT NULL,
        thumbnail_key TEXT,
        original_filename TEXT,
        user_name TEXT,
        moderated INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
      );`
    },
    { name: 'index_gallery_photos_gallery_id', sql: `CREATE INDEX IF NOT EXISTS idx_gallery_photos_gallery_id ON gallery_photos(gallery_id);` },
    { name: 'index_gallery_photos_uid', sql: `CREATE INDEX IF NOT EXISTS idx_gallery_photos_uid ON gallery_photos(uid);` },
    { name: 'add_media_type', sql: `ALTER TABLE gallery_photos ADD COLUMN media_type TEXT;` },
    { name: 'add_moderated_at', sql: `ALTER TABLE gallery_photos ADD COLUMN moderated_at TEXT;` },
    { name: 'add_moderated_by', sql: `ALTER TABLE gallery_photos ADD COLUMN moderated_by TEXT;` },
    { name: 'index_gallery_photos_moderated', sql: `CREATE INDEX IF NOT EXISTS idx_gallery_photos_moderated ON gallery_photos(moderated);` },
    {
      name: 'create_events',
      sql: `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        location TEXT,
        starts_at TEXT NOT NULL,
        ends_at TEXT,
        capacity INTEGER,
        ticket_price REAL DEFAULT 0,
        is_public BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );`
    },
    { name: 'index_events_created_by', sql: `CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);` },
    { name: 'index_events_status', sql: `CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);` },
    { name: 'index_events_starts_at', sql: `CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);` },
    { name: 'index_events_is_public', sql: `CREATE INDEX IF NOT EXISTS idx_events_is_public ON events(is_public);` },
  ];
}

export async function POST(req: Request) {
  const user = await verifyUserFromRequest(req as any);
  // Bootstrap: if galleries table doesn't exist yet, allow any authenticated user to run once
  let bootstrapAllowed = false;
  try {
    const rows = await queryDatabase(`SELECT name FROM sqlite_master WHERE type='table' AND name='galleries' LIMIT 1`);
    bootstrapAllowed = !rows || rows.length === 0;
  } catch {
    // If query fails, do not bootstrap-open; keep admin requirement
  }
  const allowed = bootstrapAllowed || isAdminUser(user) || await userHasAnyRole(req as any, ['admin']);
  if (!user || !allowed) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const applied: { name: string; ok: boolean; error?: string }[] = [];
  for (const s of steps()) {
    try {
      await executeQuery(s.sql, []);
      applied.push({ name: s.name, ok: true });
    } catch (e: any) {
      const msg = String(e?.message || 'error');
      // Ignore benign errors when ALTER column already exists
      if (/duplicate column|already exists/i.test(msg)) {
        applied.push({ name: s.name, ok: true });
        continue;
      }
      applied.push({ name: s.name, ok: false, error: msg });
    }
  }
  const ok = applied.every((a) => a.ok);
  return NextResponse.json({ ok, applied });
}
