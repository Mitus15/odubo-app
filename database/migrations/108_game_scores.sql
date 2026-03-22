-- ============================================================================
-- Game Scores — Tetris leaderboard for fan engagement
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Player identity
  fan_id TEXT,                    -- Links to fan_profiles if email matches
  email TEXT NOT NULL,
  instagram_handle TEXT,
  display_name TEXT,              -- Derived from Instagram handle or email prefix

  -- Score data
  score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  lines_cleared INTEGER NOT NULL DEFAULT 0,
  game_duration_seconds INTEGER,  -- How long the game lasted

  -- Context
  device_type TEXT,               -- 'mobile' or 'desktop'

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (fan_id) REFERENCES fan_profiles(id) ON DELETE SET NULL
);

-- Indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_game_scores_score ON game_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_email ON game_scores(email);
CREATE INDEX IF NOT EXISTS idx_game_scores_fan ON game_scores(fan_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_created ON game_scores(created_at DESC);
