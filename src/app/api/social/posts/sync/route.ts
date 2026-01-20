import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getPosts, getAccounts, getAccountFeed, mapPlatform, FeedItem } from '@/lib/postforme';

export const runtime = 'edge';

// Extended type for actual Post for Me API response
interface PFMPost {
  id: string;
  caption?: string;
  status: string;
  media?: Array<{
    url: string;
    thumbnail_url?: string;
  }>;
  social_accounts?: Array<{
    id: string;
    platform: string;
    username: string;
  }>;
  scheduled_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * POST /api/social/posts/sync
 * Sync all posts from Post for Me into local database
 * This pulls the source of truth from Post for Me
 *
 * Two-phase sync:
 * 1. Fetch posts from /social-posts API (scheduled, drafts)
 * 2. Fetch feeds from /social-account-feeds to get actual published status & metrics
 */
export async function POST() {
  try {
    // Get all accounts from Post for Me
    const accountsResult = await getAccounts();
    if (!accountsResult.success || !accountsResult.data) {
      return NextResponse.json(
        { error: 'Failed to fetch accounts from Post for Me', details: accountsResult.error },
        { status: 500 }
      );
    }

    // Build a map of postforme account ID -> local account ID
    const localAccounts = await queryDatabase(
      `SELECT id, postforme_account_id, platform FROM social_accounts WHERE postforme_account_id IS NOT NULL`
    );

    const accountMap = new Map<string, { id: string; platform: string }>();
    (localAccounts || []).forEach((acc: Record<string, unknown>) => {
      if (acc.postforme_account_id) {
        accountMap.set(acc.postforme_account_id as string, {
          id: acc.id as string,
          platform: acc.platform as string,
        });
      }
    });

    // Phase 1: Fetch all posts from Post for Me posts API
    const postsResult = await getPosts({ limit: 100 });
    if (!postsResult.success) {
      return NextResponse.json(
        { error: 'Failed to fetch posts from Post for Me', details: postsResult.error },
        { status: 500 }
      );
    }

    const allPosts = (postsResult.data || []) as unknown as PFMPost[];

    // Phase 2: Fetch feeds from all connected accounts to get actual published status
    const feedPromises = accountsResult.data.map(acc =>
      getAccountFeed(acc.id, { limit: 50 })
    );
    const feedResults = await Promise.all(feedPromises);

    // Build a map of social_post_id -> feed item (for matching published posts)
    const publishedPostsMap = new Map<string, FeedItem & { allPlatformItems: FeedItem[] }>();

    feedResults.forEach(result => {
      if (result.success && result.data) {
        result.data.forEach(item => {
          // Feed items that came from our posts have social_post_id
          const socialPostId = (item as FeedItem & { social_post_id?: string }).social_post_id;
          if (socialPostId) {
            const existing = publishedPostsMap.get(socialPostId);
            if (existing) {
              // Same post published to multiple platforms - aggregate
              existing.allPlatformItems.push(item);
            } else {
              publishedPostsMap.set(socialPostId, {
                ...item,
                allPlatformItems: [item]
              });
            }
          }
        });
      }
    });

    let synced = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process posts from the posts API
    for (const pfmPost of allPosts) {
      try {
        // Check if this post has been published (exists in feed)
        const publishedInfo = publishedPostsMap.get(pfmPost.id);

        // Extract media URL from the media array
        const mediaUrl = pfmPost.media?.[0]?.url || '';

        // Determine media type from URL
        const isVideo = mediaUrl.includes('.mp4') ||
                        mediaUrl.includes('.mov') ||
                        mediaUrl.includes('videodelivery.net') ||
                        mediaUrl.includes('/videos/');
        const mediaType = isVideo ? 'video' : 'image';

        // Extract platforms and account IDs from social_accounts array
        const platforms: string[] = [];
        const localAccountIds: string[] = [];

        (pfmPost.social_accounts || []).forEach(acc => {
          const platform = mapPlatform(acc.platform);
          if (!platforms.includes(platform)) {
            platforms.push(platform);
          }
          const localAccount = accountMap.get(acc.id);
          if (localAccount && !localAccountIds.includes(localAccount.id)) {
            localAccountIds.push(localAccount.id);
          }
        });

        // Determine status: if in feed, it's published; otherwise use PFM status
        let status = pfmPost.status;
        let publishedAt: string | null = null;
        let platformPostIds: Record<string, string> = {};
        let platformUrls: Record<string, string> = {};

        if (publishedInfo) {
          status = 'published';
          publishedAt = publishedInfo.posted_at;

          // Collect platform-specific post IDs and URLs
          publishedInfo.allPlatformItems.forEach(item => {
            const platform = mapPlatform(item.platform);
            platformPostIds[platform] = item.platform_post_id;
            if (item.platform_url) {
              platformUrls[platform] = item.platform_url;
            }
          });
        } else if (status === 'processed') {
          status = 'scheduled';
        }

        // Check if post already exists
        const existing = await queryDatabase(
          `SELECT id FROM social_posts WHERE id = ?`,
          [pfmPost.id]
        );

        if (existing && existing.length > 0) {
          // Update existing post
          await executeQuery(
            `UPDATE social_posts SET
              status = ?,
              caption = ?,
              media_url = ?,
              media_type = ?,
              platforms = ?,
              account_ids = ?,
              scheduled_at = ?,
              published_at = ?,
              platform_post_ids = ?,
              postforme_status = ?,
              last_synced_at = datetime('now'),
              updated_at = datetime('now')
            WHERE id = ?`,
            [
              status,
              pfmPost.caption || null,
              mediaUrl,
              mediaType,
              JSON.stringify(platforms),
              JSON.stringify(localAccountIds),
              pfmPost.scheduled_at || null,
              publishedAt,
              JSON.stringify(platformPostIds),
              pfmPost.status,
              pfmPost.id,
            ]
          );
          updated++;
        } else {
          // Create new post
          await executeQuery(
            `INSERT INTO social_posts (
              id, status, created_by,
              media_type, media_url,
              caption, platforms, account_ids,
              scheduled_at, published_at, platform_post_ids,
              postforme_status, last_synced_at,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
            [
              pfmPost.id,
              status,
              'postforme',
              mediaType,
              mediaUrl,
              pfmPost.caption || null,
              JSON.stringify(platforms),
              JSON.stringify(localAccountIds),
              pfmPost.scheduled_at || null,
              publishedAt,
              JSON.stringify(platformPostIds),
              pfmPost.status,
              pfmPost.created_at || new Date().toISOString(),
            ]
          );
          created++;
        }
        synced++;

        // Remove from map so we know which ones we've processed
        publishedPostsMap.delete(pfmPost.id);
      } catch (err) {
        errors.push(`Failed to sync post ${pfmPost.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // Phase 3: Handle any published posts in feed that aren't in posts API
    // (These might be older posts or posts created directly on platforms)
    // For now, we skip these as they weren't created through our system

    return NextResponse.json({
      success: true,
      synced,
      created,
      updated,
      total_from_postforme: allPosts.length,
      published_found_in_feed: publishedPostsMap.size, // Posts we matched to feed
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Posts Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync posts', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/posts/sync
 * Get sync status / last sync time
 */
export async function GET() {
  try {
    const result = await queryDatabase(
      `SELECT MAX(last_synced_at) as last_sync FROM social_posts WHERE last_synced_at IS NOT NULL`
    );

    const countResult = await queryDatabase(
      `SELECT COUNT(*) as count FROM social_posts`
    );

    const publishedCount = await queryDatabase(
      `SELECT COUNT(*) as count FROM social_posts WHERE status = 'published'`
    );

    const scheduledCount = await queryDatabase(
      `SELECT COUNT(*) as count FROM social_posts WHERE status = 'scheduled'`
    );

    return NextResponse.json({
      last_sync: (result?.[0] as Record<string, unknown>)?.last_sync || null,
      total_posts: (countResult?.[0] as Record<string, unknown>)?.count || 0,
      published: (publishedCount?.[0] as Record<string, unknown>)?.count || 0,
      scheduled: (scheduledCount?.[0] as Record<string, unknown>)?.count || 0,
    });
  } catch (error) {
    console.error('[Posts Sync] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
