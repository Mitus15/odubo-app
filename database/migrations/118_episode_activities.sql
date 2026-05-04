-- Migration: 118_episode_activities.sql
-- Description: Create episode activities table for tracking activities during events (The Cypher, Soul Loop, etc.)


CREATE TABLE IF NOT EXISTS episode_activities (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES cool_wrld_episodes(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  activity_type TEXT CHECK (activity_type IN ('dance', 'music', 'game', 'interview', 'fashion', 'comedy', 'experimental')),
  timestamp_start TIME,
  timestamp_end TIME,
  highlight_clip_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for episode lookups
CREATE INDEX IF NOT EXISTS idx_activity_episode ON episode_activities(episode_id);

-- Index for activity type filtering
CREATE INDEX IF NOT EXISTS idx_activity_type ON episode_activities(activity_type);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_activity_sort ON episode_activities(episode_id, sort_order);

