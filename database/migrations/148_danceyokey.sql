-- 148: Danceyokey — the night's dance-floor queue (karaoke, for dancing).
--
-- A row is one ACT, not one person: `performers` is a free list, so solos,
-- duets and whole crews all hold a single spot. Status is the state machine:
--   waiting  → on the list (signed up in advance or in the room)
--   queued   → in the running order, `position` set
--   performing → the floor is theirs
--   done | cut → finished, or gracefully removed
--
-- Selection mode and spots-per-night live in loop_settings, not here, because
-- the host changes them per event.
--
-- Applied to remote D1 via scripts/loop/apply_148_danceyokey.ts.

CREATE TABLE IF NOT EXISTS danceyokey_signups (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  attendee_id TEXT,
  performers TEXT NOT NULL,
  song_title TEXT,
  song_artist TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  position INTEGER,
  source TEXT NOT NULL DEFAULT 'in-room',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_danceyokey_event
  ON danceyokey_signups(event_id, status, position);
CREATE INDEX IF NOT EXISTS idx_danceyokey_attendee
  ON danceyokey_signups(event_id, attendee_id);
