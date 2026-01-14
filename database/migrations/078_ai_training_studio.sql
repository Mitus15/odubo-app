-- Migration: 078_ai_training_studio.sql
-- AI Training Studio for personalized voice profiles

-- AI Voice Profiles - custom instructions and tone settings
CREATE TABLE IF NOT EXISTS ai_voice_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT 'Default',
  is_active INTEGER DEFAULT 1,

  -- Core instructions
  tone_description TEXT,           -- Free-form tone description
  custom_instructions TEXT,        -- Custom prompt additions
  banned_words TEXT,               -- JSON array of words to avoid
  required_patterns TEXT,          -- JSON array of patterns to use

  -- Platform-specific style overrides
  instagram_style TEXT,
  tiktok_style TEXT,
  youtube_style TEXT,

  -- Generation limits
  max_emojis INTEGER DEFAULT 1,
  max_hashtags INTEGER DEFAULT 7,
  prefer_lowercase INTEGER DEFAULT 1,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Training examples - captions marked as perfect/good/avoid
CREATE TABLE IF NOT EXISTS ai_training_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES ai_voice_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,           -- The example caption
  platform TEXT,                   -- instagram, tiktok, youtube, or null for all
  rating TEXT DEFAULT 'perfect',   -- perfect, good, avoid
  source TEXT,                     -- user_written, ai_generated, inspiration
  notes TEXT,                      -- Why this is good/bad
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Voice samples for speech pattern analysis
CREATE TABLE IF NOT EXISTS ai_voice_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES ai_voice_profiles(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,            -- Audio file in R2
  transcript TEXT,                 -- AI-generated transcript
  analysis TEXT,                   -- AI analysis of speech patterns
  duration INTEGER,                -- Duration in seconds
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Visual mood board references
CREATE TABLE IF NOT EXISTS ai_visual_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES ai_voice_profiles(id) ON DELETE CASCADE,
  r2_key TEXT,                     -- Image/video in R2
  external_url TEXT,               -- Or external URL
  description TEXT,
  tags TEXT,                       -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Feedback on AI-generated content for learning
CREATE TABLE IF NOT EXISTS ai_generation_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES ai_voice_profiles(id) ON DELETE CASCADE,
  content_id INTEGER,              -- Link to social_content if applicable
  generated_text TEXT NOT NULL,
  platform TEXT,
  rating INTEGER,                  -- 1-5 stars or thumbs up/down (1 or 0)
  feedback_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_training_examples_profile ON ai_training_examples(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_examples_rating ON ai_training_examples(rating);
CREATE INDEX IF NOT EXISTS idx_ai_voice_samples_profile ON ai_voice_samples(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_visual_references_profile ON ai_visual_references(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_feedback_profile ON ai_generation_feedback(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_feedback_rating ON ai_generation_feedback(rating);

-- Insert default profile
INSERT INTO ai_voice_profiles (name, is_active, tone_description, max_emojis, max_hashtags, prefer_lowercase)
VALUES (
  'Default',
  1,
  'artistic. minimal. poetic but accessible. let the art speak - captions complement, never explain. mysterious over explicit. short impactful phrases with space to breathe.',
  1,
  7,
  1
);
