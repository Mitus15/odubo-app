-- Discount Codes Management
-- Migration 080

-- Create discounts table
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'bogo', 'free_shipping')),
  value INTEGER NOT NULL DEFAULT 0, -- For percentage: 10 = 10%, for fixed: cents
  description TEXT,

  -- Status management
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'scheduled', 'expired', 'disabled')),

  -- Usage limits
  usage_count INTEGER NOT NULL DEFAULT 0,
  usage_limit INTEGER, -- NULL = unlimited
  usage_per_customer INTEGER DEFAULT 1, -- How many times a customer can use it

  -- Date restrictions
  start_date TEXT NOT NULL,
  end_date TEXT,

  -- Purchase restrictions
  min_purchase_cents INTEGER, -- Minimum order total in cents
  max_discount_cents INTEGER, -- Cap on discount amount

  -- Product restrictions (JSON arrays of product handles)
  applies_to TEXT DEFAULT 'all', -- 'all', 'specific_products', 'specific_collections'
  product_handles TEXT, -- JSON array
  collection_handles TEXT, -- JSON array
  excluded_products TEXT, -- JSON array

  -- Customer restrictions
  customer_restriction TEXT DEFAULT 'all', -- 'all', 'new_customers', 'returning_customers', 'specific'
  specific_customer_emails TEXT, -- JSON array

  -- Combination rules
  can_combine_with_other_discounts INTEGER DEFAULT 0,

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index for code lookup
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_discounts_status ON discounts(status);

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(start_date, end_date);

-- Create discount redemptions table for tracking individual uses
CREATE TABLE IF NOT EXISTS discount_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discount_id TEXT NOT NULL,
  order_id TEXT, -- Shopify order ID
  customer_email TEXT,
  discount_amount_cents INTEGER NOT NULL,
  order_total_cents INTEGER,
  redeemed_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (discount_id) REFERENCES discounts(id)
);

-- Create index for discount redemption lookups
CREATE INDEX IF NOT EXISTS idx_redemptions_discount ON discount_redemptions(discount_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON discount_redemptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_redemptions_date ON discount_redemptions(redeemed_at);
