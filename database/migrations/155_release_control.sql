-- 155_release_control.sql — Release Control
--
-- Release Control's job is to join across seven subsystems it must not own:
-- the warehouse, the distribution tables, Ark, social, Shopify, the Loop
-- Journal and the event. `release_links` is that join, and it is the ONLY
-- new table — one polymorphic soft-ref table owned by Release Control,
-- pointing outward and never inward. The alternative was teaching five other
-- features about albums.
--
-- The spine is albums.id because it is the id every other row already points
-- at (warehouse_projects.album_id, distribution_releases.internal_album_id,
-- videos.album_id) and the one /music/albums/[id] uses. No fourth identity
-- for "the release."
--
-- NOTE: 152 is deliberately skipped. The number may have been spent against
-- production out-of-band; the d1_migrations ledger stops at 065 and cannot
-- answer. Burned rather than risked.
--
-- The three ALTERs cannot be guarded in SQLite. Apply this file through
-- scripts/release/apply_155_release_control.ts, which does PRAGMA
-- table_info() before each one and skips columns that already exist.

CREATE TABLE IF NOT EXISTS release_links (
  id         TEXT PRIMARY KEY,
  album_id   TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN (
               'ark-project','ark-task','video','social-post','loop-event',
               'shopify-product','journal-issue','poster-kit','deployment','other')),
  ref_id     TEXT NOT NULL,
  label      TEXT,
  meta       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_release_links_uniq ON release_links(album_id, kind, ref_id);
CREATE INDEX IF NOT EXISTS idx_release_links_album ON release_links(album_id, kind);

-- The missing albums ↔ Shopify link. Mirrors videos exactly (migration 036).
ALTER TABLE albums ADD COLUMN shopify_product_id TEXT;
ALTER TABLE albums ADD COLUMN shopify_product_handle TEXT;

-- Which warehouse master produced the current tracks.audio_url, so the UI can
-- say "playing the master from 4 Sept" and go amber when a newer one lands.
ALTER TABLE tracks ADD COLUMN source_file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_source_file ON tracks(source_file_id);
