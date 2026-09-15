-- Who said we may write to them.
--
-- Canada's anti-spam law wants express, opt-in consent before marketing email,
-- and a record of when and where it was given. This is that record, keyed on
-- the address, written the moment the box on the pass sheet is ticked.
-- Transactional mail (the pass itself, the album release) never needs it.
CREATE TABLE IF NOT EXISTS loop_marketing_consent (
  email         TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL,
  source        TEXT NOT NULL,          -- 'pass-sheet', 'admin', ...
  consented_at  TEXT NOT NULL,
  withdrawn_at  TEXT
);
