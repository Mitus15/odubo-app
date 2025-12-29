import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10), 1), 365);
    const dateFilter = `date >= date('now', '-${days} days')`;
    const datetimeFilter = `created_at >= datetime('now', '-${days} days')`;

    // Run all queries in parallel
    const [
      // Social platform overview
      socialOverviewResult,
      // Per-platform metrics
      platformMetricsResult,
      // Content type performance
      contentTypeResult,
      // Top performing social content
      topSocialContentResult,
      // Cross-platform attribution
      attributionResult,
      // Platform conversion rates
      conversionRatesResult,
      // Long-form video metrics
      longformMetricsResult,
      // Streaming vs Social correlation
      streamVsSocialResult,
      // Trending audio
      trendingAudioResult,
      // Account growth
      accountGrowthResult,
      // Funnel by source platform
      funnelByPlatformResult,
    ] = await Promise.all([
      // Social overview (aggregate all platforms)
      db.prepare(`
        SELECT
          COALESCE(SUM(views), 0) as totalViews,
          COALESCE(SUM(impressions), 0) as totalImpressions,
          COALESCE(SUM(reach), 0) as totalReach,
          COALESCE(SUM(likes), 0) as totalLikes,
          COALESCE(SUM(comments), 0) as totalComments,
          COALESCE(SUM(shares), 0) as totalShares,
          COALESCE(SUM(saves), 0) as totalSaves,
          COALESCE(SUM(watch_time_seconds), 0) as totalWatchTimeSeconds,
          COALESCE(SUM(follows), 0) as totalFollows,
          COALESCE(SUM(link_clicks), 0) as totalLinkClicks,
          AVG(engagement_rate) as avgEngagementRate
        FROM social_metrics
        WHERE ${dateFilter}
      `).first(),

      // Per-platform breakdown
      db.prepare(`
        SELECT
          sc.platform,
          COUNT(DISTINCT sc.id) as contentCount,
          COALESCE(SUM(sm.views), 0) as views,
          COALESCE(SUM(sm.likes), 0) as likes,
          COALESCE(SUM(sm.comments), 0) as comments,
          COALESCE(SUM(sm.shares), 0) as shares,
          COALESCE(SUM(sm.saves), 0) as saves,
          COALESCE(SUM(sm.follows), 0) as follows,
          COALESCE(SUM(sm.link_clicks), 0) as linkClicks,
          AVG(sm.engagement_rate) as avgEngagementRate,
          AVG(sm.avg_watch_percent) as avgWatchPercent
        FROM social_content sc
        LEFT JOIN social_metrics sm ON sc.id = sm.content_id AND sm.${dateFilter}
        WHERE sc.status = 'published'
        GROUP BY sc.platform
        ORDER BY views DESC
      `).all(),

      // Content type performance
      db.prepare(`
        SELECT
          sc.content_type,
          COUNT(DISTINCT sc.id) as contentCount,
          COALESCE(SUM(sm.views), 0) as views,
          COALESCE(SUM(sm.likes), 0) as likes,
          COALESCE(SUM(sm.shares), 0) as shares,
          AVG(sm.engagement_rate) as avgEngagementRate,
          AVG(sm.avg_watch_percent) as avgWatchPercent
        FROM social_content sc
        LEFT JOIN social_metrics sm ON sc.id = sm.content_id AND sm.${dateFilter}
        WHERE sc.status = 'published'
        GROUP BY sc.content_type
        ORDER BY views DESC
      `).all(),

      // Top performing social content
      db.prepare(`
        SELECT
          sc.id,
          sc.platform,
          sc.content_type,
          sc.title,
          sc.external_url,
          sc.published_at,
          COALESCE(SUM(sm.views), 0) as views,
          COALESCE(SUM(sm.likes), 0) as likes,
          COALESCE(SUM(sm.comments), 0) as comments,
          COALESCE(SUM(sm.shares), 0) as shares,
          COALESCE(SUM(sm.link_clicks), 0) as linkClicks,
          AVG(sm.engagement_rate) as engagementRate
        FROM social_content sc
        LEFT JOIN social_metrics sm ON sc.id = sm.content_id AND sm.${dateFilter}
        WHERE sc.status = 'published'
        GROUP BY sc.id
        ORDER BY views DESC
        LIMIT 20
      `).all(),

      // Cross-platform attribution summary
      db.prepare(`
        SELECT
          source_platform,
          event_type,
          COUNT(*) as eventCount,
          COUNT(DISTINCT session_id) as uniqueUsers,
          COALESCE(SUM(value_cents), 0) as valueCents
        FROM cross_platform_events
        WHERE ${datetimeFilter}
        GROUP BY source_platform, event_type
        ORDER BY eventCount DESC
      `).all(),

      // Platform conversion rates (source → purchase)
      db.prepare(`
        WITH platform_starts AS (
          SELECT source_platform, COUNT(DISTINCT session_id) as sessions
          FROM cross_platform_events
          WHERE event_type = 'site_visit' AND ${datetimeFilter}
          GROUP BY source_platform
        ),
        platform_purchases AS (
          SELECT source_platform,
                 COUNT(*) as purchases,
                 SUM(value_cents) as revenue
          FROM cross_platform_events
          WHERE event_type = 'purchase' AND ${datetimeFilter}
          GROUP BY source_platform
        )
        SELECT
          ps.source_platform,
          ps.sessions,
          COALESCE(pp.purchases, 0) as purchases,
          COALESCE(pp.revenue, 0) as revenueCents,
          CASE WHEN ps.sessions > 0
               THEN (COALESCE(pp.purchases, 0) * 100.0 / ps.sessions)
               ELSE 0 END as conversionRate
        FROM platform_starts ps
        LEFT JOIN platform_purchases pp ON ps.source_platform = pp.source_platform
        ORDER BY conversionRate DESC
      `).all(),

      // Long-form video overview
      db.prepare(`
        SELECT
          platform,
          COUNT(DISTINCT external_id) as videoCount,
          COALESCE(SUM(views), 0) as views,
          COALESCE(SUM(watch_time_minutes), 0) as watchTimeMinutes,
          COALESCE(SUM(likes), 0) as likes,
          COALESCE(SUM(comments), 0) as comments,
          COALESCE(SUM(subscribers_gained), 0) as subscribersGained,
          COALESCE(SUM(revenue_cents), 0) as revenueCents,
          AVG(avg_view_percent) as avgViewPercent
        FROM longform_metrics
        WHERE ${dateFilter}
        GROUP BY platform
      `).all(),

      // Streaming vs Social correlation (social driving streams)
      db.prepare(`
        WITH social_to_stream AS (
          SELECT
            source_platform,
            COUNT(*) as streamClicks
          FROM cross_platform_events
          WHERE event_type = 'stream_click' AND ${datetimeFilter}
          GROUP BY source_platform
        ),
        social_views AS (
          SELECT
            sc.platform,
            SUM(sm.views) as socialViews
          FROM social_content sc
          JOIN social_metrics sm ON sc.id = sm.content_id
          WHERE sm.${dateFilter}
          GROUP BY sc.platform
        )
        SELECT
          sv.platform,
          sv.socialViews,
          COALESCE(sts.streamClicks, 0) as streamClicks,
          CASE WHEN sv.socialViews > 0
               THEN (COALESCE(sts.streamClicks, 0) * 100.0 / sv.socialViews)
               ELSE 0 END as socialToStreamRate
        FROM social_views sv
        LEFT JOIN social_to_stream sts ON sv.platform = sts.source_platform
        ORDER BY socialToStreamRate DESC
      `).all(),

      // Trending audio using our tracks
      db.prepare(`
        SELECT
          platform,
          audio_name,
          audio_author,
          uses_count,
          uses_change_24h,
          uses_change_7d,
          is_trending,
          trending_rank
        FROM trending_audio
        WHERE is_owned = 1 AND ${dateFilter}
        ORDER BY uses_count DESC
        LIMIT 10
      `).all(),

      // Account growth trend
      db.prepare(`
        SELECT
          platform,
          date,
          followers,
          follower_change
        FROM social_account_metrics
        WHERE ${dateFilter}
        ORDER BY platform, date ASC
      `).all(),

      // Full funnel broken down by source platform
      db.prepare(`
        SELECT
          source_platform,
          SUM(CASE WHEN event_type = 'site_visit' THEN 1 ELSE 0 END) as visits,
          SUM(CASE WHEN event_type = 'clip_view' THEN 1 ELSE 0 END) as clipViews,
          SUM(CASE WHEN event_type = 'music_play' THEN 1 ELSE 0 END) as musicPlays,
          SUM(CASE WHEN event_type = 'stream_click' THEN 1 ELSE 0 END) as streamClicks,
          SUM(CASE WHEN event_type = 'shop_view' THEN 1 ELSE 0 END) as shopViews,
          SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) as productViews,
          SUM(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) as addToCarts,
          SUM(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) as purchases,
          SUM(CASE WHEN event_type = 'purchase' THEN value_cents ELSE 0 END) as revenueCents,
          COUNT(DISTINCT session_id) as uniqueSessions
        FROM cross_platform_events
        WHERE ${datetimeFilter}
        GROUP BY source_platform
        ORDER BY purchases DESC
      `).all(),
    ]);

    // Process and structure the response
    const socialOverview = socialOverviewResult || {};

    // Calculate overall engagement rate
    const totalEngagements =
      (socialOverview.totalLikes || 0) +
      (socialOverview.totalComments || 0) +
      (socialOverview.totalShares || 0) +
      (socialOverview.totalSaves || 0);
    const overallEngagementRate =
      socialOverview.totalReach > 0
        ? (totalEngagements / socialOverview.totalReach) * 100
        : 0;

    // Structure platform metrics with colors
    const platformColors: Record<string, string> = {
      instagram: '#E4405F',
      tiktok: '#000000',
      youtube: '#FF0000',
      twitter: '#1DA1F2',
      facebook: '#1877F2',
      threads: '#000000',
    };

    const platformNames: Record<string, string> = {
      instagram: 'Instagram',
      tiktok: 'TikTok',
      youtube: 'YouTube',
      twitter: 'Twitter/X',
      facebook: 'Facebook',
      threads: 'Threads',
    };

    const platforms = (platformMetricsResult.results || []).map((p: any) => ({
      ...p,
      name: platformNames[p.platform] || p.platform,
      color: platformColors[p.platform] || '#726d6c',
      avgEngagementRate: p.avgEngagementRate?.toFixed(2) || 0,
    }));

    // Calculate best performing platform
    const bestPlatform = platforms.reduce((best: any, current: any) => {
      if (!best || current.avgEngagementRate > best.avgEngagementRate) return current;
      return best;
    }, null);

    // Process conversion rates
    const conversionRates = (conversionRatesResult.results || []).map((p: any) => ({
      platform: p.source_platform,
      name: platformNames[p.source_platform] || p.source_platform,
      color: platformColors[p.source_platform] || '#726d6c',
      sessions: p.sessions || 0,
      purchases: p.purchases || 0,
      revenue: (p.revenueCents || 0) / 100,
      conversionRate: p.conversionRate?.toFixed(2) || 0,
    }));

    // Best converting platform
    const bestConvertingPlatform = conversionRates.reduce((best: any, current: any) => {
      if (!best || parseFloat(current.conversionRate) > parseFloat(best.conversionRate)) return current;
      return best;
    }, null);

    // Process funnel by platform
    const funnelByPlatform = (funnelByPlatformResult.results || []).map((p: any) => ({
      platform: p.source_platform,
      name: platformNames[p.source_platform] || p.source_platform,
      color: platformColors[p.source_platform] || '#726d6c',
      visits: p.visits || 0,
      clipViews: p.clipViews || 0,
      musicPlays: p.musicPlays || 0,
      streamClicks: p.streamClicks || 0,
      shopViews: p.shopViews || 0,
      productViews: p.productViews || 0,
      addToCarts: p.addToCarts || 0,
      purchases: p.purchases || 0,
      revenue: (p.revenueCents || 0) / 100,
      uniqueSessions: p.uniqueSessions || 0,
      // Conversion rates
      visitToClip: p.visits > 0 ? ((p.clipViews / p.visits) * 100).toFixed(1) : 0,
      clipToShop: p.clipViews > 0 ? ((p.shopViews / p.clipViews) * 100).toFixed(1) : 0,
      shopToPurchase: p.shopViews > 0 ? ((p.purchases / p.shopViews) * 100).toFixed(1) : 0,
      overallConversion: p.visits > 0 ? ((p.purchases / p.visits) * 100).toFixed(2) : 0,
    }));

    // Long-form metrics
    const longformMetrics = (longformMetricsResult.results || []).map((l: any) => ({
      ...l,
      revenue: (l.revenueCents || 0) / 100,
    }));

    return NextResponse.json({
      period: { days },

      // Overall social metrics
      social: {
        overview: {
          totalViews: socialOverview.totalViews || 0,
          totalImpressions: socialOverview.totalImpressions || 0,
          totalReach: socialOverview.totalReach || 0,
          totalLikes: socialOverview.totalLikes || 0,
          totalComments: socialOverview.totalComments || 0,
          totalShares: socialOverview.totalShares || 0,
          totalSaves: socialOverview.totalSaves || 0,
          totalFollows: socialOverview.totalFollows || 0,
          totalLinkClicks: socialOverview.totalLinkClicks || 0,
          totalWatchTimeHours: Math.round((socialOverview.totalWatchTimeSeconds || 0) / 3600),
          overallEngagementRate: overallEngagementRate.toFixed(2),
        },
        platforms,
        bestPlatform,
        contentTypes: contentTypeResult.results || [],
        topContent: topSocialContentResult.results || [],
      },

      // Cross-platform attribution
      attribution: {
        events: attributionResult.results || [],
        conversionRates,
        bestConvertingPlatform,
        funnelByPlatform,
      },

      // Social to streaming correlation
      socialToStreaming: streamVsSocialResult.results || [],

      // Long-form video
      longform: longformMetrics,

      // Trending audio
      trendingAudio: trendingAudioResult.results || [],

      // Account growth
      accountGrowth: accountGrowthResult.results || [],

      // Insights (computed)
      insights: generateInsights({
        platforms,
        conversionRates,
        funnelByPlatform,
        bestPlatform,
        bestConvertingPlatform,
      }),
    });
  } catch (error) {
    console.error('[Comprehensive Analytics API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

// Generate actionable insights
function generateInsights(data: {
  platforms: any[];
  conversionRates: any[];
  funnelByPlatform: any[];
  bestPlatform: any;
  bestConvertingPlatform: any;
}) {
  const insights: Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low' }> = [];

  // Best engagement platform
  if (data.bestPlatform) {
    insights.push({
      type: 'engagement',
      message: `${data.bestPlatform.name} has your highest engagement rate at ${data.bestPlatform.avgEngagementRate}%`,
      priority: 'medium',
    });
  }

  // Best converting platform
  if (data.bestConvertingPlatform && parseFloat(data.bestConvertingPlatform.conversionRate) > 0) {
    insights.push({
      type: 'conversion',
      message: `${data.bestConvertingPlatform.name} converts best at ${data.bestConvertingPlatform.conversionRate}% with ${data.bestConvertingPlatform.purchases} purchases`,
      priority: 'high',
    });
  }

  // Low-performing platforms
  data.platforms.forEach((p: any) => {
    if (p.views > 1000 && parseFloat(p.avgEngagementRate) < 1) {
      insights.push({
        type: 'improvement',
        message: `${p.name} has high views but low engagement (${p.avgEngagementRate}%). Consider adjusting content strategy.`,
        priority: 'medium',
      });
    }
  });

  // Funnel drop-off analysis
  data.funnelByPlatform.forEach((p: any) => {
    if (p.visits > 100 && p.purchases === 0) {
      insights.push({
        type: 'funnel',
        message: `${p.name} traffic (${p.visits} visits) isn't converting. Check landing page experience.`,
        priority: 'high',
      });
    }
  });

  return insights;
}

export const runtime = 'edge';
