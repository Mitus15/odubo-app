import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/analytics/funnel/detailed
 *
 * Detailed funnel visualization analytics - understand where fans drop off.
 * Uses aggregated funnel_sessions for step-by-step analysis.
 *
 * Query params:
 * - days: Number of days to analyze (default: 30)
 * - source: Filter by traffic source (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const source = searchParams.get('source');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Build source filter
    const sourceFilter = source ? 'AND source = ?' : '';
    const sourceParams = source ? [source] : [];

    // Get funnel step counts from funnel_sessions
    const funnelData = await queryDatabase(
      `SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN clip_view_count > 0 THEN 1 ELSE 0 END) as clip_views,
        SUM(CASE WHEN shop_visit_at IS NOT NULL THEN 1 ELSE 0 END) as shop_visits,
        SUM(CASE WHEN product_view_count > 0 THEN 1 ELSE 0 END) as product_views,
        SUM(CASE WHEN add_to_cart_at IS NOT NULL THEN 1 ELSE 0 END) as add_to_carts,
        SUM(CASE WHEN checkout_start_at IS NOT NULL THEN 1 ELSE 0 END) as checkouts,
        SUM(CASE WHEN purchase_at IS NOT NULL THEN 1 ELSE 0 END) as purchases,
        SUM(purchase_value_cents) as total_revenue_cents,
        AVG(CASE WHEN purchase_at IS NOT NULL THEN purchase_value_cents END) as avg_order_value_cents
       FROM funnel_sessions
       WHERE created_at >= ?
         ${sourceFilter}`,
      [startDateStr, ...sourceParams]
    );

    const data = funnelData?.[0] as any || {};

    // Calculate conversion rates between steps
    const steps = [
      { name: 'Sessions', count: data.total_sessions || 0 },
      { name: 'Clip Views', count: data.clip_views || 0 },
      { name: 'Shop Visits', count: data.shop_visits || 0 },
      { name: 'Product Views', count: data.product_views || 0 },
      { name: 'Add to Cart', count: data.add_to_carts || 0 },
      { name: 'Checkout', count: data.checkouts || 0 },
      { name: 'Purchase', count: data.purchases || 0 },
    ];

    const funnelSteps = steps.map((step, i) => {
      const prevCount = i > 0 ? steps[i - 1].count : step.count;
      const conversionRate = prevCount > 0
        ? Math.round((step.count / prevCount) * 1000) / 10
        : 0;
      const overallRate = data.total_sessions > 0
        ? Math.round((step.count / data.total_sessions) * 1000) / 10
        : 0;
      const dropoffRate = prevCount > 0
        ? Math.round(((prevCount - step.count) / prevCount) * 1000) / 10
        : 0;
      const dropoffCount = i > 0 ? prevCount - step.count : 0;

      return {
        step: step.name,
        count: step.count,
        conversionFromPrevious: conversionRate,
        overallConversion: overallRate,
        dropoffRate,
        dropoffCount,
      };
    });

    // Get exit step distribution
    const exitSteps = await queryDatabase(
      `SELECT
        exit_step,
        COUNT(*) as count,
        AVG(session_duration_ms) as avg_session_duration_ms
       FROM funnel_sessions
       WHERE created_at >= ?
         AND purchase_at IS NULL
         ${sourceFilter}
       GROUP BY exit_step
       ORDER BY count DESC`,
      [startDateStr, ...sourceParams]
    );

    // Get behavioral segments by clip views
    const clipSegments = await queryDatabase(
      `SELECT
        CASE
          WHEN clip_view_count = 0 THEN 'no_clips'
          WHEN clip_view_count = 1 THEN '1_clip'
          WHEN clip_view_count BETWEEN 2 AND 3 THEN '2-3_clips'
          ELSE '4+_clips'
        END as clip_segment,
        COUNT(*) as sessions,
        SUM(CASE WHEN purchase_at IS NOT NULL THEN 1 ELSE 0 END) as purchases,
        CAST(SUM(CASE WHEN purchase_at IS NOT NULL THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(*) as conversion_rate
       FROM funnel_sessions
       WHERE created_at >= ?
         ${sourceFilter}
       GROUP BY clip_segment
       ORDER BY conversion_rate DESC`,
      [startDateStr, ...sourceParams]
    );

    // Get product view time analysis
    const productTimeAnalysis = await queryDatabase(
      `SELECT
        CASE
          WHEN product_view_duration_ms < 5000 THEN 'under_5s'
          WHEN product_view_duration_ms BETWEEN 5000 AND 15000 THEN '5-15s'
          WHEN product_view_duration_ms BETWEEN 15000 AND 30000 THEN '15-30s'
          ELSE 'over_30s'
        END as view_duration,
        COUNT(*) as sessions,
        SUM(CASE WHEN purchase_at IS NOT NULL THEN 1 ELSE 0 END) as purchases,
        CAST(SUM(CASE WHEN purchase_at IS NOT NULL THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(*) as conversion_rate
       FROM funnel_sessions
       WHERE created_at >= ?
         AND product_view_count > 0
         ${sourceFilter}
       GROUP BY view_duration
       ORDER BY CASE view_duration
         WHEN 'under_5s' THEN 1
         WHEN '5-15s' THEN 2
         WHEN '15-30s' THEN 3
         ELSE 4
       END`,
      [startDateStr, ...sourceParams]
    );

    // Identify biggest dropout point
    const biggestDropoff = funnelSteps.slice(1).reduce((max, step) =>
      step.dropoffCount > max.dropoffCount ? step : max
    , funnelSteps[1] || { step: 'none', dropoffCount: 0, dropoffRate: 0 });

    // Get available sources
    const availableSources = await queryDatabase(
      `SELECT DISTINCT source, COUNT(*) as sessions
       FROM funnel_sessions
       WHERE source IS NOT NULL
         AND created_at >= ?
       GROUP BY source
       ORDER BY sessions DESC`,
      [startDateStr]
    );

    return NextResponse.json({
      period: {
        days,
        startDate: startDateStr,
        endDate: new Date().toISOString().split('T')[0],
      },
      summary: {
        totalSessions: data.total_sessions || 0,
        totalPurchases: data.purchases || 0,
        overallConversionRate: data.total_sessions > 0
          ? Math.round((data.purchases || 0) / data.total_sessions * 1000) / 10
          : 0,
        totalRevenueCents: data.total_revenue_cents || 0,
        avgOrderValueCents: Math.round(data.avg_order_value_cents || 0),
        biggestDropoff: {
          step: biggestDropoff.step,
          count: biggestDropoff.dropoffCount,
          rate: biggestDropoff.dropoffRate,
        },
      },
      funnel: funnelSteps,
      exitAnalysis: (exitSteps || []).map((e: any) => ({
        exitStep: e.exit_step,
        count: e.count,
        avgSessionDurationMs: Math.round(e.avg_session_duration_ms || 0),
      })),
      behavioralSegments: {
        byClipViews: (clipSegments || []).map((s: any) => ({
          segment: s.clip_segment,
          sessions: s.sessions,
          purchases: s.purchases,
          conversionRate: Math.round((s.conversion_rate || 0) * 10) / 10,
        })),
        byProductViewTime: (productTimeAnalysis || []).map((p: any) => ({
          segment: p.view_duration,
          sessions: p.sessions,
          purchases: p.purchases,
          conversionRate: Math.round((p.conversion_rate || 0) * 10) / 10,
        })),
      },
      availableSources: (availableSources || []).map((s: any) => ({
        source: s.source,
        sessions: s.sessions,
      })),
      insights: generateFunnelInsights(funnelSteps, clipSegments as any[], productTimeAnalysis as any[]),
      meta: {
        generatedAt: new Date().toISOString(),
        source: source || 'all',
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Funnel Detailed API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * Generate actionable insights from funnel data
 */
function generateFunnelInsights(
  funnelSteps: Array<{ step: string; dropoffRate: number; dropoffCount: number }>,
  clipSegments: Array<{ clip_segment: string; conversion_rate: number }> | null,
  productTime: Array<{ view_duration: string; conversion_rate: number }> | null
): string[] {
  const insights: string[] = [];

  // Find the biggest leak
  const biggestLeak = funnelSteps.slice(1).reduce((max, step) =>
    step.dropoffRate > max.dropoffRate ? step : max
  , funnelSteps[1]);

  if (biggestLeak && biggestLeak.dropoffRate > 50) {
    insights.push(
      `${Math.round(biggestLeak.dropoffRate)}% of visitors drop off at "${biggestLeak.step}". This is your biggest opportunity.`
    );
  }

  // Clip viewing correlation
  if (clipSegments && clipSegments.length > 0) {
    const multiClipViewers = clipSegments.find(s => s.clip_segment === '4+_clips');
    const singleClipViewers = clipSegments.find(s => s.clip_segment === '1_clip');
    if (multiClipViewers && singleClipViewers && singleClipViewers.conversion_rate > 0) {
      const lift = Math.round((multiClipViewers.conversion_rate / singleClipViewers.conversion_rate) * 10) / 10;
      if (lift > 1.5) {
        insights.push(
          `Fans who watch 4+ clips convert ${lift}x better than single-clip viewers. Encourage clip exploration.`
        );
      }
    }
  }

  // Product view time correlation
  if (productTime && productTime.length > 0) {
    const longViewers = productTime.find(p => p.view_duration === 'over_30s');
    const shortViewers = productTime.find(p => p.view_duration === 'under_5s');
    if (shortViewers && shortViewers.conversion_rate < 5) {
      insights.push(
        `Visitors who view products for <5s rarely convert (${Math.round(shortViewers.conversion_rate)}%). Consider more engaging product pages.`
      );
    }
  }

  // Cart abandonment
  const cartStep = funnelSteps.find(s => s.step === 'Checkout');
  if (cartStep && cartStep.dropoffRate > 60) {
    insights.push(
      `${Math.round(cartStep.dropoffRate)}% abandon at checkout. Consider cart recovery emails or simplified checkout.`
    );
  }

  return insights.length > 0 ? insights : ['Funnel performing normally. No critical issues detected.'];
}
