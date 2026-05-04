-- Migration: 116_cool_wrld_series.sql
-- Description: Create Cool Wrld series table for managing content series (Loops Soul, etc.)

CREATE TABLE IF NOT EXISTS cool_wrld_series (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  universe_tag TEXT,
  season_count INTEGER DEFAULT 0,
  cover_image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_series_slug ON cool_wrld_series(slug);
CREATE INDEX IF NOT EXISTS idx_series_universe ON cool_wrld_series(universe_tag);
CREATE INDEX IF NOT EXISTS idx_series_status ON cool_wrld_series(status);
