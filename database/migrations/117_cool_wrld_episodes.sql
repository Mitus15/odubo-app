-- Migration: 117_cool_wrld_episodes.sql
-- Description: Create Cool Wrld episodes table for managing episodes within series


CREATE TABLE IF NOT EXISTS cool_wrld_episodes (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES cool_wrld_series(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  air_date DATE,
  gallery_id TEXT REFERENCES galleries(id) ON DELETE SET NULL,
  video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
  trailer_video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'archived')),
  featured_track_ids TEXT, -- JSON array of track IDs
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  engagement_metrics TEXT, -- JSON: {views, rsvps, contributions}
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(series_id, episode_number)
);

-- Index for series lookups
CREATE INDEX IF NOT EXISTS idx_episodes_series ON cool_wrld_episodes(series_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_episodes_status ON cool_wrld_episodes(status);

-- Index for air date ordering
CREATE INDEX IF NOT EXISTS idx_episodes_air_date ON cool_wrld_episodes(air_date);

-- Index for gallery linking
CREATE INDEX IF NOT EXISTS idx_episodes_gallery ON cool_wrld_episodes(gallery_id);

-- Index for video linking
CREATE INDEX IF NOT EXISTS idx_episodes_video ON cool_wrld_episodes(video_id);

