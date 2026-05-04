-- Migration: 129_mymoments_vaults.sql
-- Description: Create MyMoments vaults table for personal content vaults


CREATE TABLE IF NOT EXISTS my_moments_vaults (
  id TEXT PRIMARY KEY,
  user_identifier TEXT NOT NULL,
  user_id TEXT, -- Clerk user ID
  episode_id TEXT REFERENCES cool_wrld_episodes(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES galleries(id) ON DELETE CASCADE,
  photo_count INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  storage_used_bytes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_identifier, episode_id),
  UNIQUE(user_identifier, event_id)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_vaults_user ON my_moments_vaults(user_identifier);

-- Index for episode lookups
CREATE INDEX IF NOT EXISTS idx_vaults_episode ON my_moments_vaults(episode_id);

-- Index for event lookups
CREATE INDEX IF NOT EXISTS idx_vaults_event ON my_moments_vaults(event_id);

