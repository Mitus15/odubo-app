-- Social Media Studio - Campaigns and Posting Slots
-- Migration: 081_social_studio.sql

-- ============================================================================
-- CAMPAIGNS TABLE
-- Organize posts into campaigns (album releases, tours, ongoing brand building)
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,                    -- Hex color for visual identification
  start_date TEXT,               -- Optional campaign start date
  end_date TEXT,                 -- Optional campaign end date
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
  post_count INTEGER DEFAULT 0,  -- Denormalized count for performance
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for listing active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ============================================================================
-- POSTING SLOTS TABLE
-- Define recurring posting times (e.g., daily at 2PM and 7PM)
-- ============================================================================

CREATE TABLE IF NOT EXISTS posting_slots (
  id TEXT PRIMARY KEY,
  day_of_week INTEGER,           -- 0=Sunday, 6=Saturday, NULL=every day
  time TEXT NOT NULL,            -- HH:MM format in user's timezone
  timezone TEXT DEFAULT 'America/Los_Angeles',
  platforms TEXT,                -- JSON array: ["instagram", "tiktok"]
  is_active INTEGER DEFAULT 1,
  label TEXT,                    -- Optional friendly name (e.g., "Morning Post")
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for active slots
CREATE INDEX IF NOT EXISTS idx_posting_slots_active ON posting_slots(is_active);

-- ============================================================================
-- SOCIAL POSTS SCHEMA UPDATES
-- Add campaign_id, slot_id, and sync tracking fields
-- ============================================================================

-- Add campaign reference
ALTER TABLE social_posts ADD COLUMN campaign_id TEXT REFERENCES campaigns(id);

-- Add slot reference (which recurring slot this post fills)
ALTER TABLE social_posts ADD COLUMN slot_id TEXT REFERENCES posting_slots(id);

-- Add Post for Me status tracking (separate from local status)
ALTER TABLE social_posts ADD COLUMN postforme_status TEXT;

-- Add sync timestamp for cache invalidation
ALTER TABLE social_posts ADD COLUMN last_synced_at TEXT;

-- Index for campaign filtering
CREATE INDEX IF NOT EXISTS idx_social_posts_campaign ON social_posts(campaign_id);

-- Index for slot lookups
CREATE INDEX IF NOT EXISTS idx_social_posts_slot ON social_posts(slot_id);

-- Index for sync status
CREATE INDEX IF NOT EXISTS idx_social_posts_sync ON social_posts(last_synced_at);

-- ============================================================================
-- DEFAULT POSTING SLOTS
-- Pre-populate with common 2x daily schedule
-- ============================================================================

INSERT OR IGNORE INTO posting_slots (id, day_of_week, time, timezone, platforms, is_active, label)
VALUES
  ('slot_afternoon', NULL, '14:00', 'America/Los_Angeles', '["instagram", "tiktok"]', 1, 'Afternoon'),
  ('slot_evening', NULL, '19:00', 'America/Los_Angeles', '["instagram", "tiktok"]', 1, 'Evening');
