-- Migration 016: Create galleries and gallery_photos for Event Gallery (Moments)

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS galleries (
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
);

CREATE INDEX IF NOT EXISTS idx_galleries_code ON galleries(code);
CREATE INDEX IF NOT EXISTS idx_galleries_created_by ON galleries(created_by);

CREATE TABLE IF NOT EXISTS gallery_photos (
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
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_gallery_id ON gallery_photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_uid ON gallery_photos(uid);

COMMIT;
