-- Migration 101: Create video_deployments table
-- Replaces flat platform URL columns (youtube_url, tiktok_url, etc.) with proper deployment tracking
-- Each deployment to each platform gets its own row

CREATE TABLE IF NOT EXISTS video_deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  postforme_post_id TEXT,
  external_url TEXT,
  external_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'synced')),
  deployed_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT,
  metadata_json TEXT,
  error_message TEXT,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_deployments_video_id ON video_deployments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_deployments_platform ON video_deployments(platform);
CREATE INDEX IF NOT EXISTS idx_video_deployments_status ON video_deployments(status);
CREATE INDEX IF NOT EXISTS idx_video_deployments_postforme ON video_deployments(postforme_post_id) WHERE postforme_post_id IS NOT NULL;

-- Note: The old youtube_url, tiktok_url, instagram_reels_url columns on videos table
-- are kept for backward compatibility but will be deprecated.
-- New code should use video_deployments table.
