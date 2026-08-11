-- 146: loop_settings — Loop Soul's generic key-value settings store.
--
-- First consumer: pass sales (checkout URL, Shopify product matcher, capacity
-- mode) so the owner configures ticketing from /loop/admin instead of Vercel
-- env vars. Env vars remain as fallbacks; D1 wins when a key is present.
--
-- APPLIED TO REMOTE D1 via scripts/loop/apply_146_loop_settings.ts.

CREATE TABLE IF NOT EXISTS loop_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
