-- 165 — the claim link, and the pass number.
--
-- THE LINK. The pass email used to say "open /loop/album and enter this email
-- address", and the link carried nothing, so a buyer who had just paid landed
-- on "the record is for people who pre-ordered it", typed their address again,
-- waited for six digits, and typed those back. Seven taps to hear a song they
-- had bought two minutes earlier. The email itself proves the inbox exactly as
-- the six digits do, so its link may bind the phone. Only the hash of a token
-- is stored; the plaintext lives in one email. Several rows per code are fine
-- (a resend mints a new one and revokes the old).
--
-- THE NUMBER. A ticket is an object; "LOOP-K7X2" is a database key. Real
-- orders get a running number per event (Nº 001 …) that reads like an edition.
-- Simulated purchases (order_id 'sim:…') never take a number, so the count
-- on the tickets is the count of people.
ALTER TABLE event_codes ADD COLUMN serial INTEGER;

UPDATE event_codes
   SET serial = (
     SELECT COUNT(*) FROM event_codes o
      WHERE o.event_id = event_codes.event_id
        AND o.order_id IS NOT NULL
        AND o.order_id NOT LIKE 'sim:%'
        AND o.rowid <= event_codes.rowid
   )
 WHERE order_id IS NOT NULL
   AND order_id NOT LIKE 'sim:%'
   AND serial IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_codes_serial ON event_codes(event_id, serial);

CREATE TABLE IF NOT EXISTS loop_pass_links (
  token_hash      TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL,
  code            TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  first_opened_at INTEGER,
  opens           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_loop_pass_links_code ON loop_pass_links(event_id, code);
