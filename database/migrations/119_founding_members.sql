-- Migration: 119_founding_members.sql
-- Description: Create founding members table for tracking founding community members


CREATE TABLE IF NOT EXISTS founding_members (
  id TEXT PRIMARY KEY,
  user_identifier TEXT NOT NULL,
  user_id TEXT, -- Clerk user ID (nullable for anonymous RSVPs)
  first_series_id TEXT REFERENCES cool_wrld_series(id) ON DELETE SET NULL,
  first_episode_id TEXT REFERENCES cool_wrld_episodes(id) ON DELETE SET NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  badge_visible BOOLEAN DEFAULT TRUE,
  perk_level TEXT DEFAULT 'founding' CHECK (perk_level IN ('founding', 'early', 'supporter')),
  personal_note TEXT,
  invite_code TEXT UNIQUE,
  invited_by_id TEXT REFERENCES founding_members(id) ON DELETE SET NULL,
  UNIQUE(user_identifier, first_episode_id)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_founding_user ON founding_members(user_identifier);

-- Index for episode lookups
CREATE INDEX IF NOT EXISTS idx_founding_episode ON founding_members(first_episode_id);

-- Index for invite codes
CREATE INDEX IF NOT EXISTS idx_founding_invite ON founding_members(invite_code);

-- Index for perk levels
CREATE INDEX IF NOT EXISTS idx_founding_perks ON founding_members(perk_level);

