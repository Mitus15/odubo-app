-- Migration: 128_extend_deployments.sql
-- Description: Add episode linking to existing video_deployments table


-- Add episode linking
ALTER TABLE video_deployments ADD COLUMN episode_id TEXT REFERENCES cool_wrld_episodes(id) ON DELETE SET NULL;
ALTER TABLE video_deployments ADD COLUMN is_episode_featured BOOLEAN DEFAULT FALSE;

-- Add index for episode lookups
CREATE INDEX IF NOT EXISTS idx_deployments_episode ON video_deployments(episode_id);

