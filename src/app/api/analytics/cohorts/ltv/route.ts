import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/analytics/cohorts/ltv
 *
 * LTV comparison by acquisition source - understand channel ROI.
 * Answers: "What's the ROI of Instagram vs TikTok?"
 *
 * Query params:
 * - weeks: Number of weeks to analyze (default: 12)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);

    // Get LTV by source
    const ltvBySource = await queryDatabase(
      `SELECT
        source,
        SUM(fans_acquired) as total_fans,
        SUM(ltv_total_cents) as total_ltv_cents,
        AVG(CASE WHEN fans_acquired > 0 THEN ltv_total_cents * 1.0 / fans_acquired ELSE 0 END) as avg_ltv_per_fan_cents,
        AVG(conversion_rate) as avg_conversion_rate,
        AVG(CASE WHEN fans_acquired > 0 THEN week_4_retained * 100.0 / fans_acquired ELSE 0 END) as avg_week_4_retention,
        AVG(avg_clips_viewed) as avg_clips_viewed,
        AVG(avg_music_plays) as avg_music_plays
       FROM fan_cohorts
       WHERE cohort_week >= strftime('%Y-W%W', date('now', '-${weeks} weeks'))
         AND source != 'all'
       GROUP BY source
       HAVING total_fans > 0
       ORDER BY total_ltv_cents DESC`,
      []
    );

    // Get totals for comparison
    const totals = await queryDatabase(
      `SELECT
        SUM(fans_acquired) as total_fans,
        SUM(ltv_total_cents) as total_ltv_cents
       FROM fan_cohorts
       WHERE cohort_week >= strftime('%Y-W%W', date('now', '-${weeks} weeks'))
         AND source = 'all'`,
      []
    );

    const totalStats = totals?.[0] as any || {};
    const totalFans = totalStats.total_fans || 1;
    const totalLtv = totalStats.total_ltv_cents || 0;

    const sources = (ltvBySource || []).map((s: any) => {
      const sourceFans = s.total_fans || 0;
      const sourceLtv = s.total_ltv_cents || 0;
      return {
        source: s.source,
        totalFans: sourceFans,
        fanShare: Math.round((sourceFans / totalFans) * 100),
        totalLtvCents: sourceLtv,
        ltvShare: Math.round((sourceLtv / (totalLtv || 1)) * 100),
        avgLtvPerFanCents: Math.round(s.avg_ltv_per_fan_cents || 0),
        avgConversionRate: Math.round((s.avg_conversion_rate || 0) * 10) / 10,
        avgWeek4Retention: Math.round(s.avg_week_4_retention || 0),
        avgClipsViewed: Math.round((s.avg_clips_viewed || 0) * 10) / 10,
        avgMusicPlays: Math.round((s.avg_music_plays || 0) * 10) / 10,
      };
    });

    // Calculate efficiency score (LTV share / Fan share ratio)
    // > 1 means source delivers more value than expected
    const sourcesWithEfficiency = sources.map(s => ({
      ...s,
      efficiencyScore: s.fanShare > 0
        ? Math.round((s.ltvShare / s.fanShare) * 100) / 100
        : 0,
    }));

    // Find top performer
    const topPerformer = sourcesWithEfficiency.length > 0
      ? sourcesWithEfficiency.reduce((a, b) =>
          (a.avgLtvPerFanCents > b.avgLtvPerFanCents) ? a : b
        )
      : null;

    return NextResponse.json({
      period: { weeks },
      summary: {
        totalFans: totalStats.total_fans || 0,
        totalLtvCents: totalStats.total_ltv_cents || 0,
        avgLtvPerFanCents: totalFans > 0 ? Math.round(totalLtv / totalFans) : 0,
        topPerformer: topPerformer?.source || null,
        sourcesTracked: sources.length,
      },
      sources: sourcesWithEfficiency,
      insights: generateInsights(sourcesWithEfficiency),
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

/**
 * Generate actionable insights from source comparison
 */
function generateInsights(sources: Array<{
  source: string;
  avgLtvPerFanCents: number;
  avgConversionRate: number;
  avgWeek4Retention: number;
  efficiencyScore: number;
  fanShare: number;
}>): string[] {
  const insights: string[] = [];

  if (sources.length === 0) {
    return ['No source data available. Run cohort computation first.'];
  }

  // Find most efficient source
  const mostEfficient = sources.reduce((a, b) =>
    a.efficiencyScore > b.efficiencyScore ? a : b
  );
  if (mostEfficient.efficiencyScore > 1.2) {
    insights.push(
      `${mostEfficient.source} fans are ${Math.round((mostEfficient.efficiencyScore - 1) * 100)}% more valuable than average.`
    );
  }

  // Find highest retention source
  const highestRetention = sources.reduce((a, b) =>
    a.avgWeek4Retention > b.avgWeek4Retention ? a : b
  );
  if (highestRetention.avgWeek4Retention > 0) {
    insights.push(
      `${highestRetention.source} has the best 4-week retention at ${highestRetention.avgWeek4Retention}%.`
    );
  }

  // Find underperforming sources
  const underperformers = sources.filter(s =>
    s.efficiencyScore < 0.8 && s.fanShare > 10
  );
  if (underperformers.length > 0) {
    insights.push(
      `Consider optimizing ${underperformers.map(s => s.source).join(', ')} - high traffic but below-average conversion.`
    );
  }

  // Find conversion opportunities
  const lowConversion = sources.filter(s =>
    s.avgConversionRate < 5 && s.fanShare > 15
  );
  if (lowConversion.length > 0) {
    insights.push(
      `${lowConversion.map(s => s.source).join(', ')} fans rarely purchase. Consider targeted offers.`
    );
  }

  return insights.length > 0 ? insights : ['All sources performing similarly.'];
}
