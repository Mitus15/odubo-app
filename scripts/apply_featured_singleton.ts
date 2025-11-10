#!/usr/bin/env tsx
/*
  Apply Featured singleton D1 changes via HTTP API using env vars.
  Requires:
    - DATABASE_URL (e.g., https://api.cloudflare.com/client/v4/accounts/<acct>/d1/database/<db-uuid>)
    - CLOUDFLARE_API_TOKEN (or CLOUDFLARE_D1_API_TOKEN)
  Usage:
    tsx --env-file=.env scripts/apply_featured_singleton.ts
*/
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
const token = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Set it in your .env');
  process.exit(1);
}
if (!token) {
  console.error('CLOUDFLARE_API_TOKEN (or CLOUDFLARE_D1_API_TOKEN) is not set in your .env');
  process.exit(1);
}

async function d1(sql: string, params: any[] = []) {
  const res = await fetch(`${databaseUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sql, params }),
  });
  const textType = (res.headers.get('content-type') || '').toLowerCase();
  if (!textType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`D1 non-JSON response (${res.status}): ${text}`);
  }
  const data: any = await res.json();
  if (!res.ok || data?.success === false) {
    throw new Error(`D1 error: ${JSON.stringify(data)}`);
  }
  return data as any;
}

async function run() {
  const steps: { label: string; sql: string; ignorePatterns?: RegExp[] }[] = [
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
      label: 'Optional is_active column + unique partial index (023)',
      sql: `
ALTER TABLE featured_pages ADD COLUMN is_active INTEGER DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_active_unique ON featured_pages(is_active) WHERE is_active = 1;
      `.trim(),
      ignorePatterns: [/duplicate column/i, /already exists/i, /duplicate/i],
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
      label: 'Seed default singleton row',
      sql: `
INSERT OR IGNORE INTO featured_pages (slug, title, is_published, created_at, updated_at)
VALUES ('featured', 'Featured', 1, datetime('now'), datetime('now'));
      `.trim(),
    },
  ];

  for (const s of steps) {
    process.stdout.write(`• ${s.label}... `);
    try {
      const result = await d1(s.sql);
      process.stdout.write('OK\n');
    } catch (e: any) {
      const msg = String(e?.message || '');
      // Some steps may fail harmlessly if already applied
      if (s.ignorePatterns && s.ignorePatterns.some((rx) => rx.test(msg))) {
        process.stdout.write('Already applied\n');
      } else {
        process.stdout.write('ERROR\n');
        console.error(msg);
        // continue to next to be resilient; or break if you prefer strict mode
      }
    }
  }

  // Verify
  const verifySql = `SELECT slug, title, is_published, cover_image_url, background_video_url FROM featured_pages LIMIT 1`;
  const verify = await d1(verifySql);
  console.log('Verification:', JSON.stringify(verify, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });
