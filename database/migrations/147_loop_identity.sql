-- 147: Loop Soul attendee identity.
--
-- A device cookie (`ls_voter`) can open a door; it cannot carry credits,
-- curations or royalties. These tables give a person continuity across devices
-- and volumes, keyed for recovery by the email they checked out with.
--
-- Attribution lives HERE, not as a column on moments' gallery_photos: moments
-- must never learn Loop Soul exists (the integrity rule from the merge plan).
-- The join is on the photo uid.
--
-- Applied to remote D1 via scripts/loop/apply_147_loop_identity.ts.

CREATE TABLE IF NOT EXISTS loop_attendees (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  -- Recovery key: the address used at checkout. Stored lowercase/trimmed.
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_attendees_email
  ON loop_attendees(email) WHERE email IS NOT NULL;

-- Devices that point at an attendee (phone + laptop + a cleared browser).
CREATE TABLE IF NOT EXISTS loop_attendee_devices (
  voter_id TEXT PRIMARY KEY,
  attendee_id TEXT NOT NULL,
  bound_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loop_devices_attendee
  ON loop_attendee_devices(attendee_id);

-- One row per attendee per event: the attendance history "regular" derives from.
CREATE TABLE IF NOT EXISTS loop_attendance (
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  code TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, attendee_id)
);
CREATE INDEX IF NOT EXISTS idx_loop_attendance_attendee
  ON loop_attendance(attendee_id);

-- Who shot what. Immutable once written.
CREATE TABLE IF NOT EXISTS loop_media_credits (
  photo_uid TEXT PRIMARY KEY,
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loop_credits_attendee
  ON loop_media_credits(attendee_id, event_id);
