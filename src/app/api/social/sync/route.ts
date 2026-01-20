import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import * as postforme from '@/lib/postforme';

export const runtime = 'edge';

/**
 * POST /api/social/sync
 * Trigger a full sync of social accounts, posts, and analytics from Post for Me
 */
export async function POST(request: NextRequest) {
  try {
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
    await executeQuery(
      `INSERT INTO social_sync_log (id, sync_type, status, triggered_by)
       VALUES (?, ?, 'started', ?)`,
      [logId, syncType, triggeredBy]
    );

    const startTime = Date.now();
    let accountsSynced = 0;
    let postsSynced = 0;
    let metricsSynced = 0;

    try {
      // Step 1: Sync accounts
      if (syncType === 'full' || syncType === 'accounts') {
        const accountsResult = await syncAccounts();
        accountsSynced = accountsResult.synced;
      }

      // Step 2: Sync posts
      if (syncType === 'full' || syncType === 'posts') {
        const postsResult = await syncPosts();
        postsSynced = postsResult.synced;
      }

      // Step 3: Sync analytics
      if (syncType === 'full' || syncType === 'analytics') {
        const analyticsResult = await syncAnalytics();
        metricsSynced = analyticsResult.synced;
      }

      // Update sync log - success
      const durationMs = Date.now() - startTime;
      await executeQuery(
        `UPDATE social_sync_log
         SET status = 'completed',
             accounts_synced = ?,
             posts_synced = ?,
             metrics_synced = ?,
             duration_ms = ?,
             completed_at = datetime('now')
         WHERE id = ?`,
        [accountsSynced, postsSynced, metricsSynced, durationMs, logId]
      );

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
      await executeQuery(
        `UPDATE social_sync_log
         SET status = 'failed',
             error_message = ?,
             completed_at = datetime('now')
         WHERE id = ?`,
        [errorMessage, logId]
      );

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
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    // Get recent sync logs
    const logsResult = await queryDatabase(
      `SELECT * FROM social_sync_log
       ORDER BY started_at DESC
       LIMIT ?`,
      [limit]
    );

    // Get connected accounts count
    const accountsResult = await queryDatabase(
      `SELECT platform, COUNT(*) as count
       FROM social_accounts
       WHERE is_active = 1
       GROUP BY platform`,
      []
    );

    // Get last successful sync
    const lastSuccessResults = await queryDatabase(
      `SELECT * FROM social_sync_log
       WHERE status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 1`,
      []
    );

    return NextResponse.json({
      is_configured: postforme.isConfigured(),
      connected_accounts: accountsResult || [],
      last_successful_sync: lastSuccessResults?.[0] || null,
      recent_syncs: logsResult || [],
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
async function syncAccounts(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };

  const accountsResponse = await postforme.getAccounts();
  if (!accountsResponse.success || !accountsResponse.data) {
    result.errors.push(accountsResponse.error || 'Failed to fetch accounts');
    return result;
  }

  for (const account of accountsResponse.data) {
    try {
      // Fetch account analytics to get follower count
      let followerCount = 0;
      let followerChange = 0;
      try {
        const analyticsResponse = await postforme.getAccountAnalytics(account.id);
        if (analyticsResponse.success && analyticsResponse.data) {
          followerCount = analyticsResponse.data.followers || 0;
          followerChange = analyticsResponse.data.follower_change || 0;
        }
      } catch (analyticsErr) {
        // Follower data is optional, continue without it
        console.log(`[Sync] Could not fetch analytics for ${account.id}:`, analyticsErr);
      }

      await executeQuery(
        `INSERT INTO social_accounts (
           id, postforme_account_id, platform, account_handle, account_name, profile_image_url, follower_count, follower_change
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (platform, postforme_account_id) DO UPDATE SET
           account_handle = excluded.account_handle,
           account_name = excluded.account_name,
           profile_image_url = excluded.profile_image_url,
           follower_count = excluded.follower_count,
           follower_change = excluded.follower_change,
           last_synced_at = datetime('now')`,
        [
          crypto.randomUUID().split('-')[0],
          account.id,
          postforme.mapPlatform(account.platform),
          account.username,
          account.username, // Use username as account_name (API doesn't provide display_name)
          account.profile_photo_url || null,
          followerCount,
          followerChange,
        ]
      );

      result.synced++;
    } catch (err) {
      result.errors.push(`Account ${account.id}: ${err}`);
    }
  }

  return result;
}

/**
 * Sync posts from Post for Me account feeds to social_content table
 */
async function syncPosts(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };

  // Get all connected accounts
  const accountsResult = await queryDatabase(
    `SELECT postforme_account_id, platform FROM social_accounts WHERE is_active = 1`,
    []
  );

  if (!accountsResult?.length) {
    result.errors.push('No connected accounts to sync');
    return result;
  }

  // Fetch feed from each account
  for (const account of accountsResult as Array<{ postforme_account_id: string; platform: string }>) {
    try {
      const feedResponse = await postforme.getAccountFeed(account.postforme_account_id, { limit: 50 });

      if (!feedResponse.success || !feedResponse.data) {
        result.errors.push(`Feed ${account.postforme_account_id}: ${feedResponse.error}`);
        continue;
      }

      for (const item of feedResponse.data) {
        try {
          // Check if we already have this post mapped
          const existingMapResults = await queryDatabase(
            `SELECT social_content_id FROM postforme_content_map WHERE postforme_post_id = ?`,
            [item.platform_post_id]
          );
          const existingMap = existingMapResults?.[0] as { social_content_id: string } | undefined;

          const mediaUrl = item.media?.[0]?.url || null;
          const thumbnailUrl = item.media?.[0]?.thumbnail_url || null;
          const isVideo = mediaUrl?.includes('.mp4') || mediaUrl?.includes('/v/');

          if (existingMap) {
            // Update existing content
            await executeQuery(
              `UPDATE social_content SET
                 caption = ?,
                 external_url = ?,
                 thumbnail_url = ?,
                 updated_at = datetime('now')
               WHERE id = ?`,
              [
                item.caption || null,
                item.platform_url || null,
                thumbnailUrl,
                existingMap.social_content_id,
              ]
            );
          } else {
            // Create new social_content entry
            const contentId = crypto.randomUUID().split('-')[0];

            await executeQuery(
              `INSERT INTO social_content (
                 id, platform, content_type, external_id, external_url, caption, status, published_at, thumbnail_url
               ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
              [
                contentId,
                postforme.mapPlatform(item.platform),
                isVideo ? 'clip' : 'post',
                item.platform_post_id,
                item.platform_url || null,
                item.caption || null,
                item.posted_at || null,
                thumbnailUrl,
              ]
            );

            // Create mapping
            await executeQuery(
              `INSERT INTO postforme_content_map (id, postforme_post_id, social_content_id)
               VALUES (?, ?, ?)`,
              [crypto.randomUUID().split('-')[0], item.platform_post_id, contentId]
            );
          }

          result.synced++;
        } catch (err) {
          result.errors.push(`Post ${item.platform_post_id}: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`Account ${account.postforme_account_id}: ${err}`);
    }
  }

  return result;
}

/**
 * Sync analytics/metrics for all synced posts using account feeds
 */
async function syncAnalytics(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };

  // Get all connected accounts
  const accountsResult = await queryDatabase(
    `SELECT postforme_account_id FROM social_accounts WHERE is_active = 1`,
    []
  );

  if (!accountsResult?.length) {
    return result;
  }

  const today = new Date().toISOString().split('T')[0];

  // Fetch feed with metrics from each account
  for (const account of accountsResult as Array<{ postforme_account_id: string }>) {
    try {
      const feedResponse = await postforme.getAccountFeed(account.postforme_account_id, { limit: 50 });

      if (!feedResponse.success || !feedResponse.data) {
        result.errors.push(`Analytics feed ${account.postforme_account_id}: ${feedResponse.error}`);
        continue;
      }

      for (const item of feedResponse.data) {
        if (!item.metrics) continue;

        try {
          // Find the mapped content ID
          const mappingResults = await queryDatabase(
            `SELECT social_content_id FROM postforme_content_map WHERE postforme_post_id = ?`,
            [item.platform_post_id]
          );
          const mapping = mappingResults?.[0] as { social_content_id: string } | undefined;

          if (!mapping) continue;

          const contentId = mapping.social_content_id;
          const m = item.metrics;

          // Normalize metrics across different platform formats
          const views = m.views || m.view_count || m.viewCount || 0;
          const likes = m.likes || m.like_count || m.likeCount || 0;
          const comments = m.comments || m.comment_count || m.commentCount || 0;
          const shares = m.shares || m.share_count || 0;
          const saves = m.saved || 0;
          const reach = m.reach || views; // Use views as reach fallback

          // Calculate engagement rate
          const totalEngagement = likes + comments + shares + saves;
          const engagementRate = reach ? (totalEngagement / reach) * 100 : 0;

          // Upsert metrics for today
          await executeQuery(
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
               synced_at = datetime('now')`,
            [
              crypto.randomUUID().split('-')[0],
              contentId,
              today,
              views,
              m.impressions || 0,
              reach,
              likes,
              comments,
              shares,
              saves,
              0, // link_clicks not available in feed
              engagementRate,
              m.ig_reels_video_view_total_time ? Math.round(m.ig_reels_video_view_total_time / 1000) : null,
              m.ig_reels_avg_watch_time ? Math.round((m.ig_reels_avg_watch_time / 1000) * 100) / 100 : null,
            ]
          );

          result.synced++;
        } catch (err) {
          result.errors.push(`Analytics for ${item.platform_post_id}: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`Analytics account ${account.postforme_account_id}: ${err}`);
    }
  }

  return result;
}
