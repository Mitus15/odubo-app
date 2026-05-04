-- Migration: 125_extend_galleries.sql
-- Description: Add Cool Wrld columns to existing galleries table


-- Add series and episode linking to galleries
ALTER TABLE galleries ADD COLUMN series_id TEXT REFERENCES cool_wrld_series(id) ON DELETE SET NULL;
ALTER TABLE galleries ADD COLUMN episode_id TEXT REFERENCES cool_wrld_episodes(id) ON DELETE SET NULL;
ALTER TABLE galleries ADD COLUMN is_event BOOLEAN DEFAULT FALSE;
ALTER TABLE galleries ADD COLUMN event_date DATE;
ALTER TABLE galleries ADD COLUMN event_venue TEXT;
ALTER TABLE galleries ADD COLUMN event_address TEXT;
ALTER TABLE galleries ADD COLUMN event_capacity INTEGER;
ALTER TABLE galleries ADD COLUMN checkin_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE galleries ADD COLUMN rsvp_enabled BOOLEAN DEFAULT TRUE;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_galleries_series ON galleries(series_id);
CREATE INDEX IF NOT EXISTS idx_galleries_episode ON galleries(episode_id);
CREATE INDEX IF NOT EXISTS idx_galleries_event ON galleries(is_event, event_date);

