-- Analytics insights and AI job tables

-- 1) Consolidated video performance / insights
CREATE TABLE IF NOT EXISTS videos_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  video_id INTEGER,
  source TEXT NOT NULL DEFAULT 'odubo',
  platform TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  watch_time_seconds INTEGER DEFAULT 0,
  conversion_events_json TEXT,
  audience_json TEXT,
  creative_fit_json TEXT,
  ad_score REAL,
  last_synced_at DATETIME DEFAULT (datetime('now')),
  created_at DATETIME DEFAULT (datetime('now'))
);

-- 2) AI clip variant jobs ("alternate universe" clips)
CREATE TABLE IF NOT EXISTS clip_ai_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_clip_id INTEGER NOT NULL,
  created_by_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'queued',
  prompt TEXT,
  negative_prompt TEXT,
  style_preset TEXT,
  image_prompts_json TEXT,
  target_purpose TEXT,
  result_clip_id INTEGER,
  result_url TEXT,
  style_source_json TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- 3) AI avatar announcement jobs (Mani avatar videos)
CREATE TABLE IF NOT EXISTS avatar_announcement_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'queued',
  script TEXT,
  script_source TEXT,
  voice_profile_id TEXT,
  avatar_profile_id TEXT,
  style_preset TEXT,
  result_video_id INTEGER,
  result_url TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
