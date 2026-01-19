import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getAccountFeed, FeedItem } from '@/lib/postforme';

export const runtime = 'edge';

interface SocialAccount {
  id: string;
  platform: string;
  postforme_account_id: string;
  account_handle: string;
  is_active: number;
}

interface SocialContent {
  id: number;
  postforme_id: string | null;
  posted_platforms: string | null;
  posted_at: string | null;
}

/**
 * POST /api/admin/social/analytics/sync
 * Sync analytics from Post for Me for all posted content
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    // Get all active social accounts
    const accountsResult = await db
      .prepare('SELECT * FROM social_accounts WHERE is_active = 1')
      .all<SocialAccount>();

    const accounts = (accountsResult.results || []) as SocialAccount[];

    if (accounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connected accounts to sync',
        synced: 0,
      });
    }

    // Get all posted content that has a postforme_id
    const postedContentResult = await db
      .prepare(
        `SELECT id, postforme_id, posted_platforms, posted_at
         FROM social_content
         WHERE status = 'posted' AND postforme_id IS NOT NULL`
      )
      .all<SocialContent>();

    const postedContent = (postedContentResult.results || []) as SocialContent[];

    let totalSynced = 0;
    const errors: string[] = [];

    // For each account, fetch the feed and match with our content
    for (const account of accounts) {
      try {
        const feedResult = await getAccountFeed(account.postforme_account_id, {
          limit: 50,
          expand: true,
        });

        if (!feedResult.success || !feedResult.data) {
          console.error(`[Analytics Sync] Failed to fetch feed for ${account.account_handle}:`, feedResult.error);
          errors.push(`${account.platform}/${account.account_handle}: ${feedResult.error}`);
          continue;
        }

        const feedItems = feedResult.data;

        // Process each feed item
        for (const feedItem of feedItems) {
          // Try to match with our content by postforme_id or platform_post_id
          // First, check if we have analytics for this post already
          const metrics = normalizeMetrics(feedItem);

          if (!metrics) continue;

          // Try to find matching content
          // We'll store analytics keyed by platform_post_id for matching
          const existingAnalytics = await db
            .prepare(
              `SELECT id, content_id FROM social_analytics
               WHERE platform = ? AND platform_post_id = ?`
            )
            .bind(account.platform, feedItem.platform_post_id)
            .first<{ id: number; content_id: number }>();

          if (existingAnalytics) {
            // Update existing analytics
            await db
              .prepare(
                `UPDATE social_analytics
                 SET views = ?, likes = ?, comments = ?, shares = ?, saves = ?,
                     platform_url = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`
              )
              .bind(
                metrics.views,
                metrics.likes,
                metrics.comments,
                metrics.shares,
                metrics.saves,
                feedItem.platform_url,
                existingAnalytics.id
              )
              .run();

            totalSynced++;
          } else {
            // Try to find matching content by looking for recently posted items
            // Match by caption similarity or by posted_at time
            const matchingContent = await findMatchingContent(
              db,
              feedItem,
              account.platform,
              postedContent
            );

            if (matchingContent) {
              // Insert new analytics record
              await db
                .prepare(
                  `INSERT INTO social_analytics
                   (content_id, platform, views, likes, comments, shares, saves,
                    platform_post_id, platform_url, recorded_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
                )
                .bind(
                  matchingContent.id,
                  account.platform,
                  metrics.views,
                  metrics.likes,
                  metrics.comments,
                  metrics.shares,
                  metrics.saves,
                  feedItem.platform_post_id,
                  feedItem.platform_url
                )
                .run();

              totalSynced++;
            }
          }
        }
      } catch (error) {
        console.error(`[Analytics Sync] Error processing account ${account.account_handle}:`, error);
        errors.push(`${account.platform}/${account.account_handle}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      accounts_processed: accounts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Analytics Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync analytics', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/social/analytics/sync
 * Get analytics for all posted content
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('content_id');

    let query = `
      SELECT
        sa.*,
        sc.title as content_title,
        sc.thumbnail_url as content_thumbnail
      FROM social_analytics sa
      JOIN social_content sc ON sa.content_id = sc.id
    `;
    const params: any[] = [];

    if (contentId) {
      query += ' WHERE sa.content_id = ?';
      params.push(contentId);
    }

    query += ' ORDER BY sa.updated_at DESC';

    const result = await db.prepare(query).bind(...params).all();

    return NextResponse.json({
      success: true,
      analytics: result.results || [],
    });
  } catch (error) {
    console.error('[Analytics] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * Normalize metrics from different platform formats
 */
function normalizeMetrics(feedItem: FeedItem): {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
} | null {
  const metrics = feedItem.metrics;
  if (!metrics) return null;

  return {
    views: metrics.views ?? metrics.view_count ?? metrics.viewCount ?? metrics.impressions ?? 0,
    likes: metrics.likes ?? metrics.like_count ?? metrics.likeCount ?? 0,
    comments: metrics.comments ?? metrics.comment_count ?? metrics.commentCount ?? 0,
    shares: metrics.shares ?? metrics.share_count ?? 0,
    saves: metrics.saved ?? 0,
  };
}

/**
 * Try to find matching content for a feed item
 */
async function findMatchingContent(
  db: any,
  feedItem: FeedItem,
  platform: string,
  postedContent: SocialContent[]
): Promise<SocialContent | null> {
  // Filter content that was posted to this platform
  const platformContent = postedContent.filter((c) => {
    if (!c.posted_platforms) return false;
    try {
      const platforms = JSON.parse(c.posted_platforms) as string[];
      return platforms.includes(platform);
    } catch {
      return false;
    }
  });

  if (platformContent.length === 0) return null;

  // Try to match by posted time (within 1 hour)
  const feedPostedAt = new Date(feedItem.posted_at).getTime();

  for (const content of platformContent) {
    if (!content.posted_at) continue;
    const contentPostedAt = new Date(content.posted_at).getTime();
    const timeDiff = Math.abs(feedPostedAt - contentPostedAt);

    // Within 1 hour = likely the same post
    if (timeDiff < 60 * 60 * 1000) {
      return content;
    }
  }

  // If no time match, try the most recent posted content for this platform
  // that doesn't already have analytics
  return platformContent[0] || null;
}
