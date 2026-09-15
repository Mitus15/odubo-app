-- 160 — proving an inbox, so a ticket can follow its owner to a new phone.
--
-- A pass was welded to the first browser that used it. Open the flyer in
-- Instagram's browser, redeem there, open Safari later: "already in use on
-- another device", and the room, the votes and Legacy were gone. The recovery
-- the identity doc promised (rung 4: a code sent to the checkout address) was
-- never wired, and the lookup page handed the raw pass code to anyone who
-- typed the right email.
--
-- This table is the proof step. A six-digit code goes to the checkout address;
-- typing it back is what makes this device the buyer's. The code is stored
-- hashed, expires in fifteen minutes, and burns after five wrong tries.
CREATE TABLE IF NOT EXISTS loop_email_verifications (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,              -- lowercase, trimmed
  code_hash   TEXT NOT NULL,              -- sha256(email | code | pepper)
  voter_id    TEXT NOT NULL,              -- the device that asked
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL,           -- epoch ms
  consumed_at INTEGER,                    -- epoch ms; set on success or burn
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loop_email_verifications_email
  ON loop_email_verifications(email, created_at DESC);
