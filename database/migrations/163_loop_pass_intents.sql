-- Who is about to buy a pass.
--
-- Shopify Basic does not grant the app access to Protected Customer Data, so a
-- paid order arrives with email, phone and customer all null. The address is
-- therefore collected on OUR side, one field, before the buyer is handed to
-- Shopify's checkout (which we prefill with it, so nobody types it twice).
--
-- The token travels to Shopify as a cart attribute and comes back on the order
-- as a note_attribute, which IS readable without PII access. If it ever fails
-- to come back, the row is still here with its timestamp, and the admin can
-- match it to the order in one tap rather than digging through Shopify.
CREATE TABLE IF NOT EXISTS loop_pass_intents (
  token       TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  order_id    TEXT                -- set when an order claims this intent
);
CREATE INDEX IF NOT EXISTS idx_loop_pass_intents_open
  ON loop_pass_intents (event_id, created_at DESC);
