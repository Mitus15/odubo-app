-- 153_warehouse.sql — the Warehouse: projects → pieces → files
--
-- ALREADY APPLIED TO REMOTE D1 ON 2026-08-21, out-of-band. There is no
-- d1_migrations ledger entry (the ledger stops at 065) and the original file
-- was never committed — the branch that carried it was lost. This file was
-- reconstructed on 2026-08-22 from the live sqlite_master DDL, so it is a
-- byte-faithful record of what production actually has.
--
-- Every statement is CREATE ... IF NOT EXISTS: running this against
-- production is a no-op, and running it against a fresh database converges
-- that database with production. Safe to re-run.
--
-- The model: an IP project (album, film, fashion line) holds deliverable
-- pieces, and each piece holds the files that make it. Files may attach to a
-- project with no piece — that is the inbox. `class` is the owner's three
-- tiers: working drafts, masters, and the commercial one that ships.
--
-- Soft refs only. album_id / track_id point at the music tables with no
-- foreign key: the warehouse points at subsystems, never the reverse.

CREATE TABLE IF NOT EXISTS warehouse_projects (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('album','film','fashion','other')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','shipped','archived')),
  album_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS warehouse_pieces (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES warehouse_projects(id),
  kind TEXT NOT NULL CHECK (kind IN
    ('cover','vinyl','packaging','track-master','promo','other')),
  title TEXT NOT NULL,
  description TEXT,
  track_id TEXT,
  preview_file_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS warehouse_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES warehouse_projects(id),
  piece_id TEXT REFERENCES warehouse_pieces(id),
  class TEXT NOT NULL CHECK (class IN ('working','master','commercial')),
  category TEXT NOT NULL CHECK (category IN
    ('preview-image','audio-master','daw-project','artwork-source','video','document','other')),
  r2_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading','ready','failed')),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wh_pieces_project ON warehouse_pieces(project_id, kind, sort_order);
CREATE INDEX IF NOT EXISTS idx_wh_files_project ON warehouse_files(project_id, piece_id);
CREATE INDEX IF NOT EXISTS idx_wh_files_class ON warehouse_files(project_id, class);
