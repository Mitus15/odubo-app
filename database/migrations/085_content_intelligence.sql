-- Phase 3: Content Intelligence
-- Add explicit parent video linking and enhanced engagement tracking

-- 1. Add explicit parent_video_id column to videos table
ALTER TABLE videos ADD COLUMN parent_video_id INTEGER REFERENCES videos(id);
CREATE INDEX IF NOT EXISTS idx_videos_parent ON videos(parent_video_id);

-- 2. Add engagement percentage tracking to clip_view_events
ALTER TABLE clip_view_events ADD COLUMN clip_duration_ms INTEGER;
ALTER TABLE clip_view_events ADD COLUMN pct_watched REAL;

-- 3. Backfill parent_video_id from existing related_projects JSON
-- Extract parent_id from strings like '["parent_id:123", "style:vertical"]'
UPDATE videos
SET parent_video_id = CAST(
  SUBSTR(
    related_projects,
    INSTR(related_projects, 'parent_id:') + 10,
    INSTR(SUBSTR(related_projects, INSTR(related_projects, 'parent_id:') + 10), '"') - 1
  ) AS INTEGER
)
WHERE type = 'clip'
  AND related_projects LIKE '%parent_id:%'
  AND parent_video_id IS NULL;
