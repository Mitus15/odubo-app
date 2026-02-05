-- Migration 097: Add scheduled deployment support
-- Date: 2024-02-05
-- Description: Add scheduled_for column to videos table for persistent scheduling

-- Add scheduled_for column to store deployment schedule
ALTER TABLE videos ADD COLUMN scheduled_for TEXT;

-- Index for querying scheduled videos
CREATE INDEX IF NOT EXISTS idx_videos_scheduled_for ON videos(scheduled_for);

-- Note: scheduled_for stores ISO 8601 datetime string (e.g., "2024-02-05T15:30:00.000Z")
-- NULL = no schedule set (deploy immediately or manually)
-- Non-NULL = video should be deployed at this time
