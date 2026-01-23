import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

/**
 * Cohort Computation Cron Job
 *
 * POST /api/cron/compute-cohorts
 *
 * Computes fan retention and LTV metrics by acquisition cohort.
 * Groups fans by the ISO week they were first seen, then calculates:
 * - How many fans are still active at week 1, 2, 4, 8, 12
 * - Cumulative LTV at different week checkpoints
 * - Conversion rates and engagement metrics
 *
 * Run weekly via cron scheduler.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let cohortsProcessed = 0;

  try {
    // Process cohorts for the last 26 weeks (6 months)
    // This gives us enough history for 12-week retention tracking
    const weeksBack = 26;

    // Get all distinct cohort weeks with their sources
    const cohortWeeks = await queryDatabase(
      `SELECT DISTINCT
         strftime('%Y-W%W', first_seen_at) as cohort_week,
         COALESCE(acquisition_source, 'direct') as source
       FROM fan_profiles
       WHERE first_seen_at >= date('now', '-${weeksBack} weeks')
         AND first_seen_at IS NOT NULL
       UNION
       SELECT DISTINCT
         strftime('%Y-W%W', first_seen_at) as cohort_week,
         'all' as source
       FROM fan_profiles
       WHERE first_seen_at >= date('now', '-${weeksBack} weeks')
         AND first_seen_at IS NOT NULL
       ORDER BY cohort_week DESC`,
      []
    );

    if (!cohortWeeks || cohortWeeks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cohorts to process',
        processed: 0,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Process each cohort week + source combination
    for (const row of cohortWeeks) {
      const { cohort_week, source } = row as { cohort_week: string; source: string };
      await computeCohortMetrics(cohort_week, source);
      cohortsProcessed++;
    }

    return NextResponse.json({
      success: true,
      processed: cohortsProcessed,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error('[Compute Cohorts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cohort computation failed' },
      { status: 500 }
    );
  }
}

/**
 * Compute metrics for a single cohort (week + source)
 */
async function computeCohortMetrics(cohortWeek: string, source: string): Promise<void> {
  // Build source filter
  const sourceFilter = source === 'all'
    ? ''
    : `AND COALESCE(acquisition_source, 'direct') = ?`;
  const sourceParams = source === 'all' ? [] : [source];

  // Get the start date of this cohort week
  // SQLite's strftime('%Y-W%W', date) gives us YYYY-WNN format
  // We need to reverse this to get the Monday of that week
  const cohortStartQuery = await queryDatabase(
    `SELECT date(?, 'weekday 0', '-6 days') as cohort_start`,
    [cohortWeek.replace('-W', '-W')]
  );

  // Alternative: Calculate cohort start directly from fans' first_seen_at
  const cohortBounds = await queryDatabase(
    `SELECT
       MIN(date(first_seen_at)) as cohort_start,
       MAX(date(first_seen_at)) as cohort_end
     FROM fan_profiles
     WHERE strftime('%Y-W%W', first_seen_at) = ?
       ${sourceFilter}`,
    [cohortWeek, ...sourceParams]
  );

  const bounds = cohortBounds?.[0] as { cohort_start: string; cohort_end: string } | undefined;
  if (!bounds?.cohort_start) return;

  const cohortStart = bounds.cohort_start;

  // 1. Count fans acquired in this cohort
  const acquisitionResult = await queryDatabase(
    `SELECT COUNT(*) as fans_acquired
     FROM fan_profiles
     WHERE strftime('%Y-W%W', first_seen_at) = ?
       ${sourceFilter}`,
    [cohortWeek, ...sourceParams]
  );
  const fansAcquired = (acquisitionResult?.[0] as any)?.fans_acquired || 0;

  if (fansAcquired === 0) return;

  // 2. Calculate retention at each checkpoint
  // A fan is "retained" if they had any activity within N weeks of cohort start
  const retentionData = await queryDatabase(
    `SELECT
       -- Week 1 retention: active within 7 days of cohort start
       SUM(CASE WHEN last_active_at >= date(?, '+1 days')
                 AND last_active_at <= date(?, '+7 days') THEN 1 ELSE 0 END) as week_1,
       -- Week 2 retention: active within 8-14 days
       SUM(CASE WHEN last_active_at >= date(?, '+8 days')
                 AND last_active_at <= date(?, '+14 days') THEN 1 ELSE 0 END) as week_2,
       -- Week 4 retention: active within 22-28 days
       SUM(CASE WHEN last_active_at >= date(?, '+22 days')
                 AND last_active_at <= date(?, '+28 days') THEN 1 ELSE 0 END) as week_4,
       -- Week 8 retention: active within 50-56 days
       SUM(CASE WHEN last_active_at >= date(?, '+50 days')
                 AND last_active_at <= date(?, '+56 days') THEN 1 ELSE 0 END) as week_8,
       -- Week 12 retention: active within 78-84 days
       SUM(CASE WHEN last_active_at >= date(?, '+78 days')
                 AND last_active_at <= date(?, '+84 days') THEN 1 ELSE 0 END) as week_12
     FROM fan_profiles
     WHERE strftime('%Y-W%W', first_seen_at) = ?
       ${sourceFilter}`,
    [
      cohortStart, cohortStart,  // week 1
      cohortStart, cohortStart,  // week 2
      cohortStart, cohortStart,  // week 4
      cohortStart, cohortStart,  // week 8
      cohortStart, cohortStart,  // week 12
      cohortWeek, ...sourceParams
    ]
  );

  const retention = retentionData?.[0] as any || {};

  // 3. Calculate LTV at each checkpoint
  // LTV = total spent by fans in this cohort up to that checkpoint
  const ltvData = await queryDatabase(
    `SELECT
       -- LTV at week 1
       SUM(CASE WHEN co.shopify_created_at <= date(?, '+7 days')
           THEN co.total_price_cents ELSE 0 END) as ltv_week_1,
       -- LTV at week 4
       SUM(CASE WHEN co.shopify_created_at <= date(?, '+28 days')
           THEN co.total_price_cents ELSE 0 END) as ltv_week_4,
       -- LTV at week 12
       SUM(CASE WHEN co.shopify_created_at <= date(?, '+84 days')
           THEN co.total_price_cents ELSE 0 END) as ltv_week_12,
       -- Total LTV (all time)
       SUM(co.total_price_cents) as ltv_total
     FROM fan_profiles fp
     LEFT JOIN commerce_orders co ON fp.id = co.session_id OR fp.email = (
       SELECT email FROM commerce_customers WHERE shopify_customer_id = co.customer_id
     )
     WHERE strftime('%Y-W%W', fp.first_seen_at) = ?
       AND co.financial_status = 'paid'
       ${sourceFilter.replace(/acquisition_source/g, 'fp.acquisition_source')}`,
    [cohortStart, cohortStart, cohortStart, cohortWeek, ...sourceParams]
  );

  // Alternative simpler LTV calculation using fan_profiles total_spent
  const simpleLtvData = await queryDatabase(
    `SELECT
       SUM(total_spent_cents) as ltv_total,
       AVG(total_clip_views) as avg_clips_viewed,
       AVG(total_music_plays) as avg_music_plays,
       CAST(SUM(CASE WHEN total_purchases > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100 as conversion_rate
     FROM fan_profiles
     WHERE strftime('%Y-W%W', first_seen_at) = ?
       ${sourceFilter}`,
    [cohortWeek, ...sourceParams]
  );

  const simpleLtv = simpleLtvData?.[0] as any || {};
  const ltv = ltvData?.[0] as any || {};

  // 4. Upsert cohort metrics
  await executeQuery(
    `INSERT INTO fan_cohorts (
       cohort_week, source,
       fans_acquired,
       week_1_retained, week_2_retained, week_4_retained, week_8_retained, week_12_retained,
       ltv_week_1_cents, ltv_week_4_cents, ltv_week_12_cents, ltv_total_cents,
       avg_clips_viewed, avg_music_plays, conversion_rate,
       computed_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(cohort_week, source) DO UPDATE SET
       fans_acquired = excluded.fans_acquired,
       week_1_retained = excluded.week_1_retained,
       week_2_retained = excluded.week_2_retained,
       week_4_retained = excluded.week_4_retained,
       week_8_retained = excluded.week_8_retained,
       week_12_retained = excluded.week_12_retained,
       ltv_week_1_cents = excluded.ltv_week_1_cents,
       ltv_week_4_cents = excluded.ltv_week_4_cents,
       ltv_week_12_cents = excluded.ltv_week_12_cents,
       ltv_total_cents = excluded.ltv_total_cents,
       avg_clips_viewed = excluded.avg_clips_viewed,
       avg_music_plays = excluded.avg_music_plays,
       conversion_rate = excluded.conversion_rate,
       computed_at = datetime('now'),
       updated_at = datetime('now')`,
    [
      cohortWeek,
      source,
      fansAcquired,
      retention.week_1 || 0,
      retention.week_2 || 0,
      retention.week_4 || 0,
      retention.week_8 || 0,
      retention.week_12 || 0,
      ltv.ltv_week_1 || 0,
      ltv.ltv_week_4 || 0,
      ltv.ltv_week_12 || 0,
      simpleLtv.ltv_total || ltv.ltv_total || 0,
      Math.round((simpleLtv.avg_clips_viewed || 0) * 10) / 10,
      Math.round((simpleLtv.avg_music_plays || 0) * 10) / 10,
      Math.round((simpleLtv.conversion_rate || 0) * 10) / 10,
    ]
  );
}

// Also support GET for manual triggers from browser
export async function GET(request: NextRequest) {
  return POST(request);
}
