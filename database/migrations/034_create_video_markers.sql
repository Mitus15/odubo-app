-- Create table for manual timeline markers per video
CREATE TABLE IF NOT EXISTS video_markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  timestamp REAL NOT NULL, -- seconds from start
  label TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(video_id) REFERENCES videos(id)
);

CREATE INDEX IF NOT EXISTS idx_video_markers_video_time
  ON video_markers(video_id, timestamp);
