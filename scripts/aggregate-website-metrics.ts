#!/usr/bin/env tsx
/**
 * Aggregate Website Metrics
 *
 * Daily aggregation job that processes fan_activity records into bi_website_metrics.
 * Run this as a daily cron job.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/aggregate-website-metrics.ts
 *   tsx --env-file=.env.local scripts/aggregate-website-metrics.ts --date=2024-01-15
 *
 * What it does:
 *   1. Reads raw events from fan_activity for the target date
 *   2. Calculates: unique visitors, sessions, page views, bounce rate, avg session duration
 *   3. Aggregates traffic by source and device
 *   4. Identifies top pages
 *   5. Upserts into bi_website_metrics
 */

import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { queryDatabase, executeQuery } from '../src/lib/db';

interface SessionData {
  sessionId: string;
  fanId: string;
  firstActivity: string;
  lastActivity: string;
  pageViews: number;
  source: string | null;
  device: string | null;
}

interface PageData {
  path: string;
  views: number;
}

async function main() {
  // Parse target date from args or default to yesterday
  let targetDate: string;

  const dateArg = process.argv.find(arg => arg.startsWith('--date='));
  if (dateArg) {
    targetDate = dateArg.replace('--date=', '');
  } else {
    // Default to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  }

  console.log(`\n📊 Aggregating website metrics for ${targetDate}\n`);

  try {
    // 1. Get all sessions for the day
    const sessionsRaw = await queryDatabase(
      `SELECT
        session_id,
        fan_id,
        MIN(created_at) as first_activity,
        MAX(created_at) as last_activity,
        COUNT(CASE WHEN activity_type = 'page_view' THEN 1 END) as page_views,
        source,
        device_type
      FROM fan_activity
      WHERE date(created_at) = ?
        AND session_id IS NOT NULL
      GROUP BY session_id`,
      [targetDate]
    ) as any[];

    console.log(`Found ${sessionsRaw.length} sessions`);

    if (sessionsRaw.length === 0) {
      console.log('No activity to aggregate for this date.');
      return;
    }

    // 2. Calculate unique visitors (by fan_id)
    const uniqueVisitorsQuery = await queryDatabase(
      `SELECT COUNT(DISTINCT fan_id) as count
       FROM fan_activity
       WHERE date(created_at) = ?`,
      [targetDate]
    ) as any[];
    const uniqueVisitors = uniqueVisitorsQuery[0]?.count || 0;

    // 3. Calculate total page views
    const pageViewsQuery = await queryDatabase(
      `SELECT COUNT(*) as count
       FROM fan_activity
       WHERE date(created_at) = ?
         AND activity_type = 'page_view'`,
      [targetDate]
    ) as any[];
    const totalPageViews = pageViewsQuery[0]?.count || 0;

    // 4. Calculate session metrics
    const sessions: SessionData[] = sessionsRaw.map(row => ({
      sessionId: row.session_id,
      fanId: row.fan_id,
      firstActivity: row.first_activity,
      lastActivity: row.last_activity,
      pageViews: row.page_views || 0,
      source: row.source,
      device: row.device_type,
    }));

    const totalSessions = sessions.length;

    // Bounce rate: sessions with only 1 page view
    const bouncedSessions = sessions.filter(s => s.pageViews <= 1).length;
    const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

    // Average session duration
    let totalDuration = 0;
    let validDurations = 0;
    for (const session of sessions) {
      const first = new Date(session.firstActivity).getTime();
      const last = new Date(session.lastActivity).getTime();
      const duration = (last - first) / 1000; // seconds
      if (duration > 0 && duration < 3600) { // Cap at 1 hour to exclude outliers
        totalDuration += duration;
        validDurations++;
      }
    }
    const avgSessionDuration = validDurations > 0 ? Math.round(totalDuration / validDurations) : 0;

    // Pages per session
    const pagesPerSession = totalSessions > 0 ? totalPageViews / totalSessions : 0;

    // 5. Traffic by source
    const trafficBySource: Record<string, number> = {};
    for (const session of sessions) {
      const source = session.source || 'direct';
      trafficBySource[source] = (trafficBySource[source] || 0) + 1;
    }

    // 6. Traffic by device
    const trafficByDevice: Record<string, number> = {};
    for (const session of sessions) {
      const device = session.device || 'unknown';
      trafficByDevice[device] = (trafficByDevice[device] || 0) + 1;
    }

    // 7. Top pages
    const topPagesQuery = await queryDatabase(
      `SELECT content_id as path, COUNT(*) as views
       FROM fan_activity
       WHERE date(created_at) = ?
         AND activity_type = 'page_view'
         AND content_id IS NOT NULL
       GROUP BY content_id
       ORDER BY views DESC
       LIMIT 20`,
      [targetDate]
    ) as any[];

    const topPages: PageData[] = topPagesQuery.map(row => ({
      path: row.path,
      views: row.views,
    }));

    // 8. Generate unique ID for upsert
    const id = generateId();

    // 9. Upsert into bi_website_metrics
    await executeQuery(
      `INSERT INTO bi_website_metrics (
        id, date, page_views, unique_visitors, sessions,
        avg_session_duration_seconds, bounce_rate, pages_per_session,
        traffic_by_source, traffic_by_device, top_pages, entry_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'api', datetime('now'))
      ON CONFLICT(date) DO UPDATE SET
        page_views = excluded.page_views,
        unique_visitors = excluded.unique_visitors,
        sessions = excluded.sessions,
        avg_session_duration_seconds = excluded.avg_session_duration_seconds,
        bounce_rate = excluded.bounce_rate,
        pages_per_session = excluded.pages_per_session,
        traffic_by_source = excluded.traffic_by_source,
        traffic_by_device = excluded.traffic_by_device,
        top_pages = excluded.top_pages,
        entry_type = 'api'`,
      [
        id,
        targetDate,
        totalPageViews,
        uniqueVisitors,
        totalSessions,
        avgSessionDuration,
        Math.round(bounceRate * 100) / 100, // 2 decimal places
        Math.round(pagesPerSession * 100) / 100,
        JSON.stringify(trafficBySource),
        JSON.stringify(trafficByDevice),
        JSON.stringify(topPages),
      ]
    );

    console.log(`\n✅ Metrics aggregated for ${targetDate}:`);
    console.log(`   • Unique visitors: ${uniqueVisitors}`);
    console.log(`   • Sessions: ${totalSessions}`);
    console.log(`   • Page views: ${totalPageViews}`);
    console.log(`   • Bounce rate: ${bounceRate.toFixed(1)}%`);
    console.log(`   • Avg session duration: ${avgSessionDuration}s`);
    console.log(`   • Pages per session: ${pagesPerSession.toFixed(2)}`);
    console.log(`   • Top sources: ${Object.keys(trafficBySource).slice(0, 5).join(', ')}`);
    console.log(`   • Top pages: ${topPages.slice(0, 3).map(p => p.path).join(', ')}`);

  } catch (error) {
    console.error('❌ Error aggregating metrics:', error);
    process.exit(1);
  }
}

function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

main().catch(console.error);
