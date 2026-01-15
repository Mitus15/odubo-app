-- Business Intelligence & Reporting System
-- Enables weekly reports, financial tracking, social growth, and ad campaign management

-- ============================================
-- EXPENSES TABLE
-- Track all business expenses (subscriptions, ad spend, operational costs)
-- ============================================
CREATE TABLE IF NOT EXISTS bi_expenses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'advertising',        -- Meta Ads, TikTok Ads, Google Ads
    'subscription',       -- Software subscriptions (Spotify for Artists, etc.)
    'production',         -- Music production, video production
    'equipment',          -- Gear, hardware
    'services',           -- Freelancers, contractors
    'marketing',          -- Non-ad marketing costs
    'shipping',           -- Fulfillment costs
    'platform_fees',      -- Shopify fees, payment processing
    'other'
  )),

  -- Details
  name TEXT NOT NULL,               -- e.g., "Meta Ads - January Campaign"
  description TEXT,
  vendor TEXT,                      -- e.g., "Meta", "Shopify", "DistroKid"

  -- Financial
  amount_cents INTEGER NOT NULL,    -- Store in cents to avoid float issues
  currency TEXT DEFAULT 'CAD',

  -- Recurrence
  is_recurring INTEGER DEFAULT 0,
  recurring_interval TEXT CHECK (recurring_interval IN ('weekly', 'monthly', 'quarterly', 'yearly')),

  -- Timing
  expense_date TEXT NOT NULL,       -- YYYY-MM-DD
  period_start TEXT,                -- For recurring: billing period start
  period_end TEXT,                  -- For recurring: billing period end

  -- Linking
  campaign_id TEXT,                 -- Link to ad campaigns if applicable

  -- Metadata
  receipt_url TEXT,                 -- R2 URL for receipt/invoice
  notes TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- PRODUCT COSTS TABLE
-- COGS per product for profit calculations
-- ============================================
CREATE TABLE IF NOT EXISTS bi_product_costs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Product linking (to Shopify products via handle)
  product_handle TEXT NOT NULL,     -- Matches products.handle
  variant_sku TEXT,                 -- Optional: specific variant SKU

  -- Cost components
  unit_cost_cents INTEGER NOT NULL, -- Cost per unit in cents
  shipping_cost_cents INTEGER DEFAULT 0,
  packaging_cost_cents INTEGER DEFAULT 0,

  -- Validity period (for historical tracking when costs change)
  effective_from TEXT NOT NULL,     -- YYYY-MM-DD
  effective_to TEXT,                -- NULL = current

  notes TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(product_handle, variant_sku, effective_from)
);

-- ============================================
-- SOCIAL SNAPSHOTS TABLE
-- Daily social platform metrics (followers, engagement)
-- ============================================
CREATE TABLE IF NOT EXISTS bi_social_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Platform
  platform TEXT NOT NULL CHECK (platform IN (
    'instagram', 'tiktok', 'youtube', 'twitter', 'spotify', 'apple_music'
  )),

  -- Date
  date TEXT NOT NULL,               -- YYYY-MM-DD

  -- Audience
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,      -- Where applicable

  -- Engagement (daily aggregates)
  posts_count INTEGER DEFAULT 0,    -- Posts published that day
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,

  -- Platform-specific (JSON for Spotify monthly_listeners, YouTube subscribers, etc.)
  platform_data TEXT,

  -- Entry type
  entry_type TEXT DEFAULT 'manual' CHECK (entry_type IN ('manual', 'api', 'import')),

  created_at TEXT DEFAULT (datetime('now')),

  UNIQUE(platform, date)
);

-- ============================================
-- AD CAMPAIGNS TABLE
-- Track ad campaigns (Meta, TikTok)
-- ============================================
CREATE TABLE IF NOT EXISTS bi_ad_campaigns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Platform
  platform TEXT NOT NULL CHECK (platform IN (
    'meta', 'tiktok', 'google', 'youtube', 'spotify_ads', 'other'
  )),

  -- Campaign info
  external_campaign_id TEXT,        -- Platform's campaign ID
  name TEXT NOT NULL,
  objective TEXT,                   -- awareness, engagement, traffic, conversions, etc.
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),

  -- Budget
  budget_cents INTEGER,
  budget_type TEXT CHECK (budget_type IN ('daily', 'lifetime')),

  -- Timing
  start_date TEXT NOT NULL,
  end_date TEXT,

  -- Target (JSON description of targeting)
  target_audience TEXT,

  notes TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- AD METRICS TABLE
-- Daily ad performance metrics
-- ============================================
CREATE TABLE IF NOT EXISTS bi_ad_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  campaign_id TEXT NOT NULL,
  date TEXT NOT NULL,               -- YYYY-MM-DD

  -- Spend
  spend_cents INTEGER DEFAULT 0,

  -- Reach
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,

  -- Engagement
  clicks INTEGER DEFAULT 0,
  ctr REAL,                         -- Click-through rate

  -- Conversions
  conversions INTEGER DEFAULT 0,
  conversion_value_cents INTEGER DEFAULT 0,

  -- Cost metrics
  cpc_cents INTEGER,                -- Cost per click
  cpm_cents INTEGER,                -- Cost per 1000 impressions
  cpa_cents INTEGER,                -- Cost per acquisition
  roas REAL,                        -- Return on ad spend

  -- Entry type
  entry_type TEXT DEFAULT 'manual' CHECK (entry_type IN ('manual', 'api', 'import')),

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (campaign_id) REFERENCES bi_ad_campaigns(id) ON DELETE CASCADE,
  UNIQUE(campaign_id, date)
);

-- ============================================
-- WEBSITE METRICS TABLE
-- Daily website analytics
-- ============================================
CREATE TABLE IF NOT EXISTS bi_website_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  date TEXT NOT NULL,               -- YYYY-MM-DD

  -- Traffic
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,

  -- Engagement
  avg_session_duration_seconds INTEGER,
  bounce_rate REAL,
  pages_per_session REAL,

  -- By source (JSON)
  traffic_by_source TEXT,           -- { "organic": 100, "social": 50, "direct": 30 }
  traffic_by_device TEXT,           -- { "mobile": 60, "desktop": 40 }

  -- Top pages (JSON)
  top_pages TEXT,                   -- [{ "path": "/store", "views": 100 }]

  -- Entry type
  entry_type TEXT DEFAULT 'manual' CHECK (entry_type IN ('manual', 'api', 'import')),

  created_at TEXT DEFAULT (datetime('now')),

  UNIQUE(date)
);

-- ============================================
-- REPORTS TABLE
-- Generated report snapshots
-- ============================================
CREATE TABLE IF NOT EXISTS bi_reports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Report type
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),

  -- Period
  period_start TEXT NOT NULL,       -- YYYY-MM-DD
  period_end TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),

  -- Data (JSON snapshot at time of generation)
  report_data TEXT NOT NULL,        -- Full JSON report data

  -- Metadata
  generated_by TEXT,
  error_message TEXT,

  -- For PDF storage
  pdf_url TEXT,                     -- R2 URL if PDF generated

  generated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES
-- ============================================

-- Expenses
CREATE INDEX IF NOT EXISTS idx_bi_expenses_date ON bi_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_bi_expenses_category ON bi_expenses(category);
CREATE INDEX IF NOT EXISTS idx_bi_expenses_vendor ON bi_expenses(vendor);

-- Product Costs
CREATE INDEX IF NOT EXISTS idx_bi_product_costs_handle ON bi_product_costs(product_handle);
CREATE INDEX IF NOT EXISTS idx_bi_product_costs_effective ON bi_product_costs(effective_from, effective_to);

-- Social Snapshots
CREATE INDEX IF NOT EXISTS idx_bi_social_platform_date ON bi_social_snapshots(platform, date);
CREATE INDEX IF NOT EXISTS idx_bi_social_date ON bi_social_snapshots(date);

-- Ad Campaigns
CREATE INDEX IF NOT EXISTS idx_bi_campaigns_platform ON bi_ad_campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_bi_campaigns_status ON bi_ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_bi_campaigns_dates ON bi_ad_campaigns(start_date, end_date);

-- Ad Metrics
CREATE INDEX IF NOT EXISTS idx_bi_ad_metrics_campaign ON bi_ad_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bi_ad_metrics_date ON bi_ad_metrics(date);
CREATE INDEX IF NOT EXISTS idx_bi_ad_metrics_campaign_date ON bi_ad_metrics(campaign_id, date);

-- Website Metrics
CREATE INDEX IF NOT EXISTS idx_bi_website_date ON bi_website_metrics(date);

-- Reports
CREATE INDEX IF NOT EXISTS idx_bi_reports_type ON bi_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_bi_reports_period ON bi_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_bi_reports_status ON bi_reports(status);
