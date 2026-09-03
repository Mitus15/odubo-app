-- 154_warehouse_docs.sql — the world around the record
--
-- ALREADY APPLIED TO REMOTE D1 ON 2026-08-21, out-of-band, same as 153.
-- Reconstructed 2026-08-22 from live sqlite_master DDL. Pure CREATE IF NOT
-- EXISTS — a no-op on production, convergent on a fresh database.
--
-- Notes, lore, characters and story drafts. Album-level when track_id is
-- NULL, pinned to one song when it is set.

CREATE TABLE IF NOT EXISTS warehouse_docs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES warehouse_projects(id),
  track_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('note','lore','character','story','draft','other')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wh_docs_project ON warehouse_docs(project_id, kind, updated_at);
CREATE INDEX IF NOT EXISTS idx_wh_docs_track ON warehouse_docs(track_id);
