import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10), 1), 365);
    const dateThreshold = `datetime('now', '-${days} days')`;

    // Run all queries in parallel for performance
    const [
      overviewResult,
      streamingTrendResult,
      clipEngagementResult,
      topClipsResult,
      topTracksResult,
      platformBreakdownResult,
      funnelResult,
      recentActivityResult,
    ] = await Promise.all([
      // Overview metrics
      db
        .prepare(
          `
          SELECT
            COALESCE(SUM(streams), 0) as totalStreams,
            COALESCE(SUM(listeners), 0) as totalListeners,
            COALESCE(SUM(saves), 0) as totalSaves,
            COALESCE(SUM(revenue_cents), 0) as totalRevenueCents
          FROM streaming_analytics
          WHERE date >= date('now', '-${days} days')
        `
        )
        .first(),

      // Streaming trend (daily)
      db
        .prepare(
          `
          SELECT
            date,
            SUM(streams) as streams,
            SUM(listeners) as listeners,
            SUM(revenue_cents) as revenueCents
          FROM streaming_analytics
          WHERE date >= date('now', '-${days} days')
          GROUP BY date
          ORDER BY date ASC
        `
        )
        .all(),

      // Clip engagement overview
      db
        .prepare(
          `
          SELECT
            COALESCE(SUM(view_count), 0) as totalViews,
            COALESCE(SUM(completion_count), 0) as totalCompletions,
            COALESCE(SUM(share_count), 0) as totalShares,
            COALESCE(SUM(shop_click_count), 0) as totalShopClicks,
            COALESCE(SUM(like_count), 0) as totalLikes,
            COALESCE(SUM(watch_time_seconds), 0) as totalWatchTimeSeconds
          FROM clip_engagement
        `
        )
        .first(),

      // Top clips
      db
        .prepare(
          `
          SELECT
            ce.clip_id as clipId,
            v.title,
            v.artist_name as artistName,
            v.poster_url as thumbnailUrl,
            ce.view_count as views,
            ce.completion_count as completions,
            ce.share_count as shares,
            ce.shop_click_count as shopClicks,
            ce.like_count as likes
          FROM clip_engagement ce
          JOIN videos v ON ce.clip_id = v.id
          ORDER BY ce.view_count DESC
          LIMIT 10
        `
        )
        .all(),

      // Top tracks (streaming)
      db
        .prepare(
          `
          SELECT
            t.id,
            t.title,
            t.artist_name as artistName,
            SUM(sa.streams) as streams,
            SUM(sa.listeners) as listeners,
            SUM(sa.saves) as saves,
            SUM(sa.revenue_cents) as revenueCents
          FROM streaming_analytics sa
          LEFT JOIN tracks t ON sa.track_id = t.id
          WHERE sa.date >= date('now', '-${days} days')
          GROUP BY COALESCE(sa.track_id, sa.isrc)
          ORDER BY streams DESC
          LIMIT 10
        `
        )
        .all(),

      // Platform breakdown
      db
        .prepare(
          `
          SELECT
            platform,
            SUM(streams) as streams,
            SUM(listeners) as listeners,
            SUM(revenue_cents) as revenueCents
          FROM streaming_analytics
          WHERE date >= date('now', '-${days} days')
          GROUP BY platform
          ORDER BY streams DESC
        `
        )
        .all(),

      // Funnel metrics
      db
        .prepare(
          `
          SELECT
            SUM(CASE WHEN event_type = 'clip_view' THEN 1 ELSE 0 END) as clipViews,
            SUM(CASE WHEN event_type = 'shop_click' THEN 1 ELSE 0 END) as shopClicks,
            SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) as productViews,
            SUM(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) as addToCarts,
            SUM(CASE WHEN event_type = 'checkout_start' THEN 1 ELSE 0 END) as checkouts,
            SUM(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) as purchases,
            SUM(CASE WHEN event_type = 'purchase' THEN value_cents ELSE 0 END) as purchaseRevenueCents,
            COUNT(DISTINCT session_id) as uniqueSessions
          FROM funnel_events
          WHERE created_at >= ${dateThreshold}
        `
        )
        .first(),

      // Recent activity feed
      db
        .prepare(
          `
          SELECT
            event_type as eventType,
            clip_id as clipId,
            product_handle as productHandle,
            value_cents as valueCents,
            utm_source as source,
            created_at as createdAt
          FROM funnel_events
          WHERE event_type IN ('purchase', 'add_to_cart', 'shop_click')
          ORDER BY created_at DESC
          LIMIT 20
        `
        )
        .all(),
    ]);

    // Calculate derived metrics
    const overview = overviewResult || {
      totalStreams: 0,
      totalListeners: 0,
      totalSaves: 0,
      totalRevenueCents: 0,
    };

    const clipMetrics = clipEngagementResult || {
      totalViews: 0,
      totalCompletions: 0,
      totalShares: 0,
      totalShopClicks: 0,
      totalLikes: 0,
      totalWatchTimeSeconds: 0,
    };

    const funnel = funnelResult || {
      clipViews: 0,
      shopClicks: 0,
      productViews: 0,
      addToCarts: 0,
      checkouts: 0,
      purchases: 0,
      purchaseRevenueCents: 0,
      uniqueSessions: 0,
    };

    // Calculate conversion rates
    const conversionRates = {
      viewToShop: funnel.clipViews > 0 ? (funnel.shopClicks / funnel.clipViews) * 100 : 0,
      shopToCart: funnel.shopClicks > 0 ? (funnel.addToCarts / funnel.shopClicks) * 100 : 0,
      cartToPurchase: funnel.addToCarts > 0 ? (funnel.purchases / funnel.addToCarts) * 100 : 0,
      overallConversion: funnel.clipViews > 0 ? (funnel.purchases / funnel.clipViews) * 100 : 0,
    };

    return NextResponse.json({
      period: { days },
      overview: {
        totalStreams: overview.totalStreams || 0,
        totalListeners: overview.totalListeners || 0,
        totalSaves: overview.totalSaves || 0,
        streamingRevenue: (overview.totalRevenueCents || 0) / 100,
      },
      clips: {
        totalViews: clipMetrics.totalViews || 0,
        totalCompletions: clipMetrics.totalCompletions || 0,
        totalShares: clipMetrics.totalShares || 0,
        totalShopClicks: clipMetrics.totalShopClicks || 0,
        totalLikes: clipMetrics.totalLikes || 0,
        avgWatchTimeMinutes: Math.round((clipMetrics.totalWatchTimeSeconds || 0) / 60),
        completionRate:
          clipMetrics.totalViews > 0
            ? ((clipMetrics.totalCompletions / clipMetrics.totalViews) * 100).toFixed(1)
            : 0,
      },
      funnel: {
        ...funnel,
        purchaseRevenue: (funnel.purchaseRevenueCents || 0) / 100,
        conversionRates,
      },
      streamingTrend: streamingTrendResult.results || [],
      topClips: topClipsResult.results || [],
      topTracks: (topTracksResult.results || []).map((t: any) => ({
        ...t,
        revenue: (t.revenueCents || 0) / 100,
      })),
      platformBreakdown: (platformBreakdownResult.results || []).map((p: any) => ({
        ...p,
        revenue: (p.revenueCents || 0) / 100,
      })),
      recentActivity: recentActivityResult.results || [],
    });
  } catch (error) {
    console.error('[Analytics API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

export const runtime = 'edge';
