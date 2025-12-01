-- Create job_status table to track background clip generation jobs
CREATE TABLE IF NOT EXISTS job_status (
  jobId TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  videoId INTEGER,
  cfVideoId TEXT,
  errorDetails TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Helpful index for querying by video
CREATE INDEX IF NOT EXISTS idx_job_status_video ON job_status(videoId);
