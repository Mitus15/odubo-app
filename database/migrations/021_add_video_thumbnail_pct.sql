-- Add thumbnail timestamp pct and optional candidate link
-- ALTER TABLE videos ADD COLUMN thumbnail_timestamp_pct REAL;
-- Optional: store which candidate was chosen (if applicable)
-- ALTER TABLE videos ADD COLUMN chosen_candidate_id INTEGER;
-- (No FK for cross-table stability; candidates are session-scoped.)

-- Helpful index for filtering by chosen candidate if needed later
-- CREATE INDEX IF NOT EXISTS idx_videos_chosen_candidate ON videos(chosen_candidate_id);

