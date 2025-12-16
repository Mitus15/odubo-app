-- Detailed per-step job events timeline
CREATE TABLE IF NOT EXISTS job_status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jobId TEXT NOT NULL,
  step TEXT NOT NULL,
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_status_events(jobId);
