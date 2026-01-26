-- =============================================================================
-- WODA PASSIVE LEARNING SYSTEM
-- Captures content context on upload for deep learning
-- =============================================================================

-- Video context captured on upload/finalize (Woda's knowledge base)
CREATE TABLE IF NOT EXISTS woda_video_context (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER UNIQUE REFERENCES videos(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  mood TEXT,
  category TEXT,
  type TEXT,
  artist_name TEXT,
  is_clip INTEGER DEFAULT 0,
  parent_video_id INTEGER,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_woda_video_context_parent ON woda_video_context(parent_video_id);
CREATE INDEX IF NOT EXISTS idx_woda_video_context_video ON woda_video_context(video_id);

-- Add context columns to training examples (for richer learning)
ALTER TABLE ai_training_examples ADD COLUMN video_id INTEGER REFERENCES videos(id);
ALTER TABLE ai_training_examples ADD COLUMN video_mood TEXT;
ALTER TABLE ai_training_examples ADD COLUMN video_category TEXT;
ALTER TABLE ai_training_examples ADD COLUMN video_type TEXT;
ALTER TABLE ai_training_examples ADD COLUMN is_clip INTEGER DEFAULT 0;
ALTER TABLE ai_training_examples ADD COLUMN parent_video_id INTEGER;

-- Woda's analyzed insights (extracted patterns, periodically updated)
CREATE TABLE IF NOT EXISTS woda_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES ai_voice_profiles(id),
  insight_type TEXT NOT NULL,  -- 'phrase', 'structure', 'hashtag_pattern', 'emoji_usage', 'length_pref'
  insight_key TEXT NOT NULL UNIQUE,   -- e.g., 'avg_caption_length', 'common_opener', 'hashtag_style'
  insight_value TEXT NOT NULL, -- JSON or text value
  confidence REAL DEFAULT 0.5, -- 0-1 how confident in this insight
  sample_count INTEGER DEFAULT 0, -- how many examples this is based on
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_woda_insights_type ON woda_insights(profile_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_woda_insights_key ON woda_insights(insight_key);
