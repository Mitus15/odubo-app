-- The door.
--
-- A scan at the door admits a pass once. This is a different act from the app's
-- redemption (redeemed_by binds the code to a phone so it can post and vote);
-- a guest can be admitted without ever opening the app, and can open the app
-- without ever reaching the door. So it is its own column, not a reuse.
ALTER TABLE event_codes ADD COLUMN admitted_at TEXT;
