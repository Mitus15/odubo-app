-- 150 — the Journal's Iconic Moments stop being pasted URLs.
--
-- 144 shipped `journal_moments.image_url` as a full URL an admin typed in, with
-- its own note: "the Portal submission pipeline that will feed this lands in a
-- follow-up; until then admins paste URLs." This is that follow-up.
--
-- The Wall already has curation: `gallery_photos.featured = 1`, set with the ✦
-- in Wall moderation, read by /api/loop/gallery/list?featured=1 and rendered as
-- "Iconic Moments" on Legacy. So the same idea existed twice, and featuring a
-- photo on the Wall did nothing for the magazine. Now the featured set IS the
-- Journal's photography, and this table becomes the editorial overlay on top of
-- it: which ones ran, in what order, under what caption.
--
-- `credit` also goes. It was free text that restated what loop_media_credits
-- already knows from the moment of capture — and attribution is load-bearing
-- here, because contributor royalties depend on it. It is now derived, not
-- retyped.
--
-- SQLite can't drop NOT NULL in place, so this is the standard rebuild.
-- Rows carrying a legacy pasted URL are preserved and still render.

CREATE TABLE IF NOT EXISTS journal_moments_v2 (
  event_id  TEXT NOT NULL,
  position  INTEGER NOT NULL,
  id        TEXT NOT NULL,
  -- The Wall photo this moment prints. NULL only for legacy pasted-URL rows.
  photo_uid TEXT,
  -- Legacy escape hatch: a URL with no Wall photo behind it.
  image_url TEXT,
  caption   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (event_id, id)
);

INSERT OR IGNORE INTO journal_moments_v2 (event_id, position, id, photo_uid, image_url, caption)
  SELECT event_id, position, id, NULL, image_url, caption FROM journal_moments;

DROP TABLE journal_moments;
ALTER TABLE journal_moments_v2 RENAME TO journal_moments;

CREATE INDEX IF NOT EXISTS idx_journal_moments_photo
  ON journal_moments(photo_uid);
