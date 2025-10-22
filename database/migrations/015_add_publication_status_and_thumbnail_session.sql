-- Add publication_status to videos (live | archived)
ALTER TABLE videos ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'archived';

-- Optional helpful index
CREATE INDEX IF NOT EXISTS idx_videos_publication_status ON videos(publication_status);

-- Session table to gate creation until thumbnail selection is made
CREATE TABLE IF NOT EXISTS video_upload_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded | analyzing | awaiting_choice | finalizing | done | aborted
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_video_upload_sessions_uid ON video_upload_sessions(uid);
CREATE INDEX IF NOT EXISTS idx_video_upload_sessions_status ON video_upload_sessions(status);

-- Candidate thumbnails captured during analysis
CREATE TABLE IF NOT EXISTS videos_thumbnail_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  uid TEXT NOT NULL,
  url TEXT NOT NULL,
  timestamp_s REAL,
  pct REAL,
  sharpness REAL,
  exposure REAL,
  face_score REAL,
  ai_score REAL,
  rank INTEGER,
  rationale TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES video_upload_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_candidates_session ON videos_thumbnail_candidates(session_id);

-- High-level analysis cache
CREATE TABLE IF NOT EXISTS videos_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  transcript_json TEXT,
  chorus_timestamps_json TEXT,
  mood TEXT,
  genre TEXT,
  themes_json TEXT,
  provider TEXT,
  model TEXT,
  diagnostics_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_videos_analysis_uid ON videos_analysis(uid);
