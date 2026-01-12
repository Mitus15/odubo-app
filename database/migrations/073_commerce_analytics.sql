-- Commerce Analytics Tables for Shopify Integration
-- Works on Basic plan, scalable to Plus

-- ============================================
-- ORDERS TABLE
-- Stores order snapshots from Shopify Admin API
-- ============================================
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  shopify_id TEXT UNIQUE NOT NULL,
  shopify_order_number INTEGER,

  -- Financial
  total_price_cents INTEGER NOT NULL DEFAULT 0,
  subtotal_price_cents INTEGER NOT NULL DEFAULT 0,
  total_tax_cents INTEGER DEFAULT 0,
  total_discounts_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',

  -- Status
  financial_status TEXT,  -- pending, paid, refunded, voided
  fulfillment_status TEXT,  -- unfulfilled, partial, fulfilled

  -- Customer (anonymized on Basic plan)
  customer_id TEXT,  -- Shopify customer ID (no PII)
  customer_hash TEXT,  -- Hash for fan profile linking

  -- Attribution
  source_name TEXT,  -- web, pos, mobile, etc.
  referring_site TEXT,
  landing_site TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Timestamps
  shopify_created_at TEXT NOT NULL,
  shopify_updated_at TEXT,
  processed_at TEXT,
  closed_at TEXT,
  cancelled_at TEXT,

  -- Sync metadata
  synced_at TEXT DEFAULT (datetime('now')),
  data_source TEXT DEFAULT 'admin_api',  -- admin_api, webhook, csv_import

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- ORDER ITEMS TABLE
-- Line item details for product analytics
-- ============================================
CREATE TABLE IF NOT EXISTS commerce_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  shopify_line_item_id TEXT,

  -- Product info
  product_id TEXT,
  product_title TEXT,
  variant_id TEXT,
  variant_title TEXT,
  sku TEXT,

  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL DEFAULT 0,
  total_discount_cents INTEGER DEFAULT 0,

  -- For clip attribution
  clip_id TEXT,  -- If purchased via clip link

  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- CUSTOMERS TABLE
-- Anonymized customer data (no PII on Basic)
-- ============================================
CREATE TABLE IF NOT EXISTS commerce_customers (
  id TEXT PRIMARY KEY,
  shopify_customer_id TEXT UNIQUE,

  -- Anonymized identifier for fan linking
  customer_hash TEXT,

  -- Aggregates (computed, no PII)
  total_orders INTEGER DEFAULT 0,
  total_spent_cents INTEGER DEFAULT 0,
  avg_order_value_cents INTEGER DEFAULT 0,

  -- Lifecycle
  first_order_at TEXT,
  last_order_at TEXT,

  -- Fan profile link (when matched)
  fan_profile_id TEXT REFERENCES fan_profiles(id),

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- DAILY METRICS TABLE
-- Pre-computed aggregates for fast dashboard queries
-- ============================================
CREATE TABLE IF NOT EXISTS commerce_daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,  -- YYYY-MM-DD

  -- Order metrics
  total_orders INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  total_items_sold INTEGER DEFAULT 0,

  -- Averages
  avg_order_value_cents INTEGER DEFAULT 0,

  -- Customer metrics
  new_customers INTEGER DEFAULT 0,
  returning_customers INTEGER DEFAULT 0,

  -- By source (JSON)
  revenue_by_source TEXT,  -- {"web": 10000, "pos": 5000}

  -- Timestamps
  computed_at TEXT DEFAULT (datetime('now')),

  UNIQUE(date)
);

-- ============================================
-- PRODUCT METRICS TABLE
-- Product-level performance aggregates
-- ============================================
CREATE TABLE IF NOT EXISTS commerce_product_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  product_title TEXT,

  -- Period
  period_start TEXT NOT NULL,  -- YYYY-MM-DD
  period_end TEXT NOT NULL,
  period_type TEXT DEFAULT 'day',  -- day, week, month

  -- Metrics
  units_sold INTEGER DEFAULT 0,
  revenue_cents INTEGER DEFAULT 0,
  orders_containing INTEGER DEFAULT 0,

  -- Computed
  avg_price_cents INTEGER DEFAULT 0,

  computed_at TEXT DEFAULT (datetime('now')),

  UNIQUE(product_id, period_start, period_type)
);

-- ============================================
-- SYNC STATUS TABLE
-- Track sync state for incremental updates
-- ============================================
CREATE TABLE IF NOT EXISTS commerce_sync_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type TEXT NOT NULL,  -- orders, products, customers

  -- Cursor for pagination
  last_cursor TEXT,
  last_synced_id TEXT,
  last_updated_at TEXT,

  -- Stats
  total_synced INTEGER DEFAULT 0,
  last_sync_count INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'idle',  -- idle, running, error
  last_error TEXT,

  started_at TEXT,
  completed_at TEXT,

  UNIQUE(sync_type)
);

-- ============================================
-- INDEXES
-- ============================================

-- Orders
CREATE INDEX IF NOT EXISTS idx_commerce_orders_shopify_id ON commerce_orders(shopify_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_customer ON commerce_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_created ON commerce_orders(shopify_created_at);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_financial ON commerce_orders(financial_status);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_source ON commerce_orders(source_name);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_commerce_items_order ON commerce_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_items_product ON commerce_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_commerce_items_variant ON commerce_order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_commerce_items_clip ON commerce_order_items(clip_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_commerce_customers_shopify ON commerce_customers(shopify_customer_id);
CREATE INDEX IF NOT EXISTS idx_commerce_customers_hash ON commerce_customers(customer_hash);
CREATE INDEX IF NOT EXISTS idx_commerce_customers_fan ON commerce_customers(fan_profile_id);

-- Daily Metrics
CREATE INDEX IF NOT EXISTS idx_commerce_daily_date ON commerce_daily_metrics(date);

-- Product Metrics
CREATE INDEX IF NOT EXISTS idx_commerce_product_period ON commerce_product_metrics(period_start, period_type);
CREATE INDEX IF NOT EXISTS idx_commerce_product_id ON commerce_product_metrics(product_id);

-- ============================================
-- INITIAL SYNC STATUS RECORDS
-- ============================================
INSERT OR IGNORE INTO commerce_sync_status (sync_type, status) VALUES ('orders', 'idle');
INSERT OR IGNORE INTO commerce_sync_status (sync_type, status) VALUES ('products', 'idle');
INSERT OR IGNORE INTO commerce_sync_status (sync_type, status) VALUES ('customers', 'idle');
