-- Add extended descriptive fields and normalized duration to videos
-- These help power richer SEO, in-app discovery, and AI summaries without breaking existing columns

-- Short and long descriptions (optional; preserve original description as legacy fallback)
ALTER TABLE videos ADD COLUMN short_description TEXT;
ALTER TABLE videos ADD COLUMN long_description TEXT;

-- Tags as a JSON string (array of strings), safe default empty array
ALTER TABLE videos ADD COLUMN tags TEXT DEFAULT '[]';

-- Numeric duration (seconds) alongside the legacy formatted string in `duration`
ALTER TABLE videos ADD COLUMN duration_seconds INTEGER;

-- AI-generated description cache (optional), can mirror long_description if present
ALTER TABLE videos ADD COLUMN ai_description TEXT;

-- Helpful index for discovery by publication, recency, and category already exists via prior migrations
-- Optionally index duration_seconds if you plan to filter/range query by length
-- CREATE INDEX IF NOT EXISTS idx_videos_duration_seconds ON videos(duration_seconds);
