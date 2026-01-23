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
        uniqueVisitors: websiteMetrics.uniqueVisitors,
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
  uniqueVisitors: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
}

function getDefaultWebsiteMetrics(): WebsiteMetrics {
  return { visitors: 0, uniqueVisitors: 0, sessions: 0, pageViews: 0, avgSessionDuration: 0, bounceRate: 0 };
}

async function getWebsiteMetrics(startDate: string, endDate?: string): Promise<WebsiteMetrics | null> {
  try {
    const endDateStr = endDate || new Date().toISOString().split('T')[0];

    // Query fan_activity directly (bi_website_metrics is empty/not populated)
    // This is the authoritative source of truth for visitor/session data
    const rows = await queryDatabase(
      `SELECT
        COUNT(DISTINCT fan_id) as uniqueVisitors,
        COUNT(DISTINCT fan_id) as visitors,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(CASE WHEN activity_type IN ('page_view', 'site_visit') THEN 1 END) as pageViews
       FROM fan_activity
       WHERE date(created_at) >= ? AND date(created_at) <= ?`,
      [startDate, endDateStr]
    );

    if (rows && rows.length > 0) {
      const row = rows[0] as any;
      return {
        visitors: row.visitors || 0,
        uniqueVisitors: row.uniqueVisitors || 0,
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
    // Generate date range with zero defaults
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

    // Fetch all daily metrics from fan_activity (primary source)
    const rows = await queryDatabase(
      `SELECT
        date(created_at) as date,
        COUNT(DISTINCT fan_id) as visitors,
        COUNT(DISTINCT session_id) as sessions,
        SUM(CASE WHEN activity_type IN ('page_view', 'site_visit') THEN 1 ELSE 0 END) as pageViews,
        SUM(CASE WHEN activity_type = 'clip_view' THEN 1 ELSE 0 END) as clipViews,
        SUM(CASE WHEN activity_type = 'shop_visit' THEN 1 ELSE 0 END) as shopClicks
       FROM fan_activity
       WHERE date(created_at) >= ?
       GROUP BY date(created_at)
       ORDER BY date ASC`,
      [startDate]
    );

    // Merge data into date range
    if (rows) {
      for (const row of rows as any[]) {
        const idx = result.findIndex(r => r.date === row.date);
        if (idx >= 0) {
          result[idx].visitors = row.visitors || 0;
          result[idx].sessions = row.sessions || 0;
          result[idx].pageViews = row.pageViews || 0;
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

    // Get revenue from webhook-synced Shopify orders (immune to AdBlockers)
    const revenueRows = await queryDatabase(
      `SELECT COALESCE(SUM(total_price_cents), 0) as revenue
       FROM commerce_orders
       WHERE financial_status = 'paid'
         AND date(shopify_created_at) >= ?`,
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
    const result = {
      store: { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
      moments: { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
      media: { opens: 0, avgDurationSeconds: 0, bounceRate: 0 },
    };

    // Get opens from modal_open events
    const openRows = await queryDatabase(
      `SELECT
        JSON_EXTRACT(metadata, '$.modalType') as modalType,
        COUNT(*) as opens
       FROM fan_activity
       WHERE date(created_at) >= ?
         AND activity_type = 'modal_open'
       GROUP BY JSON_EXTRACT(metadata, '$.modalType')`,
      [startDate]
    );

    // Get duration and bounce data from modal_close events (where duration is stored)
    const closeRows = await queryDatabase(
      `SELECT
        JSON_EXTRACT(metadata, '$.modalType') as modalType,
        AVG(CAST(JSON_EXTRACT(metadata, '$.durationMs') AS REAL)) / 1000.0 as avgDurationSeconds,
        SUM(CASE WHEN JSON_EXTRACT(metadata, '$.isQuickBounce') = 1 THEN 1 ELSE 0 END) as bounces,
        COUNT(*) as total
       FROM fan_activity
       WHERE date(created_at) >= ?
         AND activity_type = 'modal_close'
       GROUP BY JSON_EXTRACT(metadata, '$.modalType')`,
      [startDate]
    );

    // Map modal_open counts
    if (openRows) {
      for (const row of openRows as any[]) {
        const modalType = row.modalType?.toLowerCase();
        if (modalType === 'store') {
          result.store.opens = row.opens || 0;
        } else if (modalType === 'moments' || modalType === 'gallery') {
          result.moments.opens = row.opens || 0;
        } else if (modalType === 'media' || modalType === 'video') {
          result.media.opens = row.opens || 0;
        }
      }
    }

    // Map modal_close duration and bounce rate
    if (closeRows) {
      for (const row of closeRows as any[]) {
        const modalType = row.modalType?.toLowerCase();
        let category: 'store' | 'moments' | 'media' | null = null;

        if (modalType === 'store') {
          category = 'store';
        } else if (modalType === 'moments' || modalType === 'gallery') {
          category = 'moments';
        } else if (modalType === 'media' || modalType === 'video') {
          category = 'media';
        }

        if (category) {
          result[category].avgDurationSeconds = row.avgDurationSeconds || 0;
          result[category].bounceRate = row.total > 0 ? ((row.bounces || 0) / row.total) * 100 : 0;
        }
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
    // Query clip views from fan_activity, join with videos for titles
    const rows = await queryDatabase(
      `SELECT
        fa.content_id as id,
        COALESCE(fa.content_title, v.title, 'Untitled') as title,
        COUNT(CASE WHEN fa.activity_type = 'clip_view' THEN 1 END) as views,
        COUNT(CASE WHEN fa.activity_type = 'clip_complete' THEN 1 END) as completions,
        COUNT(CASE WHEN fa.activity_type = 'shop_visit' AND fa.content_type = 'clip' THEN 1 END) as shopClicks
       FROM fan_activity fa
       LEFT JOIN videos v ON CAST(fa.content_id AS INTEGER) = v.id
       WHERE date(fa.created_at) >= ?
         AND fa.activity_type IN ('clip_view', 'clip_complete', 'shop_visit')
         AND fa.content_id IS NOT NULL
       GROUP BY fa.content_id
       ORDER BY views DESC
       LIMIT 5`,
      [startDate]
    );

    if (!rows) return [];

    return (rows as any[]).map(row => {
      // content_id is a path like "/clips/123" - extract the numeric ID
      let clipId = 0;
      if (typeof row.id === 'string') {
        const match = row.id.match(/\/clips\/(\d+)/);
        if (match) {
          clipId = parseInt(match[1], 10) || 0;
        } else {
          clipId = parseInt(row.id, 10) || 0;
        }
      } else {
        clipId = row.id || 0;
      }

      return {
        id: clipId,
        title: row.title || 'Untitled',
        views: row.views || 0,
        completions: row.completions || 0,
        shopClicks: row.shopClicks || 0,
      };
    });
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
