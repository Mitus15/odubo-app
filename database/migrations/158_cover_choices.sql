-- 158 — the fluid cover, and the gift chain joining the identity ladder.
--
-- The album's cover is not a vacancy waiting to be filled. The artwork shipping
-- today is the owner's version and stays his; anyone can hold their own; the
-- room's ballot decides which one is OFFICIAL and goes to streaming. That means
-- a cover is a per-person preference, not a single global value, and it has to
-- survive a new phone the way a photo credit does — so it is keyed on the
-- ATTENDEE, not on the device cookie.
CREATE TABLE IF NOT EXISTS loop_cover_choices (
  attendee_id TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  photo_uid   TEXT NOT NULL,
  chosen_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- One cover per person per volume. Choosing again replaces, never appends.
  PRIMARY KEY (attendee_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_loop_cover_choices_uid ON loop_cover_choices(photo_uid);

-- Sharing the single is the first thing anybody does that has their name on it.
-- Tying that name to an attendee makes "Loop someone in" the first rung of the
-- ladder rather than a separate id space that has to be reconciled later.
ALTER TABLE loop_gift_codes ADD COLUMN attendee_id TEXT;

CREATE INDEX IF NOT EXISTS idx_loop_gift_codes_attendee ON loop_gift_codes(attendee_id);

-- The OFFICIAL cover is a single value per volume and lives in loop_settings
-- under "official_cover:<eventId>" — one row, owner-set, no table needed.
-- albums.cover_art_url is deliberately NOT rewritten by the app: pushing art to
-- streaming stays a human step, and a column the app silently overwrites is a
-- column nobody can trust.
