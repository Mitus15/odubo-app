-- =============================================================================
-- Migration 136: The Ark - Notes, Assets & Timeline
-- =============================================================================

-- ARK_NOTES: Rich text notes attached to projects
CREATE TABLE IF NOT EXISTS ark_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT,
  is_pinned INTEGER DEFAULT 0,
  tags TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES ark_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ark_notes_project ON ark_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_ark_notes_pinned ON ark_notes(is_pinned);

-- ARK_ASSETS: Links, files, tools, references
CREATE TABLE IF NOT EXISTS ark_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  asset_type TEXT,
  url TEXT,
  r2_key TEXT,
  description TEXT,
  category TEXT,
  integration_id TEXT,
  metadata TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES ark_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ark_assets_project ON ark_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_ark_assets_integration ON ark_assets(integration_id);

-- ARK_TIMELINE: Activity log
CREATE TABLE IF NOT EXISTS ark_timeline (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES ark_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ark_timeline_project ON ark_timeline(project_id);
CREATE INDEX IF NOT EXISTS idx_ark_timeline_type ON ark_timeline(entry_type);
CREATE INDEX IF NOT EXISTS idx_ark_timeline_created ON ark_timeline(created_at);
