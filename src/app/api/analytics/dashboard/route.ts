import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DashboardQuery {
  days?: string;
  compare?: string;
}

interface DailyTrend {
  date: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  clipViews: number;
  shopClicks: number;
}

interface TrafficSource {
  source: string;
  sessions: number;
  percentage: number;
}

interface TopPage {
  path: string;
  views: number;
  avgTime: number;
}

interface TopClip {
  id: number;
  title: string;
  views: number;
  completions: number;
  shopClicks: number;
}

interface TopProduct {
  handle: string;
  views: number;
  addToCarts: number;
  purchases: number;
}

interface ModalMetrics {
  opens: number;
  avgDurationSeconds: number;
  bounceRate: number;
}

/**
 * GET /api/analytics/dashboard
 * Returns comprehensive analytics data for the dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const compare = searchParams.get('compare') === 'true';

    // Calculate date ranges
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Previous period for comparison
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);
    const prevStartDateStr = prevStartDate.toISOString().split('T')[0];
    const prevEndDateStr = prevEndDate.toISOString().split('T')[0];

    // Run all queries in parallel
    const [
      websiteMetricsResult,
      prevWebsiteMetricsResult,
      dailyTrendResult,
      trafficSourcesResult,
      topPagesResult,
      funnelResult,
      modalMetricsResult,
      topClipsResult,
      topProductsResult,
    ] = await Promise.all([
      // Website metrics for current period
      getWebsiteMetrics(startDateStr),
      // Website metrics for previous period (if comparing)
      compare ? getWebsiteMetrics(prevStartDateStr, prevEndDateStr) : null,
      // Daily trend
      getDailyTrend(startDateStr, days),
      // Traffic sources
      getTrafficSources(startDateStr),
      // Top pages
      getTopPages(startDateStr),
      // Funnel data
      getFunnelData(startDateStr),
      // Modal engagement metrics
      getModalMetrics(startDateStr),
      // Top clips
      getTopClips(startDateStr),
      // Top products
      getTopProducts(startDateStr),
    ]);

    // Calculate changes
    const websiteMetrics = websiteMetricsResult || getDefaultWebsiteMetrics();
    const prevWebsiteMetrics = prevWebsiteMetricsResult || getDefaultWebsiteMetrics();

    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return NextResponse.json({
      // Summary metrics
      summary: {
        visitors: websiteMetrics.visitors,
        sessions: websiteMetrics.sessions,
        pageViews: websiteMetrics.pageViews,
        avgSessionDuration: websiteMetrics.avgSessionDuration,
        bounceRate: websiteMetrics.bounceRate,
      },

      // Comparison with previous period
      comparison: compare ? {
        visitorsChange: calculateChange(websiteMetrics.visitors, prevWebsiteMetrics.visitors),
        sessionsChange: calculateChange(websiteMetrics.sessions, prevWebsiteMetrics.sessions),
        pageViewsChange: calculateChange(websiteMetrics.pageViews, prevWebsiteMetrics.pageViews),
      } : null,

      // Daily trend data for charts
      dailyTrend: dailyTrendResult || [],

      // Traffic sources
      trafficSources: trafficSourcesResult || [],

      // Top pages
      topPages: topPagesResult || [],

      // Funnel metrics
      funnel: funnelResult || {
        clipViews: 0,
        clipCompletions: 0,
        shopClicks: 0,
        productViews: 0,
        addToCarts: 0,
        checkoutStarts: 0,
        purchases: 0,
        revenue: 0,
      },

      // Modal engagement
      modals: {
        store: modalMetricsResult?.store || { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
        moments: modalMetricsResult?.moments || { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
        media: modalMetricsResult?.media || { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
      },

      // Top performers
      topClips: topClipsResult || [],
      topProducts: topProductsResult || [],

      // Metadata
      meta: {
        period: { days, startDate: startDateStr, endDate: now.toISOString().split('T')[0] },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// ============================================
// Data Fetching Functions
// ============================================

interface WebsiteMetrics {
  visitors: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
}

function getDefaultWebsiteMetrics(): WebsiteMetrics {
  return { visitors: 0, sessions: 0, pageViews: 0, avgSessionDuration: 0, bounceRate: 0 };
}

async function getWebsiteMetrics(startDate: string, endDate?: string): Promise<WebsiteMetrics | null> {
  try {
    const endDateStr = endDate || new Date().toISOString().split('T')[0];

    // Get from bi_website_metrics if available
    const rows = await queryDatabase(
      `SELECT
        COALESCE(SUM(unique_visitors), 0) as visitors,
        COALESCE(SUM(sessions), 0) as sessions,
        COALESCE(SUM(page_views), 0) as pageViews,
        COALESCE(AVG(avg_session_duration_seconds), 0) as avgSessionDuration,
        COALESCE(AVG(bounce_rate), 0) as bounceRate
       FROM bi_website_metrics
       WHERE date >= ? AND date <= ?`,
      [startDate, endDateStr]
    );

    if (rows && rows.length > 0) {
      const row = rows[0] as any;
      return {
        visitors: row.visitors || 0,
        sessions: row.sessions || 0,
        pageViews: row.pageViews || 0,
        avgSessionDuration: row.avgSessionDuration || 0,
        bounceRate: row.bounceRate || 0,
      };
    }

    // Fallback: calculate from fan_activity
    const activityRows = await queryDatabase(
      `SELECT
        COUNT(DISTINCT fan_id) as visitors,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(*) as pageViews
       FROM fan_activity
       WHERE date(created_at) >= ? AND date(created_at) <= ?
         AND activity_type IN ('page_view', 'site_visit')`,
      [startDate, endDateStr]
    );

    if (activityRows && activityRows.length > 0) {
      const row = activityRows[0] as any;
      return {
        visitors: row.visitors || 0,
        sessions: row.sessions || 0,
        pageViews: row.pageViews || 0,
        avgSessionDuration: 0,
        bounceRate: 0,
      };
    }

    return null;
  } catch (err) {
    console.error('Error fetching website metrics:', err);
    return null;
  }
}

async function getDailyTrend(startDate: string, days: number): Promise<DailyTrend[]> {
  try {
    // Generate date range
    const result: DailyTrend[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      result.push({
        date: dateStr,
        visitors: 0,
        sessions: 0,
        pageViews: 0,
        clipViews: 0,
        shopClicks: 0,
      });
    }

    // Fetch from bi_website_metrics
    const rows = await queryDatabase(
      `SELECT date, unique_visitors, sessions, page_views
       FROM bi_website_metrics
       WHERE date >= ?
       ORDER BY date ASC`,
      [startDate]
    );

    // Merge data
    if (rows) {
      for (const row of rows as any[]) {
        const idx = result.findIndex(r => r.date === row.date);
        if (idx >= 0) {
          result[idx].visitors = row.unique_visitors || 0;
          result[idx].sessions = row.sessions || 0;
          result[idx].pageViews = row.page_views || 0;
        }
      }
    }

    // Fetch activity counts per day from fan_activity
    const activityRows = await queryDatabase(
      `SELECT
        date(created_at) as date,
        SUM(CASE WHEN activity_type = 'clip_view' THEN 1 ELSE 0 END) as clipViews,
        SUM(CASE WHEN activity_type = 'shop_visit' THEN 1 ELSE 0 END) as shopClicks
       FROM fan_activity
       WHERE date(created_at) >= ?
       GROUP BY date(created_at)`,
      [startDate]
    );

    if (activityRows) {
      for (const row of activityRows as any[]) {
        const idx = result.findIndex(r => r.date === row.date);
        if (idx >= 0) {
          result[idx].clipViews = row.clipViews || 0;
          result[idx].shopClicks = row.shopClicks || 0;
        }
      }
    }

    return result;
  } catch (err) {
    console.error('Error fetching daily trend:', err);
    return [];
  }
}

async function getTrafficSources(startDate: string): Promise<TrafficSource[]> {
  try {
    const rows = await queryDatabase(
      `SELECT
        COALESCE(source, 'direct') as source,
        COUNT(DISTINCT session_id) as sessions
       FROM fan_activity
       WHERE date(created_at) >= ?
       GROUP BY source
       ORDER BY sessions DESC
       LIMIT 10`,
      [startDate]
    );

    if (!rows || rows.length === 0) return [];

    const totalSessions = (rows as any[]).reduce((sum, r) => sum + (r.sessions || 0), 0);

    return (rows as any[]).map(row => ({
      source: row.source || 'direct',
      sessions: row.sessions || 0,
      percentage: totalSessions > 0 ? ((row.sessions || 0) / totalSessions) * 100 : 0,
    }));
  } catch (err) {
    console.error('Error fetching traffic sources:', err);
    return [];
  }
}

async function getTopPages(startDate: string): Promise<TopPage[]> {
  try {
    const rows = await queryDatabase(
      `SELECT
        content_id as path,
        COUNT(*) as views,
        AVG(duration_seconds) as avgTime
       FROM fan_activity
       WHERE date(created_at) >= ?
         AND activity_type = 'page_view'
       GROUP BY content_id
       ORDER BY views DESC
       LIMIT 10`,
      [startDate]
    );

    if (!rows) return [];

    return (rows as any[]).map(row => ({
      path: row.path || '/',
      views: row.views || 0,
      avgTime: row.avgTime || 0,
    }));
  } catch (err) {
    console.error('Error fetching top pages:', err);
    return [];
  }
}

async function getFunnelData(startDate: string) {
  try {
    const rows = await queryDatabase(
      `SELECT
        activity_type,
        COUNT(*) as count
       FROM fan_activity
       WHERE date(created_at) >= ?
       GROUP BY activity_type`,
      [startDate]
    );

    if (!rows) return null;

    const counts: Record<string, number> = {};
    for (const row of rows as any[]) {
      counts[row.activity_type] = row.count || 0;
    }

    // Get revenue from purchases
    const revenueRows = await queryDatabase(
      `SELECT COALESCE(SUM(value_cents), 0) as revenue
       FROM fan_activity
       WHERE date(created_at) >= ?
         AND activity_type = 'purchase'`,
      [startDate]
    );

    const revenue = revenueRows && revenueRows.length > 0 ? (revenueRows[0] as any).revenue || 0 : 0;

    return {
      clipViews: counts['clip_view'] || 0,
      clipCompletions: counts['clip_complete'] || 0,
      shopClicks: counts['shop_visit'] || 0,
      productViews: counts['product_view'] || 0,
      addToCarts: counts['add_to_cart'] || 0,
      checkoutStarts: counts['page_view'] || 0, // Checkout pages tracked as page_view
      purchases: counts['purchase'] || 0,
      revenue,
    };
  } catch (err) {
    console.error('Error fetching funnel data:', err);
    return null;
  }
}

async function getModalMetrics(startDate: string): Promise<{ store: ModalMetrics; moments: ModalMetrics; media: ModalMetrics } | null> {
  try {
    // Get modal opens and durations from fan_activity metadata
    const rows = await queryDatabase(
      `SELECT
        content_type,
        COUNT(*) as opens,
        AVG(duration_seconds) as avgDuration,
        SUM(CASE WHEN duration_seconds < 5 THEN 1 ELSE 0 END) as bounces
       FROM fan_activity
       WHERE date(created_at) >= ?
         AND activity_type = 'shop_visit'
       GROUP BY content_type`,
      [startDate]
    );

    const result = {
      store: { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
      moments: { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
      media: { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
    };

    if (!rows) return result;

    for (const row of rows as any[]) {
      const type = row.content_type as 'store' | 'moments' | 'media';
      if (type === 'store' || type === 'moments' || type === 'media') {
        result[type] = {
          opens: row.opens || 0,
          avgDurationSeconds: row.avgDuration || 0,
          bounceRate: row.opens > 0 ? ((row.bounces || 0) / row.opens) * 100 : 0,
        };
      }
    }

    return result;
  } catch (err) {
    console.error('Error fetching modal metrics:', err);
    return null;
  }
}

async function getTopClips(startDate: string): Promise<TopClip[]> {
  try {
    const rows = await queryDatabase(
      `SELECT
        ce.clip_id as id,
        v.title,
        ce.view_count as views,
        ce.completion_count as completions,
        ce.shop_click_count as shopClicks
       FROM clip_engagement ce
       LEFT JOIN videos v ON ce.clip_id = v.id
       ORDER BY ce.view_count DESC
       LIMIT 5`
    );

    if (!rows) return [];

    return (rows as any[]).map(row => ({
      id: row.id,
      title: row.title || 'Untitled',
      views: row.views || 0,
      completions: row.completions || 0,
      shopClicks: row.shopClicks || 0,
    }));
  } catch (err) {
    console.error('Error fetching top clips:', err);
    return [];
  }
}

async function getTopProducts(startDate: string): Promise<TopProduct[]> {
  try {
    const rows = await queryDatabase(
      `SELECT
        content_id as handle,
        SUM(CASE WHEN activity_type = 'product_view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN activity_type = 'add_to_cart' THEN 1 ELSE 0 END) as addToCarts,
        SUM(CASE WHEN activity_type = 'purchase' THEN 1 ELSE 0 END) as purchases
       FROM fan_activity
       WHERE date(created_at) >= ?
         AND content_type = 'product'
       GROUP BY content_id
       ORDER BY views DESC
       LIMIT 5`,
      [startDate]
    );

    if (!rows) return [];

    return (rows as any[]).map(row => ({
      handle: row.handle || 'unknown',
      views: row.views || 0,
      addToCarts: row.addToCarts || 0,
      purchases: row.purchases || 0,
    }));
  } catch (err) {
    console.error('Error fetching top products:', err);
    return [];
  }
}
