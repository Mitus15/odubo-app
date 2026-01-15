// Business Intelligence Types

// ============================================
// EXPENSE TYPES
// ============================================

export type ExpenseCategory =
  | 'advertising'
  | 'subscription'
  | 'production'
  | 'equipment'
  | 'services'
  | 'marketing'
  | 'shipping'
  | 'platform_fees'
  | 'other';

export type RecurringInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type Expense = {
  id: string;
  category: ExpenseCategory;
  name: string;
  description: string | null;
  vendor: string | null;
  amount_cents: number;
  currency: string;
  is_recurring: number; // 0 or 1
  recurring_interval: RecurringInterval | null;
  expense_date: string; // YYYY-MM-DD
  period_start: string | null;
  period_end: string | null;
  campaign_id: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseInput = {
  category: ExpenseCategory;
  name: string;
  description?: string;
  vendor?: string;
  amount_cents: number;
  currency?: string;
  is_recurring?: boolean;
  recurring_interval?: RecurringInterval;
  expense_date: string;
  period_start?: string;
  period_end?: string;
  campaign_id?: string;
  receipt_url?: string;
  notes?: string;
};

// ============================================
// PRODUCT COST TYPES (COGS)
// ============================================

export type ProductCost = {
  id: string;
  product_handle: string;
  variant_sku: string | null;
  unit_cost_cents: number;
  shipping_cost_cents: number;
  packaging_cost_cents: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductCostInput = {
  product_handle: string;
  variant_sku?: string;
  unit_cost_cents: number;
  shipping_cost_cents?: number;
  packaging_cost_cents?: number;
  effective_from: string;
  effective_to?: string;
  notes?: string;
};

// ============================================
// SOCIAL GROWTH TYPES
// ============================================

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'spotify' | 'apple_music';

export type SocialSnapshot = {
  id: string;
  platform: SocialPlatform;
  date: string;
  followers: number;
  following: number;
  posts_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  platform_data: string | null; // JSON
  entry_type: 'manual' | 'api' | 'import';
  created_at: string;
};

export type SocialSnapshotInput = {
  platform: SocialPlatform;
  date: string;
  followers?: number;
  following?: number;
  posts_count?: number;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  views_count?: number;
  platform_data?: Record<string, unknown>;
  entry_type?: 'manual' | 'api' | 'import';
};

export type SocialGrowth = {
  platform: SocialPlatform;
  currentFollowers: number;
  previousFollowers: number;
  growth: number;
  growthPercent: number;
  trend: 'up' | 'down' | 'neutral';
};

// ============================================
// AD CAMPAIGN TYPES
// ============================================

export type AdPlatform = 'meta' | 'tiktok' | 'google' | 'youtube' | 'spotify_ads' | 'other';
export type AdCampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type BudgetType = 'daily' | 'lifetime';

export type AdCampaign = {
  id: string;
  platform: AdPlatform;
  external_campaign_id: string | null;
  name: string;
  objective: string | null;
  status: AdCampaignStatus;
  budget_cents: number | null;
  budget_type: BudgetType | null;
  start_date: string;
  end_date: string | null;
  target_audience: string | null; // JSON
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AdCampaignInput = {
  platform: AdPlatform;
  external_campaign_id?: string;
  name: string;
  objective?: string;
  status?: AdCampaignStatus;
  budget_cents?: number;
  budget_type?: BudgetType;
  start_date: string;
  end_date?: string;
  target_audience?: Record<string, unknown>;
  notes?: string;
};

export type AdMetrics = {
  id: string;
  campaign_id: string;
  date: string;
  spend_cents: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number | null;
  conversions: number;
  conversion_value_cents: number;
  cpc_cents: number | null;
  cpm_cents: number | null;
  cpa_cents: number | null;
  roas: number | null;
  entry_type: 'manual' | 'api' | 'import';
  created_at: string;
};

export type AdMetricsInput = {
  campaign_id: string;
  date: string;
  spend_cents?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  conversions?: number;
  conversion_value_cents?: number;
};

// ============================================
// WEBSITE METRICS TYPES
// ============================================

export type WebsiteMetrics = {
  id: string;
  date: string;
  page_views: number;
  unique_visitors: number;
  sessions: number;
  avg_session_duration_seconds: number | null;
  bounce_rate: number | null;
  pages_per_session: number | null;
  traffic_by_source: string | null; // JSON
  traffic_by_device: string | null; // JSON
  top_pages: string | null; // JSON
  entry_type: 'manual' | 'api' | 'import';
  created_at: string;
};

export type WebsiteMetricsInput = {
  date: string;
  page_views?: number;
  unique_visitors?: number;
  sessions?: number;
  avg_session_duration_seconds?: number;
  bounce_rate?: number;
  pages_per_session?: number;
  traffic_by_source?: Record<string, number>;
  traffic_by_device?: Record<string, number>;
  top_pages?: Array<{ path: string; views: number }>;
};

// ============================================
// REPORT TYPES
// ============================================

export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type ReportStatus = 'generating' | 'ready' | 'failed';

export type BiReport = {
  id: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  report_data: string; // JSON
  generated_by: string | null;
  error_message: string | null;
  pdf_url: string | null;
  generated_at: string;
  created_at: string;
};

// Parsed report data structure
export type ReportData = {
  period: {
    start: string;
    end: string;
    type: ReportType;
  };
  financial: {
    revenue: {
      total_cents: number;
      order_count: number;
      avg_order_value_cents: number;
      by_product: Array<{
        product_handle: string;
        product_title: string;
        units_sold: number;
        revenue_cents: number;
      }>;
    };
    cogs: {
      total_cents: number;
      by_product: Array<{
        product_handle: string;
        cogs_cents: number;
      }>;
    };
    gross_profit_cents: number;
    gross_margin_percent: number;
    expenses: {
      total_cents: number;
      by_category: Array<{
        category: ExpenseCategory;
        total_cents: number;
        count: number;
      }>;
    };
    net_profit_cents: number;
    comparison?: {
      revenue_change_percent: number;
      profit_change_percent: number;
      trend: 'up' | 'down' | 'neutral';
    };
  };
  social: {
    platforms: Array<{
      platform: SocialPlatform;
      followers: number;
      growth: number;
      growth_percent: number;
      engagement: {
        likes: number;
        comments: number;
        shares: number;
        views: number;
      };
    }>;
    total_followers: number;
    total_growth: number;
    growth_percent: number;
    top_performer: SocialPlatform | null;
  };
  content: {
    clips_published: number;
    total_views: number;
    total_completions: number;
    completion_rate: number;
    top_clips: Array<{
      id: number;
      title: string;
      views: number;
      completions: number;
    }>;
  };
  advertising: {
    total_spend_cents: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    overall_roas: number | null;
    by_platform: Array<{
      platform: AdPlatform;
      spend_cents: number;
      impressions: number;
      clicks: number;
      conversions: number;
      roas: number | null;
    }>;
    campaigns: Array<{
      id: string;
      name: string;
      platform: AdPlatform;
      spend_cents: number;
      roas: number | null;
    }>;
  };
  website: {
    visitors: number;
    page_views: number;
    sessions: number;
    avg_session_duration_seconds: number | null;
    bounce_rate: number | null;
    top_sources: Array<{
      source: string;
      sessions: number;
    }>;
    top_pages: Array<{
      path: string;
      views: number;
    }>;
  };
  generated_at: string;
};

// ============================================
// SUMMARY TYPES (for dashboards)
// ============================================

export type ExpenseSummary = {
  total_cents: number;
  by_category: Record<ExpenseCategory, number>;
  recurring_monthly_cents: number;
};

export type FinancialSummary = {
  period: {
    start: string;
    end: string;
  };
  revenue_cents: number;
  cogs_cents: number;
  gross_profit_cents: number;
  gross_margin_percent: number;
  expenses_cents: number;
  net_profit_cents: number;
  net_margin_percent: number;
};

export type AdPerformanceSummary = {
  total_spend_cents: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  overall_ctr: number;
  overall_cpc_cents: number;
  overall_roas: number | null;
  active_campaigns: number;
};
