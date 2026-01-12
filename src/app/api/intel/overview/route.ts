import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';

export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    // Convert period to days
    const daysMap: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const days = daysMap[period] || 30;
    const previousDays = days * 2; // For comparison

    // Run all queries in parallel
    const [
      currentStreamingResult,
      previousStreamingResult,
      currentClipsResult,
      previousClipsResult,
      currentRevenueResult,
      previousRevenueResult,
      fansResult,
      previousFansResult,
      connectionsResult,
      insightsResult,
    ] = await Promise.all([
      // Current period streaming
      db.prepare(`
        SELECT
          COALESCE(SUM(streams), 0) as total
        FROM streaming_analytics
        WHERE date >= date('now', '-${days} days')
      `).first(),

      // Previous period streaming (for comparison)
      db.prepare(`
        SELECT
          COALESCE(SUM(streams), 0) as total
        FROM streaming_analytics
        WHERE date >= date('now', '-${previousDays} days')
          AND date < date('now', '-${days} days')
      `).first(),

      // Current clip views
      db.prepare(`
        SELECT
          COALESCE(SUM(view_count), 0) as total
        FROM clip_engagement
      `).first(),

      // Previous clip views (approximation - we don't have date filtering on clip_engagement aggregate)
      // For now, return 0 for comparison - this will be improved when we add time-series clip data
      Promise.resolve({ total: 0 }),

      // Current revenue (streaming + commerce)
      db.prepare(`
        SELECT
          COALESCE(SUM(revenue_cents), 0) as streamingRevenue
        FROM streaming_analytics
        WHERE date >= date('now', '-${days} days')
      `).first(),

      // Previous revenue
      db.prepare(`
        SELECT
          COALESCE(SUM(revenue_cents), 0) as streamingRevenue
        FROM streaming_analytics
        WHERE date >= date('now', '-${previousDays} days')
          AND date < date('now', '-${days} days')
      `).first(),

      // Fan profiles count (current)
      db.prepare(`
        SELECT COUNT(*) as total FROM fan_profiles
        WHERE created_at >= datetime('now', '-${days} days')
      `).first().catch(() => ({ total: 0 })),

      // Fan profiles count (previous)
      db.prepare(`
        SELECT COUNT(*) as total FROM fan_profiles
        WHERE created_at >= datetime('now', '-${previousDays} days')
          AND created_at < datetime('now', '-${days} days')
      `).first().catch(() => ({ total: 0 })),

      // Platform connections
      db.prepare(`
        SELECT
          platform,
          account_name,
          status,
          last_sync_at
        FROM platform_connections
        ORDER BY created_at DESC
      `).all().catch(() => ({ results: [] })),

      // Recent insights
      db.prepare(`
        SELECT
          id,
          title,
          description,
          insight_type as type,
          priority,
          created_at
        FROM correlation_insights
        WHERE status = 'active'
        ORDER BY computed_at DESC
        LIMIT 5
      `).all().catch(() => ({ results: [] })),
    ]);

    // Calculate changes
    const calculateChange = (current: number, previous: number): { change: number; trend: 'up' | 'down' | 'neutral' } => {
      if (previous === 0) {
        return { change: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'neutral' };
      }
      const change = ((current - previous) / previous) * 100;
      return {
        change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      };
    };

    // Extract values with defaults
    const currentStreams = (currentStreamingResult as any)?.total || 0;
    const previousStreams = (previousStreamingResult as any)?.total || 0;
    const currentClips = (currentClipsResult as any)?.total || 0;
    const previousClips = (previousClipsResult as any)?.total || 0;
    const currentRevenue = (currentRevenueResult as any)?.streamingRevenue || 0;
    const previousRevenue = (previousRevenueResult as any)?.streamingRevenue || 0;
    const currentFans = (fansResult as any)?.total || 0;
    const previousFans = (previousFansResult as any)?.total || 0;

    // Format connections
    const connections = ((connectionsResult as any)?.results || []).map((conn: any) => ({
      platform: conn.platform,
      accountName: conn.account_name || 'Unknown',
      status: conn.status || 'unknown',
      lastSync: conn.last_sync_at,
    }));

    // Format insights
    const recentInsights = ((insightsResult as any)?.results || []).map((insight: any) => ({
      id: insight.id,
      title: insight.title,
      description: insight.description,
      type: insight.type,
      priority: insight.priority || 'medium',
      createdAt: insight.created_at,
    }));

    const streamsChange = calculateChange(currentStreams, previousStreams);
    const clipsChange = calculateChange(currentClips, previousClips);
    const revenueChange = calculateChange(currentRevenue, previousRevenue);
    const fansChange = calculateChange(currentFans, previousFans);

    return NextResponse.json({
      metrics: {
        streams: {
          total: currentStreams,
          change: streamsChange.change,
          trend: streamsChange.trend,
        },
        revenue: {
          total: currentRevenue, // In cents
          change: revenueChange.change,
          trend: revenueChange.trend,
        },
        clipViews: {
          total: currentClips,
          change: clipsChange.change,
          trend: clipsChange.trend,
        },
        fans: {
          total: currentFans,
          change: fansChange.change,
          trend: fansChange.trend,
        },
      },
      connections,
      recentInsights,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Intel Overview API] Error:', error);
    return NextResponse.json(
      {
        metrics: {
          streams: { total: 0, change: 0, trend: 'neutral' },
          revenue: { total: 0, change: 0, trend: 'neutral' },
          clipViews: { total: 0, change: 0, trend: 'neutral' },
          fans: { total: 0, change: 0, trend: 'neutral' },
        },
        connections: [],
        recentInsights: [],
        lastUpdated: new Date().toISOString(),
        error: 'Failed to fetch data. Tables may not exist yet.',
      },
      { status: 200 } // Return 200 with empty data so dashboard renders
    );
  }
}

export const runtime = 'edge';
