-- Migration 110: Schedule-based featured video for /now bio link
-- /now queries this table at request time: the row with the most-recent
-- starts_at that is <= now() is the active video.

CREATE TABLE IF NOT EXISTS featured_schedule (
  video_id   INTEGER NOT NULL,
  starts_at  TEXT    NOT NULL,  -- UTC datetime, format: YYYY-MM-DD HH:MM:SS
  label      TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (video_id, starts_at)
);

CREATE INDEX IF NOT EXISTS idx_featured_schedule_starts_at
  ON featured_schedule(starts_at DESC);

-- Backfill: posters already scheduled (UTC = PST + 8h)
INSERT OR IGNORE INTO featured_schedule (video_id, starts_at, label) VALUES
  (424, '2026-02-25 22:00:00', 'K-Town'),
  (438, '2026-02-26 03:00:00', 'Pinocchio is in K-Town'),
  (439, '2026-02-26 21:00:00', 'David In The City'),
  (440, '2026-02-27 03:00:00', 'Alone'),
  (441, '2026-02-28 21:00:00', 'Pour Salem');
