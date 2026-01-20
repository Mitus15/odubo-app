import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
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
      currentStreamingResults,
      previousStreamingResults,
      currentClipsResults,
      currentRevenueResults,
      previousRevenueResults,
      fansResults,
      previousFansResults,
      connectionsResults,
      insightsResults,
    ] = await Promise.all([
      // Current period streaming
      queryDatabase(
        `SELECT
          COALESCE(SUM(streams), 0) as total
        FROM streaming_analytics
        WHERE date >= date('now', '-${days} days')`,
        []
      ).catch(() => []),

      // Previous period streaming (for comparison)
      queryDatabase(
        `SELECT
          COALESCE(SUM(streams), 0) as total
        FROM streaming_analytics
        WHERE date >= date('now', '-${previousDays} days')
          AND date < date('now', '-${days} days')`,
        []
      ).catch(() => []),

      // Current clip views
      queryDatabase(
        `SELECT
          COALESCE(SUM(view_count), 0) as total
        FROM clip_engagement`,
        []
      ).catch(() => []),

      // Current revenue (streaming + commerce)
      queryDatabase(
        `SELECT
          COALESCE(SUM(revenue_cents), 0) as streamingRevenue
        FROM streaming_analytics
        WHERE date >= date('now', '-${days} days')`,
        []
      ).catch(() => []),

      // Previous revenue
      queryDatabase(
        `SELECT
          COALESCE(SUM(revenue_cents), 0) as streamingRevenue
        FROM streaming_analytics
        WHERE date >= date('now', '-${previousDays} days')
          AND date < date('now', '-${days} days')`,
        []
      ).catch(() => []),

      // Fan profiles count (current)
      queryDatabase(
        `SELECT COUNT(*) as total FROM fan_profiles
        WHERE created_at >= datetime('now', '-${days} days')`,
        []
      ).catch(() => []),

      // Fan profiles count (previous)
      queryDatabase(
        `SELECT COUNT(*) as total FROM fan_profiles
        WHERE created_at >= datetime('now', '-${previousDays} days')
          AND created_at < datetime('now', '-${days} days')`,
        []
      ).catch(() => []),

      // Platform connections
      queryDatabase(
        `SELECT
          platform,
          account_name,
          status,
          last_sync_at
        FROM platform_connections
        ORDER BY created_at DESC`,
        []
      ).catch(() => []),

      // Recent insights
      queryDatabase(
        `SELECT
          id,
          title,
          description,
          insight_type as type,
          priority,
          created_at
        FROM correlation_insights
        WHERE status = 'active'
        ORDER BY computed_at DESC
        LIMIT 5`,
        []
      ).catch(() => []),
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
    const currentStreams = (currentStreamingResults?.[0] as any)?.total || 0;
    const previousStreams = (previousStreamingResults?.[0] as any)?.total || 0;
    const currentClips = (currentClipsResults?.[0] as any)?.total || 0;
    const previousClips = 0; // We don't have date filtering on clip_engagement aggregate
    const currentRevenue = (currentRevenueResults?.[0] as any)?.streamingRevenue || 0;
    const previousRevenue = (previousRevenueResults?.[0] as any)?.streamingRevenue || 0;
    const currentFans = (fansResults?.[0] as any)?.total || 0;
    const previousFans = (previousFansResults?.[0] as any)?.total || 0;

    // Format connections
    const connections = (connectionsResults || []).map((conn: any) => ({
      platform: conn.platform,
      accountName: conn.account_name || 'Unknown',
      status: conn.status || 'unknown',
      lastSync: conn.last_sync_at,
    }));

    // Format insights
    const recentInsights = (insightsResults || []).map((insight: any) => ({
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
