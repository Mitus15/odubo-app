import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/analytics/export
 * Export analytics data in CSV or JSON format
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const days = parseInt(searchParams.get('days') || '7', 10);
    const dataType = searchParams.get('type') || 'summary';

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    let data: any[];
    let filename: string;

    switch (dataType) {
      case 'activity':
        data = await getActivityData(startDateStr);
        filename = `activity-export-${startDateStr}`;
        break;
      case 'funnel':
        data = await getFunnelData(startDateStr);
        filename = `funnel-export-${startDateStr}`;
        break;
      case 'summary':
      default:
        data = await getSummaryData(startDateStr);
        filename = `analytics-summary-${startDateStr}`;
        break;
    }

    if (format === 'json') {
      return NextResponse.json({
        data,
        meta: {
          type: dataType,
          period: { days, startDate: startDateStr, endDate: now.toISOString().split('T')[0] },
          exportedAt: new Date().toISOString(),
          recordCount: data.length,
        },
      });
    }

    // Generate CSV
    const csv = generateCSV(data);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Export API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

async function getSummaryData(startDate: string): Promise<any[]> {
  try {
    // Get daily metrics from bi_website_metrics
    const rows = await queryDatabase(
      `SELECT
        date,
        unique_visitors,
        sessions,
        page_views,
        avg_session_duration_seconds,
        bounce_rate
       FROM bi_website_metrics
       WHERE date >= ?
       ORDER BY date ASC`,
      [startDate]
    );

    if (!rows || rows.length === 0) {
      // Fallback: generate from fan_activity
      const activityRows = await queryDatabase(
        `SELECT
          date(created_at) as date,
          COUNT(DISTINCT fan_id) as unique_visitors,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(*) as page_views
         FROM fan_activity
         WHERE date(created_at) >= ?
         GROUP BY date(created_at)
         ORDER BY date ASC`,
        [startDate]
      );

      return (activityRows || []) as any[];
    }

    return rows as any[];
  } catch (err) {
    console.error('Error fetching summary data:', err);
    return [];
  }
}

async function getActivityData(startDate: string): Promise<any[]> {
  try {
    const rows = await queryDatabase(
      `SELECT
        created_at as timestamp,
        activity_type,
        content_type,
        content_id,
        source,
        medium,
        duration_seconds,
        completion_percent
       FROM fan_activity
       WHERE date(created_at) >= ?
       ORDER BY created_at DESC
       LIMIT 10000`,
      [startDate]
    );

    return (rows || []) as any[];
  } catch (err) {
    console.error('Error fetching activity data:', err);
    return [];
  }
}

async function getFunnelData(startDate: string): Promise<any[]> {
  try {
    const rows = await queryDatabase(
      `SELECT
        date(created_at) as date,
        activity_type,
        COUNT(*) as count
       FROM fan_activity
       WHERE date(created_at) >= ?
         AND activity_type IN ('clip_view', 'clip_complete', 'shop_visit', 'product_view', 'add_to_cart', 'purchase')
       GROUP BY date(created_at), activity_type
       ORDER BY date ASC, activity_type`,
      [startDate]
    );

    return (rows || []) as any[];
  } catch (err) {
    console.error('Error fetching funnel data:', err);
    return [];
  }
}

function generateCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return 'No data available';
  }

  // Get headers from first row
  const headers = Object.keys(data[0]);
  const lines: string[] = [];

  // Header row
  lines.push(headers.join(','));

  // Data rows
  for (const row of data) {
    const values = headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '';
      // Escape quotes and wrap in quotes if contains comma
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}
