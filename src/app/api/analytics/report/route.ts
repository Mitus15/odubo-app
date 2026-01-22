import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ReportRequest {
  type: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  startDate?: string;
  endDate?: string;
}

/**
 * POST /api/analytics/report
 * Generate and save a report snapshot
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ReportRequest;
    const { type, startDate: customStart, endDate: customEnd } = body;

    // Calculate date range based on type
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (type) {
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'yearly':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'custom':
        if (!customStart || !customEnd) {
          return NextResponse.json({ error: 'Custom dates required' }, { status: 400 });
        }
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Generate report data
    const reportData = await generateReportData(startDateStr, endDateStr);

    // Generate report ID
    const reportId = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');

    // Save to bi_reports table
    await executeQuery(
      `INSERT INTO bi_reports (id, report_type, period_start, period_end, status, report_data, generated_at)
       VALUES (?, ?, ?, ?, 'ready', ?, datetime('now'))`,
      [reportId, type, startDateStr, endDateStr, JSON.stringify(reportData)]
    );

    return NextResponse.json({
      reportId,
      type,
      period: { startDate: startDateStr, endDate: endDateStr },
      summary: reportData.summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Report API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/analytics/report
 * List recent reports or get a specific report by ID
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (reportId) {
      // Get specific report
      const rows = await queryDatabase(
        `SELECT * FROM bi_reports WHERE id = ?`,
        [reportId]
      );

      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      const report = rows[0] as any;
      return NextResponse.json({
        report: {
          id: report.id,
          type: report.report_type,
          period: { startDate: report.period_start, endDate: report.period_end },
          status: report.status,
          data: JSON.parse(report.report_data || '{}'),
          generatedAt: report.generated_at,
        },
      });
    }

    // List recent reports
    const rows = await queryDatabase(
      `SELECT id, report_type, period_start, period_end, status, generated_at
       FROM bi_reports
       WHERE status = 'ready'
       ORDER BY generated_at DESC
       LIMIT ?`,
      [limit]
    );

    const reports = (rows || []).map((r: any) => ({
      id: r.id,
      type: r.report_type,
      period: { startDate: r.period_start, endDate: r.period_end },
      status: r.status,
      generatedAt: r.generated_at,
    }));

    return NextResponse.json({ reports });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Get reports API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

async function generateReportData(startDate: string, endDate: string): Promise<any> {
  // Get website metrics
  const websiteRows = await queryDatabase(
    `SELECT
      COALESCE(SUM(unique_visitors), 0) as totalVisitors,
      COALESCE(SUM(sessions), 0) as totalSessions,
      COALESCE(SUM(page_views), 0) as totalPageViews,
      COALESCE(AVG(avg_session_duration_seconds), 0) as avgSessionDuration,
      COALESCE(AVG(bounce_rate), 0) as avgBounceRate
     FROM bi_website_metrics
     WHERE date >= ? AND date <= ?`,
    [startDate, endDate]
  );

  const website = websiteRows && websiteRows.length > 0 ? websiteRows[0] as any : {
    totalVisitors: 0,
    totalSessions: 0,
    totalPageViews: 0,
    avgSessionDuration: 0,
    avgBounceRate: 0,
  };

  // Get funnel metrics from fan_activity
  const funnelRows = await queryDatabase(
    `SELECT
      SUM(CASE WHEN activity_type = 'clip_view' THEN 1 ELSE 0 END) as clipViews,
      SUM(CASE WHEN activity_type = 'clip_complete' THEN 1 ELSE 0 END) as clipCompletions,
      SUM(CASE WHEN activity_type = 'shop_visit' THEN 1 ELSE 0 END) as shopClicks,
      SUM(CASE WHEN activity_type = 'product_view' THEN 1 ELSE 0 END) as productViews,
      SUM(CASE WHEN activity_type = 'add_to_cart' THEN 1 ELSE 0 END) as addToCarts,
      SUM(CASE WHEN activity_type = 'purchase' THEN 1 ELSE 0 END) as purchases,
      COALESCE(SUM(CASE WHEN activity_type = 'purchase' THEN value_cents ELSE 0 END), 0) as revenue
     FROM fan_activity
     WHERE date(created_at) >= ? AND date(created_at) <= ?`,
    [startDate, endDate]
  );

  const funnel = funnelRows && funnelRows.length > 0 ? funnelRows[0] as any : {
    clipViews: 0,
    clipCompletions: 0,
    shopClicks: 0,
    productViews: 0,
    addToCarts: 0,
    purchases: 0,
    revenue: 0,
  };

  // Get traffic sources
  const sourceRows = await queryDatabase(
    `SELECT
      COALESCE(source, 'direct') as source,
      COUNT(DISTINCT session_id) as sessions
     FROM fan_activity
     WHERE date(created_at) >= ? AND date(created_at) <= ?
     GROUP BY source
     ORDER BY sessions DESC
     LIMIT 10`,
    [startDate, endDate]
  );

  // Get daily trend
  const trendRows = await queryDatabase(
    `SELECT
      date,
      unique_visitors,
      sessions,
      page_views
     FROM bi_website_metrics
     WHERE date >= ? AND date <= ?
     ORDER BY date ASC`,
    [startDate, endDate]
  );

  return {
    summary: {
      visitors: website.totalVisitors,
      sessions: website.totalSessions,
      pageViews: website.totalPageViews,
      avgSessionDuration: website.avgSessionDuration,
      bounceRate: website.avgBounceRate,
    },
    funnel: {
      clipViews: funnel.clipViews || 0,
      clipCompletions: funnel.clipCompletions || 0,
      shopClicks: funnel.shopClicks || 0,
      productViews: funnel.productViews || 0,
      addToCarts: funnel.addToCarts || 0,
      purchases: funnel.purchases || 0,
      revenue: funnel.revenue || 0,
    },
    trafficSources: (sourceRows || []) as any[],
    dailyTrend: (trendRows || []) as any[],
    generatedAt: new Date().toISOString(),
  };
}
