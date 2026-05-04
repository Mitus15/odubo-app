-- Migration: 126_extend_videos.sql
-- Description: Add Cool Wrld columns to existing videos table


-- Add episode linking to videos
ALTER TABLE videos ADD COLUMN episode_id TEXT REFERENCES cool_wrld_episodes(id) ON DELETE SET NULL;
ALTER TABLE videos ADD COLUMN clip_type TEXT CHECK (clip_type IN ('teaser', 'highlight', 'behind_scenes', 'fan', 'trailer', 'full'));

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_videos_episode ON videos(episode_id);
CREATE INDEX IF NOT EXISTS idx_videos_clip_type ON videos(clip_type);

