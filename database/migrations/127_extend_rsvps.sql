-- Migration: 127_extend_rsvps.sql
-- Description: Add founding member and check-in columns to existing gallery_rsvps table


-- Add episode linking
ALTER TABLE gallery_rsvps ADD COLUMN episode_id TEXT REFERENCES cool_wrld_episodes(id) ON DELETE SET NULL;

-- Add founding member tracking
ALTER TABLE gallery_rsvps ADD COLUMN is_founding_rsvp BOOLEAN DEFAULT FALSE;
ALTER TABLE gallery_rsvps ADD COLUMN founding_member_id TEXT REFERENCES founding_members(id) ON DELETE SET NULL;

-- Add check-in tracking
ALTER TABLE gallery_rsvps ADD COLUMN checked_in BOOLEAN DEFAULT FALSE;
ALTER TABLE gallery_rsvps ADD COLUMN checked_in_at DATETIME;
ALTER TABLE gallery_rsvps ADD COLUMN checkin_method TEXT CHECK (checkin_method IN ('qr', 'code', 'manual'));

-- Add RSVP tier
ALTER TABLE gallery_rsvps ADD COLUMN rsvp_tier TEXT DEFAULT 'general' CHECK (rsvp_tier IN ('general', 'vip', 'press'));
ALTER TABLE gallery_rsvps ADD COLUMN dietary_notes TEXT;
ALTER TABLE gallery_rsvps ADD COLUMN media_outlet TEXT;
ALTER TABLE gallery_rsvps ADD COLUMN coverage_link TEXT;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_rsvps_episode ON gallery_rsvps(episode_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_founding ON gallery_rsvps(is_founding_rsvp);
CREATE INDEX IF NOT EXISTS idx_rsvps_checkin ON gallery_rsvps(checked_in);
CREATE INDEX IF NOT EXISTS idx_rsvps_tier ON gallery_rsvps(rsvp_tier);

