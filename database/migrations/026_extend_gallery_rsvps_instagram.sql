-- Migration 026: Extend gallery_rsvps for Instagram handle + consent

BEGIN TRANSACTION;

ALTER TABLE gallery_rsvps ADD COLUMN instagram_handle TEXT;
ALTER TABLE gallery_rsvps ADD COLUMN instagram_opt_in INTEGER DEFAULT 0; -- 0/1 boolean

CREATE INDEX IF NOT EXISTS idx_gallery_rsvps_instagram ON gallery_rsvps(instagram_handle);

COMMIT;
