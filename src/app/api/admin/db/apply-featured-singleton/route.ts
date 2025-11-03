import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';

function shouldIgnore(msg: string) {
  const patterns = [/duplicate column/i, /already exists/i, /duplicate/i, /incomplete input/i];
  return patterns.some((rx) => rx.test(msg));
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const steps: { label: string; sql: string }[] = [
    {
      label: 'Create featured_pages table (022)',
      sql: `
CREATE TABLE IF NOT EXISTS featured_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  date_text TEXT,
  venue TEXT,
  album_link TEXT,
  moments_link TEXT,
  cover_image_url TEXT,
  background_video_url TEXT,
  extra_links_json TEXT,
  is_published INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_featured_pages_slug ON featured_pages(slug);
CREATE INDEX IF NOT EXISTS idx_featured_pages_published ON featured_pages(is_published);
      `.trim(),
    },
    {
      label: 'Optional is_active + unique partial index (023)',
      sql: `
ALTER TABLE featured_pages ADD COLUMN is_active INTEGER DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_active_unique ON featured_pages(is_active) WHERE is_active = 1;
      `.trim(),
    },
    {
      label: 'Enforce single row trigger (024)',
      sql: `
CREATE TRIGGER IF NOT EXISTS trg_featured_pages_singleton
BEFORE INSERT ON featured_pages
BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM featured_pages) >= 1 THEN RAISE(ABORT, 'only one featured row allowed') END;
END;
      `.trim(),
    },
    {
      label: 'Seed default row',
      sql: `
INSERT OR IGNORE INTO featured_pages (slug, title, is_published, created_at, updated_at)
VALUES ('featured', 'Featured', 1, datetime('now'), datetime('now'));
      `.trim(),
    },
  ];

  const results: any[] = [];
  for (const s of steps) {
    try {
      const res = await executeQuery(s.sql, []);
      results.push({ label: s.label, ok: true, res });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (shouldIgnore(msg)) {
        results.push({ label: s.label, ok: true, ignored: true, message: msg });
      } else {
        results.push({ label: s.label, ok: false, error: msg });
      }
    }
  }

  return NextResponse.json({ success: true, results });
}
