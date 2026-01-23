import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/analytics/cohorts
 *
 * Cohort retention and LTV analytics - understand fan value over time.
 *
 * Query params:
 * - weeks: Number of weeks of cohort history (default: 12)
 * - source: Filter by acquisition source (default: 'all')
 * - compare: Comma-separated sources to compare (e.g., 'instagram,tiktok')
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);
    const source = searchParams.get('source') || 'all';
    const compareParam = searchParams.get('compare');
    const compareSources = compareParam ? compareParam.split(',').map(s => s.trim()) : null;

    // Build source filter
    let sourceFilter = '';
    let sourceParams: string[] = [];

    if (compareSources && compareSources.length > 0) {
      // Compare multiple sources
      const placeholders = compareSources.map(() => '?').join(',');
      sourceFilter = `AND source IN (${placeholders})`;
      sourceParams = compareSources;
    } else if (source !== 'all') {
      sourceFilter = 'AND source = ?';
      sourceParams = [source];
    } else {
      // Default to aggregated 'all' view
      sourceFilter = "AND source = 'all'";
    }

    // Get cohort data
    const cohorts = await queryDatabase(
      `SELECT
        cohort_week,
        source,
        fans_acquired,
        week_1_retained,
        week_2_retained,
        week_4_retained,
        week_8_retained,
        week_12_retained,
        ltv_week_1_cents,
        ltv_week_4_cents,
        ltv_week_12_cents,
        ltv_total_cents,
        avg_clips_viewed,
        avg_music_plays,
        conversion_rate,
        computed_at
       FROM fan_cohorts
       WHERE cohort_week >= strftime('%Y-W%W', date('now', '-${weeks} weeks'))
         ${sourceFilter}
       ORDER BY cohort_week DESC, source`,
      sourceParams
    );

    // Calculate retention rates (percentages)
    const cohortsWithRates = (cohorts || []).map((c: any) => {
      const fansAcquired = c.fans_acquired || 1; // Avoid division by zero
      return {
        cohortWeek: c.cohort_week,
        source: c.source,
        fansAcquired: c.fans_acquired,
        retention: {
          week1: {
            count: c.week_1_retained || 0,
            rate: Math.round(((c.week_1_retained || 0) / fansAcquired) * 100),
          },
          week2: {
            count: c.week_2_retained || 0,
            rate: Math.round(((c.week_2_retained || 0) / fansAcquired) * 100),
          },
          week4: {
            count: c.week_4_retained || 0,
            rate: Math.round(((c.week_4_retained || 0) / fansAcquired) * 100),
          },
          week8: {
            count: c.week_8_retained || 0,
            rate: Math.round(((c.week_8_retained || 0) / fansAcquired) * 100),
          },
          week12: {
            count: c.week_12_retained || 0,
            rate: Math.round(((c.week_12_retained || 0) / fansAcquired) * 100),
          },
        },
        ltv: {
          week1Cents: c.ltv_week_1_cents || 0,
          week4Cents: c.ltv_week_4_cents || 0,
          week12Cents: c.ltv_week_12_cents || 0,
          totalCents: c.ltv_total_cents || 0,
          perFanCents: Math.round((c.ltv_total_cents || 0) / fansAcquired),
        },
        engagement: {
          avgClipsViewed: c.avg_clips_viewed || 0,
          avgMusicPlays: c.avg_music_plays || 0,
          conversionRate: c.conversion_rate || 0,
        },
        computedAt: c.computed_at,
      };
    });

    // Calculate summary statistics
    const totalFansAcquired = cohortsWithRates.reduce((sum: number, c: any) => sum + c.fansAcquired, 0);
    const totalLtv = cohortsWithRates.reduce((sum: number, c: any) => sum + c.ltv.totalCents, 0);
    const avgWeek1Retention = cohortsWithRates.length > 0
      ? Math.round(cohortsWithRates.reduce((sum: number, c: any) => sum + c.retention.week1.rate, 0) / cohortsWithRates.length)
      : 0;
    const avgWeek4Retention = cohortsWithRates.length > 0
      ? Math.round(cohortsWithRates.reduce((sum: number, c: any) => sum + c.retention.week4.rate, 0) / cohortsWithRates.length)
      : 0;
    const avgWeek12Retention = cohortsWithRates.length > 0
      ? Math.round(cohortsWithRates.reduce((sum: number, c: any) => sum + c.retention.week12.rate, 0) / cohortsWithRates.length)
      : 0;

    // Get available sources for filtering
    const sourcesResult = await queryDatabase(
      `SELECT DISTINCT source, SUM(fans_acquired) as total_fans
       FROM fan_cohorts
       WHERE source != 'all'
       GROUP BY source
       ORDER BY total_fans DESC`,
      []
    );

    const availableSources = (sourcesResult || []).map((s: any) => ({
      source: s.source,
      totalFans: s.total_fans,
    }));

    return NextResponse.json({
      period: {
        weeks,
        startWeek: cohortsWithRates.length > 0
          ? cohortsWithRates[cohortsWithRates.length - 1].cohortWeek
          : null,
        endWeek: cohortsWithRates.length > 0
          ? cohortsWithRates[0].cohortWeek
          : null,
      },
      summary: {
        totalCohorts: cohortsWithRates.length,
        totalFansAcquired,
        totalLtvCents: totalLtv,
        avgLtvPerFanCents: totalFansAcquired > 0 ? Math.round(totalLtv / totalFansAcquired) : 0,
        avgRetention: {
          week1: avgWeek1Retention,
          week4: avgWeek4Retention,
          week12: avgWeek12Retention,
        },
      },
      cohorts: cohortsWithRates,
      availableSources,
      meta: {
        generatedAt: new Date().toISOString(),
        source: compareSources ? 'comparison' : source,
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Cohorts API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/analytics/cohorts/ltv
 *
 * LTV comparison by acquisition source - understand channel ROI.
 */
export async function getLtvComparison(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);

    // Get LTV by source
    const ltvBySource = await queryDatabase(
      `SELECT
        source,
        SUM(fans_acquired) as total_fans,
        SUM(ltv_total_cents) as total_ltv_cents,
        AVG(ltv_total_cents * 1.0 / NULLIF(fans_acquired, 0)) as avg_ltv_per_fan_cents,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(week_4_retained * 100.0 / NULLIF(fans_acquired, 0)) as avg_week_4_retention
       FROM fan_cohorts
       WHERE cohort_week >= strftime('%Y-W%W', date('now', '-${weeks} weeks'))
         AND source != 'all'
       GROUP BY source
       ORDER BY total_ltv_cents DESC`,
      []
    );

    return NextResponse.json({
      period: { weeks },
      sources: (ltvBySource || []).map((s: any) => ({
        source: s.source,
        totalFans: s.total_fans,
        totalLtvCents: s.total_ltv_cents || 0,
        avgLtvPerFanCents: Math.round(s.avg_ltv_per_fan_cents || 0),
        avgConversionRate: Math.round((s.avg_conversion_rate || 0) * 10) / 10,
        avgWeek4Retention: Math.round(s.avg_week_4_retention || 0),
      })),
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('LTV Comparison API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
