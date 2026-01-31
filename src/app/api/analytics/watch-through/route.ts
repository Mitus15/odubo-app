import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ClipStats {
  clipId: number;
  title: string;
  avgWatchThroughPct: number;
  viewCount: number;
  completionRate: number;
  createdAt?: string;
}

interface AgeBucket {
  bucket: string;
  avgWatchThroughPct: number;
  viewCount: number;
}

interface PopularityTier {
  popular: number;
  mid: number;
  low: number;
}

interface Recommendation {
  strategy: 'random' | 'recency' | 'popularity' | 'hybrid';
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

interface WatchThroughResponse {
  overall: {
    avgWatchThroughPct: number;
    completionRate: number;
    totalViews: number;
    uniqueClips: number;
  };
  topClips: ClipStats[];
  bottomClips: ClipStats[];
  byClipAge: AgeBucket[];
  byPopularity: PopularityTier;
  recommendation: Recommendation;
}

/**
 * GET /api/analytics/watch-through
 * Returns watch-through analytics to help decide clip ordering strategy
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10), 1), 365);

    // Run all queries in parallel
    const [
      overallResult,
      topClipsResult,
      bottomClipsResult,
      byAgeResult,
      byPopularityResult,
    ] = await Promise.all([
      getOverallMetrics(days),
      getTopClips(days),
      getBottomClips(days),
      getByClipAge(days),
      getByPopularity(days),
    ]);

    // Generate recommendation based on data
    const recommendation = generateRecommendation(byAgeResult, byPopularityResult);

    const response: WatchThroughResponse = {
      overall: overallResult,
      topClips: topClipsResult,
      bottomClips: bottomClipsResult,
      byClipAge: byAgeResult,
      byPopularity: byPopularityResult,
      recommendation,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Watch-through analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watch-through analytics' },
      { status: 500 }
    );
  }
}

async function getOverallMetrics(days: number) {
  const rows = await queryDatabase(`
    SELECT
      AVG(CASE WHEN pct_watched > 1.0 THEN 1.0 ELSE pct_watched END) * 100 as avg_watch_through_pct,
      SUM(CASE WHEN pct_watched >= 1.0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as completion_rate,
      COUNT(*) as total_views,
      COUNT(DISTINCT clip_id) as unique_clips
    FROM clip_view_events
    WHERE created_at >= datetime('now', '-${days} days')
      AND pct_watched IS NOT NULL
  `, []);

  const row = rows[0] as any || {};
  return {
    avgWatchThroughPct: Math.round((row.avg_watch_through_pct || 0) * 10) / 10,
    completionRate: Math.round((row.completion_rate || 0) * 10) / 10,
    totalViews: row.total_views || 0,
    uniqueClips: row.unique_clips || 0,
  };
}

async function getTopClips(days: number): Promise<ClipStats[]> {
  const rows = await queryDatabase(`
    SELECT
      cve.clip_id,
      v.title,
      AVG(CASE WHEN cve.pct_watched > 1.0 THEN 1.0 ELSE cve.pct_watched END) * 100 as avg_watch_through_pct,
      COUNT(*) as view_count,
      SUM(CASE WHEN cve.pct_watched >= 1.0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as completion_rate,
      v.created_at
    FROM clip_view_events cve
    JOIN videos v ON cve.clip_id = v.id
    WHERE cve.created_at >= datetime('now', '-${days} days')
      AND cve.pct_watched IS NOT NULL
    GROUP BY cve.clip_id
    HAVING view_count >= 3
    ORDER BY avg_watch_through_pct DESC
    LIMIT 10
  `, []);

  return (rows as any[]).map(row => ({
    clipId: row.clip_id,
    title: row.title || `Clip ${row.clip_id}`,
    avgWatchThroughPct: Math.round((row.avg_watch_through_pct || 0) * 10) / 10,
    viewCount: row.view_count || 0,
    completionRate: Math.round((row.completion_rate || 0) * 10) / 10,
    createdAt: row.created_at,
  }));
}

async function getBottomClips(days: number): Promise<ClipStats[]> {
  const rows = await queryDatabase(`
    SELECT
      cve.clip_id,
      v.title,
      AVG(CASE WHEN cve.pct_watched > 1.0 THEN 1.0 ELSE cve.pct_watched END) * 100 as avg_watch_through_pct,
      COUNT(*) as view_count,
      SUM(CASE WHEN cve.pct_watched >= 1.0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as completion_rate
    FROM clip_view_events cve
    JOIN videos v ON cve.clip_id = v.id
    WHERE cve.created_at >= datetime('now', '-${days} days')
      AND cve.pct_watched IS NOT NULL
    GROUP BY cve.clip_id
    HAVING view_count >= 3
    ORDER BY avg_watch_through_pct ASC
    LIMIT 5
  `, []);

  return (rows as any[]).map(row => ({
    clipId: row.clip_id,
    title: row.title || `Clip ${row.clip_id}`,
    avgWatchThroughPct: Math.round((row.avg_watch_through_pct || 0) * 10) / 10,
    viewCount: row.view_count || 0,
    completionRate: Math.round((row.completion_rate || 0) * 10) / 10,
  }));
}

async function getByClipAge(days: number): Promise<AgeBucket[]> {
  const rows = await queryDatabase(`
    SELECT
      CASE
        WHEN julianday('now') - julianday(v.created_at) <= 7 THEN 'This week'
        WHEN julianday('now') - julianday(v.created_at) <= 30 THEN '1-4 weeks'
        ELSE '1+ months'
      END as age_bucket,
      AVG(CASE WHEN cve.pct_watched > 1.0 THEN 1.0 ELSE cve.pct_watched END) * 100 as avg_watch_through_pct,
      COUNT(*) as view_count
    FROM clip_view_events cve
    JOIN videos v ON cve.clip_id = v.id
    WHERE cve.created_at >= datetime('now', '-${days} days')
      AND cve.pct_watched IS NOT NULL
    GROUP BY age_bucket
    ORDER BY
      CASE age_bucket
        WHEN 'This week' THEN 1
        WHEN '1-4 weeks' THEN 2
        ELSE 3
      END
  `, []);

  return (rows as any[]).map(row => ({
    bucket: row.age_bucket,
    avgWatchThroughPct: Math.round((row.avg_watch_through_pct || 0) * 10) / 10,
    viewCount: row.view_count || 0,
  }));
}

async function getByPopularity(days: number): Promise<PopularityTier> {
  // Get clips grouped by view count tier
  const rows = await queryDatabase(`
    WITH clip_stats AS (
      SELECT
        clip_id,
        AVG(CASE WHEN pct_watched > 1.0 THEN 1.0 ELSE pct_watched END) * 100 as avg_watch_through,
        COUNT(*) as views
      FROM clip_view_events
      WHERE created_at >= datetime('now', '-${days} days')
        AND pct_watched IS NOT NULL
      GROUP BY clip_id
      HAVING views >= 3
    ),
    ranked AS (
      SELECT
        avg_watch_through,
        views,
        NTILE(3) OVER (ORDER BY views DESC) as tier
      FROM clip_stats
    )
    SELECT
      tier,
      AVG(avg_watch_through) as avg_pct,
      COUNT(*) as clip_count
    FROM ranked
    GROUP BY tier
    ORDER BY tier
  `, []);

  const tierMap: Record<number, number> = {};
  (rows as any[]).forEach(row => {
    tierMap[row.tier] = Math.round((row.avg_pct || 0) * 10) / 10;
  });

  return {
    popular: tierMap[1] || 0,  // Top third by views
    mid: tierMap[2] || 0,      // Middle third
    low: tierMap[3] || 0,      // Bottom third
  };
}

function generateRecommendation(
  byAge: AgeBucket[],
  byPopularity: PopularityTier
): Recommendation {
  // Find age buckets
  const thisWeek = byAge.find(b => b.bucket === 'This week')?.avgWatchThroughPct || 0;
  const older = byAge.find(b => b.bucket === '1+ months')?.avgWatchThroughPct || 0;
  const recencyDiff = thisWeek - older;

  // Popularity difference
  const popularityDiff = byPopularity.popular - byPopularity.low;

  // Decision logic
  const recencySignificant = recencyDiff > 10;
  const popularitySignificant = popularityDiff > 10;

  // Check for insufficient data
  const totalViews = byAge.reduce((sum, b) => sum + b.viewCount, 0);
  if (totalViews < 50) {
    return {
      strategy: 'random',
      confidence: 'low',
      rationale: 'Insufficient data to determine optimal strategy. Using random ordering for now - collect more engagement data.',
    };
  }

  if (!recencySignificant && !popularitySignificant) {
    return {
      strategy: 'random',
      confidence: 'high',
      rationale: `Watch-through is consistent across all dimensions (recency: ${recencyDiff > 0 ? '+' : ''}${recencyDiff.toFixed(0)}%, popularity: ${popularityDiff > 0 ? '+' : ''}${popularityDiff.toFixed(0)}%). Random ordering keeps content fresh without sacrificing engagement.`,
    };
  }

  if (recencySignificant && !popularitySignificant) {
    return {
      strategy: 'recency',
      confidence: recencyDiff > 20 ? 'high' : 'medium',
      rationale: `Recent clips have ${recencyDiff.toFixed(0)}% higher watch-through than older clips. Prioritizing new content will boost engagement.`,
    };
  }

  if (popularitySignificant && !recencySignificant) {
    return {
      strategy: 'popularity',
      confidence: popularityDiff > 20 ? 'high' : 'medium',
      rationale: `Popular clips show ${popularityDiff.toFixed(0)}% higher watch-through than low-view clips. Surfacing proven content first may improve retention.`,
    };
  }

  // Both significant
  return {
    strategy: 'hybrid',
    confidence: 'medium',
    rationale: `Both recency (+${recencyDiff.toFixed(0)}%) and popularity (+${popularityDiff.toFixed(0)}%) show impact. Recommend leading with 2-3 proven recent clips, then randomizing for discovery.`,
  };
}
