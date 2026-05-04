-- Migration: 120_member_activities.sql
-- Description: Create member activity log for tracking founding member engagement


CREATE TABLE IF NOT EXISTS member_activities (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES founding_members(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('rsvp', 'upload', 'share', 'comment', 'checkin', 'repurpose', 'redeem')),
  content_uuid TEXT,
  episode_id TEXT REFERENCES cool_wrld_episodes(id) ON DELETE SET NULL,
  gallery_id TEXT REFERENCES galleries(id) ON DELETE SET NULL,
  metadata TEXT, -- JSON for extra context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for member lookups
CREATE INDEX IF NOT EXISTS idx_member_activity_member ON member_activities(member_id);

-- Index for episode filtering
CREATE INDEX IF NOT EXISTS idx_member_activity_episode ON member_activities(episode_id);

-- Index for activity type filtering
CREATE INDEX IF NOT EXISTS idx_member_activity_type ON member_activities(activity_type);

-- Index for recent activity
CREATE INDEX IF NOT EXISTS idx_member_activity_recent ON member_activities(created_at DESC);

