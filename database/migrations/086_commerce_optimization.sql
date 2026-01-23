-- Phase 4: Commerce Optimization
-- Server-side cart persistence and gallery product linking

-- 1. Server-side cart for cross-device persistence
CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,                    -- UUID
  visitor_id TEXT NOT NULL,               -- From analytics fingerprint
  items TEXT NOT NULL DEFAULT '[]',       -- JSON array of cart items
  subtotal_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  checkout_url TEXT,                      -- For abandoned cart recovery
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_carts_visitor ON carts(visitor_id);
CREATE INDEX IF NOT EXISTS idx_carts_updated ON carts(updated_at);

-- 2. Product linking for galleries/moments
ALTER TABLE galleries ADD COLUMN shopify_product_id TEXT;
ALTER TABLE galleries ADD COLUMN shopify_product_handle TEXT;
