-- Migration 105: Add 'scheduled' status to video_deployments CHECK constraint
-- SQLite doesn't support ALTER CHECK, so we recreate the table

-- Step 1: Create new table with updated constraint
CREATE TABLE video_deployments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  postforme_post_id TEXT,
  external_url TEXT,
  external_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'published', 'failed', 'synced')),
  deployed_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT,
  metadata_json TEXT,
  error_message TEXT,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Step 2: Copy existing data
INSERT INTO video_deployments_new (id, video_id, platform, postforme_post_id, external_url, external_id, status, deployed_at, synced_at, metadata_json, error_message)
SELECT id, video_id, platform, postforme_post_id, external_url, external_id, status, deployed_at, synced_at, metadata_json, error_message
FROM video_deployments;

-- Step 3: Drop old table
DROP TABLE video_deployments;

-- Step 4: Rename new table
ALTER TABLE video_deployments_new RENAME TO video_deployments;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_video_deployments_video_id ON video_deployments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_deployments_platform ON video_deployments(platform);
CREATE INDEX IF NOT EXISTS idx_video_deployments_status ON video_deployments(status);
CREATE INDEX IF NOT EXISTS idx_video_deployments_postforme ON video_deployments(postforme_post_id) WHERE postforme_post_id IS NOT NULL;
