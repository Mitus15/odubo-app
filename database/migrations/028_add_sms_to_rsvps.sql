-- Migration 028: Add phone + sms_opt_in to gallery_rsvps for SMS reminders

BEGIN TRANSACTION;

ALTER TABLE gallery_rsvps ADD COLUMN phone TEXT; -- store E.164 (e.g., +15551234567)
ALTER TABLE gallery_rsvps ADD COLUMN sms_opt_in INTEGER DEFAULT 0; -- 0/1 boolean consent

CREATE INDEX IF NOT EXISTS idx_gallery_rsvps_phone ON gallery_rsvps(phone);

COMMIT;
