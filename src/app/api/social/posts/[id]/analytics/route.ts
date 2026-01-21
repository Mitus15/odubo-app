import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getPostAnalytics, getAccountFeed, getPost } from '@/lib/postforme';

export const runtime = 'edge';

// Helper to safely parse JSON
function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * GET /api/social/posts/[id]/analytics
 * Get analytics/engagement metrics for a post
 * Fetches from Post for Me API if available
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get post from DB
    const rows = await queryDatabase(
      `SELECT id, status, platform_post_ids, account_ids FROM social_posts WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const post = rows[0] as {
      id: string;
      status: string;
      platform_post_ids?: string;
      account_ids?: string;
    };

    // Only published posts have analytics
    if (post.status !== 'published') {
      return NextResponse.json({
        analytics: null,
        message: 'Analytics only available for published posts',
      });
    }

    let platformPostIds = parseJSON<Record<string, string>>(post.platform_post_ids, {});
    const accountIds = parseJSON<string[]>(post.account_ids, []);

    if (platformPostIds.postforme_id && (!platformPostIds.external_id || !platformPostIds.external_url)) {
      try {
        const pfmPost = await getPost(platformPostIds.postforme_id);
        if (pfmPost.success && pfmPost.data) {
          platformPostIds = {
            ...platformPostIds,
            external_id: pfmPost.data.external_id || platformPostIds.external_id,
            external_url: pfmPost.data.external_url || platformPostIds.external_url,
          };

          await executeQuery(
            `UPDATE social_posts SET platform_post_ids = ?, updated_at = datetime('now') WHERE id = ?`,
            [JSON.stringify(platformPostIds), id]
          );
        }
      } catch (err) {
        console.error('[Analytics] Error syncing postforme metadata:', err);
      }
    }

    // Default analytics structure
    let analytics = {
      views: 0,
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      engagement_rate: 0,
      fetched_at: new Date().toISOString(),
    };

    // Try to fetch from Post for Me API
    if (platformPostIds.postforme_id) {
      try {
        const result = await getPostAnalytics(platformPostIds.postforme_id);
        if (result.success && result.data) {
          analytics = {
            views: result.data.views || 0,
            impressions: result.data.impressions || 0,
            reach: result.data.reach || 0,
            likes: result.data.likes || 0,
            comments: result.data.comments || 0,
            shares: result.data.shares || 0,
            saves: result.data.saves || 0,
            engagement_rate: result.data.engagement_rate || 0,
            fetched_at: new Date().toISOString(),
          };
        }
      } catch (err) {
        console.error('[Analytics] Error fetching from Post for Me:', err);
        // Continue to try account feed fallback
      }
    }

    // If no analytics from postforme_id, try to find in account feeds
    // This is a fallback for posts that may not have direct analytics but appear in feeds
    if (analytics.views === 0 && analytics.likes === 0 && accountIds.length > 0) {
      try {
        // Get the first account's feed and search for our post
        const accountId = accountIds[0];

        // Get the postforme account ID from our accounts table
        const accountRows = await queryDatabase(
          `SELECT postforme_account_id FROM social_accounts WHERE id = ?`,
          [accountId]
        );

        if (accountRows && accountRows.length > 0) {
          const pfmAccountId = (accountRows[0] as { postforme_account_id?: string }).postforme_account_id;

          if (pfmAccountId) {
            const feedResult = await getAccountFeed(pfmAccountId, { limit: 50 });

            if (feedResult.success && feedResult.data) {
              // Try to find our post in the feed by external_id or URL
              const externalId = platformPostIds.external_id;
              const externalUrl = platformPostIds.external_url;

              const matchingPost = feedResult.data.find((item) =>
                (externalId && item.platform_post_id === externalId) ||
                (externalUrl && item.platform_url === externalUrl)
              );

              if (matchingPost?.metrics) {
                const m = matchingPost.metrics;
                analytics = {
                  views: m.views || m.view_count || m.viewCount || 0,
                  impressions: m.impressions || 0,
                  reach: m.reach || 0,
                  likes: m.likes || m.like_count || m.likeCount || 0,
                  comments: m.comments || m.comment_count || m.commentCount || 0,
                  shares: m.shares || m.share_count || 0,
                  saves: m.saved || 0,
                  engagement_rate: m.total_interactions
                    ? ((m.total_interactions / (m.views || m.view_count || 1)) * 100)
                    : 0,
                  fetched_at: new Date().toISOString(),
                };
              }
            }
          }
        }
      } catch (err) {
        console.error('[Analytics] Error fetching from account feed:', err);
      }
    }

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('[Social Posts] Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
