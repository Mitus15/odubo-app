import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import * as postforme from '@/lib/postforme';

export const runtime = 'edge';

/**
 * POST /api/social/sync
 * Trigger a full sync of social accounts, posts, and analytics from Post for Me
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    // Check if Post for Me is configured
    if (!postforme.isConfigured()) {
      return NextResponse.json(
        { error: 'Post for Me API key not configured' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const syncType = (body as { type?: string }).type || 'full';
    const triggeredBy = (body as { triggered_by?: string }).triggered_by || 'manual';

    // Create sync log entry
    const logId = crypto.randomUUID().split('-')[0];
    await db
      .prepare(
        `INSERT INTO social_sync_log (id, sync_type, status, triggered_by)
         VALUES (?, ?, 'started', ?)`
      )
      .bind(logId, syncType, triggeredBy)
      .run();

    const startTime = Date.now();
    let accountsSynced = 0;
    let postsSynced = 0;
    let metricsSynced = 0;

    try {
      // Step 1: Sync accounts
      if (syncType === 'full' || syncType === 'accounts') {
        const accountsResult = await syncAccounts(db);
        accountsSynced = accountsResult.synced;
      }

      // Step 2: Sync posts
      if (syncType === 'full' || syncType === 'posts') {
        const postsResult = await syncPosts(db);
        postsSynced = postsResult.synced;
      }

      // Step 3: Sync analytics
      if (syncType === 'full' || syncType === 'analytics') {
        const analyticsResult = await syncAnalytics(db);
        metricsSynced = analyticsResult.synced;
      }

      // Update sync log - success
      const durationMs = Date.now() - startTime;
      await db
        .prepare(
          `UPDATE social_sync_log
           SET status = 'completed',
               accounts_synced = ?,
               posts_synced = ?,
               metrics_synced = ?,
               duration_ms = ?,
               completed_at = datetime('now')
           WHERE id = ?`
        )
        .bind(accountsSynced, postsSynced, metricsSynced, durationMs, logId)
        .run();

      return NextResponse.json({
        success: true,
        sync_id: logId,
        accounts_synced: accountsSynced,
        posts_synced: postsSynced,
        metrics_synced: metricsSynced,
        duration_ms: durationMs,
      });
    } catch (syncError) {
      // Update sync log - failed
      const errorMessage =
        syncError instanceof Error ? syncError.message : 'Unknown sync error';
      await db
        .prepare(
          `UPDATE social_sync_log
           SET status = 'failed',
               error_message = ?,
               completed_at = datetime('now')
           WHERE id = ?`
        )
        .bind(errorMessage, logId)
        .run();

      throw syncError;
    }
  } catch (error) {
    console.error('[Social Sync] Error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/sync
 * Get sync status and history
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    // Get recent sync logs
    const logsResult = await db
      .prepare(
        `SELECT * FROM social_sync_log
         ORDER BY started_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all();

    // Get connected accounts count
    const accountsResult = await db
      .prepare(
        `SELECT platform, COUNT(*) as count
         FROM social_accounts
         WHERE is_active = 1
         GROUP BY platform`
      )
      .all();

    // Get last successful sync
    const lastSuccessResult = await db
      .prepare(
        `SELECT * FROM social_sync_log
         WHERE status = 'completed'
         ORDER BY completed_at DESC
         LIMIT 1`
      )
      .first();

    return NextResponse.json({
      is_configured: postforme.isConfigured(),
      connected_accounts: accountsResult.results || [],
      last_successful_sync: lastSuccessResult || null,
      recent_syncs: logsResult.results || [],
    });
  } catch (error) {
    console.error('[Social Sync] GET error:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}

// =============================================================================
// Sync Functions
// =============================================================================

interface SyncResult {
  synced: number;
  errors: string[];
}

/**
 * Sync connected social accounts from Post for Me
 */
async function syncAccounts(db: D1Database): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };

  const accountsResponse = await postforme.getAccounts();
  if (!accountsResponse.success || !accountsResponse.data) {
    result.errors.push(accountsResponse.error || 'Failed to fetch accounts');
    return result;
  }

  for (const account of accountsResponse.data) {
    try {
      await db
        .prepare(
          `INSERT INTO social_accounts (
             id, postforme_account_id, platform, account_handle, account_name, profile_image_url
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (platform, postforme_account_id) DO UPDATE SET
             account_handle = excluded.account_handle,
             account_name = excluded.account_name,
             profile_image_url = excluded.profile_image_url,
             last_synced_at = datetime('now')`
        )
        .bind(
          crypto.randomUUID().split('-')[0],
          account.id,
          postforme.mapPlatform(account.platform),
          account.username,
          account.display_name,
          account.profile_image_url || null
        )
        .run();

      result.synced++;
    } catch (err) {
      result.errors.push(`Account ${account.id}: ${err}`);
    }
  }

  return result;
}

/**
 * Sync posts from Post for Me to social_content table
 */
async function syncPosts(db: D1Database): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };

  const postsResponse = await postforme.getPosts({ status: 'published', limit: 100 });
  if (!postsResponse.success || !postsResponse.data) {
    result.errors.push(postsResponse.error || 'Failed to fetch posts');
    return result;
  }

  for (const post of postsResponse.data) {
    try {
      // Check if we already have this post mapped
      const existingMap = await db
        .prepare(`SELECT social_content_id FROM postforme_content_map WHERE postforme_post_id = ?`)
        .bind(post.id)
        .first();

      if (existingMap) {
        // Update existing content
        await db
          .prepare(
            `UPDATE social_content SET
               caption = ?,
               status = ?,
               published_at = ?,
               updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(
            post.caption || null,
            post.status,
            post.published_at || null,
            existingMap.social_content_id
          )
          .run();
      } else {
        // Create new social_content entry
        const contentId = crypto.randomUUID().split('-')[0];

        await db
          .prepare(
            `INSERT INTO social_content (
               id, platform, content_type, external_id, external_url, caption, status, published_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            contentId,
            postforme.mapPlatform(post.platform),
            postforme.mapContentType(post.type),
            post.external_id || post.id,
            post.external_url || null,
            post.caption || null,
            post.status === 'published' ? 'published' : 'draft',
            post.published_at || null
          )
          .run();

        // Create mapping
        await db
          .prepare(
            `INSERT INTO postforme_content_map (id, postforme_post_id, social_content_id)
             VALUES (?, ?, ?)`
          )
          .bind(crypto.randomUUID().split('-')[0], post.id, contentId)
          .run();
      }

      result.synced++;
    } catch (err) {
      result.errors.push(`Post ${post.id}: ${err}`);
    }
  }

  return result;
}

/**
 * Sync analytics/metrics for all synced posts
 */
async function syncAnalytics(db: D1Database): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };

  // Get all mapped posts
  const mappedPosts = await db
    .prepare(
      `SELECT postforme_post_id, social_content_id FROM postforme_content_map`
    )
    .all();

  if (!mappedPosts.results?.length) {
    return result;
  }

  const postIds = mappedPosts.results.map((m: any) => m.postforme_post_id);
  const postMap = new Map(
    mappedPosts.results.map((m: any) => [m.postforme_post_id, m.social_content_id])
  );

  // Fetch analytics in bulk
  const analyticsResponse = await postforme.getBulkAnalytics(postIds);
  if (!analyticsResponse.success || !analyticsResponse.data) {
    result.errors.push(analyticsResponse.error || 'Failed to fetch analytics');
    return result;
  }

  const today = new Date().toISOString().split('T')[0];

  for (const analytics of analyticsResponse.data) {
    try {
      const contentId = postMap.get(analytics.post_id);
      if (!contentId) continue;

      // Upsert metrics for today
      await db
        .prepare(
          `INSERT INTO social_metrics (
             id, content_id, date, views, impressions, reach, likes, comments, shares, saves,
             link_clicks, engagement_rate, watch_time_seconds, avg_watch_percent
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (content_id, date) DO UPDATE SET
             views = excluded.views,
             impressions = excluded.impressions,
             reach = excluded.reach,
             likes = excluded.likes,
             comments = excluded.comments,
             shares = excluded.shares,
             saves = excluded.saves,
             link_clicks = excluded.link_clicks,
             engagement_rate = excluded.engagement_rate,
             watch_time_seconds = excluded.watch_time_seconds,
             avg_watch_percent = excluded.avg_watch_percent,
             synced_at = datetime('now')`
        )
        .bind(
          crypto.randomUUID().split('-')[0],
          contentId,
          today,
          analytics.views || 0,
          analytics.impressions || 0,
          analytics.reach || 0,
          analytics.likes || 0,
          analytics.comments || 0,
          analytics.shares || 0,
          analytics.saves || 0,
          analytics.clicks || 0,
          analytics.engagement_rate || 0,
          analytics.watch_time_seconds || null,
          analytics.avg_watch_percent || null
        )
        .run();

      result.synced++;
    } catch (err) {
      result.errors.push(`Analytics for ${analytics.post_id}: ${err}`);
    }
  }

  return result;
}
