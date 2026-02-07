-- Migration 106: Create transcoding_jobs table for FFmpeg transcoding progress tracking
-- This table stores real-time progress for video transcoding operations
-- Enables UI to display detailed status: queued → analyzing → transcoding (%) → complete

CREATE TABLE transcoding_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,

  -- Job status and progress
  status TEXT NOT NULL DEFAULT 'queued', -- queued, analyzing, transcoding, complete, failed
  progress INTEGER DEFAULT 0, -- 0-100 percentage

  -- File information
  source_url TEXT NOT NULL, -- Original file URL in R2
  output_url TEXT, -- Transcoded MP4 URL (set when complete)
  source_format TEXT, -- Original format (mov, avi, etc)
  target_format TEXT DEFAULT 'mp4', -- Target format (always mp4 for now)

  -- Size tracking
  source_size INTEGER, -- Source file size in bytes
  output_size INTEGER, -- Output file size in bytes

  -- Video metadata
  duration_seconds REAL, -- Video duration
  codec_info TEXT, -- Original codec information (JSON)

  -- Error handling
  error_message TEXT, -- Error details if failed
  retry_count INTEGER DEFAULT 0, -- Number of retries attempted

  -- Timestamps
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX idx_transcoding_jobs_video_id ON transcoding_jobs(video_id);
CREATE INDEX idx_transcoding_jobs_status ON transcoding_jobs(status);
CREATE INDEX idx_transcoding_jobs_created_at ON transcoding_jobs(created_at);

-- Add transcoding_job_id to videos table for easy lookup
ALTER TABLE videos ADD COLUMN transcoding_job_id INTEGER;
CREATE INDEX idx_videos_transcoding_job_id ON videos(transcoding_job_id);
