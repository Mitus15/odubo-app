-- =============================================================================
-- Migration 141: The Ark - Weekly Reviews
-- =============================================================================

CREATE TABLE IF NOT EXISTS ark_reviews (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  accomplishments TEXT,
  blockers TEXT,
  reflections TEXT,
  next_week_focus TEXT,
  mood TEXT,
  ai_summary TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ark_reviews_week ON ark_reviews(week_start);
