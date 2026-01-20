import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getPosts, getAccounts, getAccountFeed, mapPlatform, FeedItem, SocialAccount } from '@/lib/postforme';

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

// Extended feed item with optional social_post_id
interface ExtendedFeedItem extends FeedItem {
  social_post_id?: string;
  social_post_result_id?: string;
}

// Generate a unique ID for feed posts not from Post for Me
function generateFeedPostId(platform: string, platformPostId: string): string {
  return `feed_${platform}_${platformPostId}`;
}

/**
 * POST /api/social/posts/sync
 * Sync all posts from Post for Me into local database
 * This pulls the source of truth from Post for Me
 *
 * Three-phase sync:
 * 1. Fetch posts from /social-posts API (scheduled, drafts)
 * 2. Fetch feeds from /social-account-feeds to get published posts & metrics
 * 3. Import feed posts that weren't created through Post for Me
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
    const pfmAccountMap = new Map<string, SocialAccount>();

    (localAccounts || []).forEach((acc: Record<string, unknown>) => {
      if (acc.postforme_account_id) {
        accountMap.set(acc.postforme_account_id as string, {
          id: acc.id as string,
          platform: acc.platform as string,
        });
      }
    });

    accountsResult.data.forEach(acc => {
      pfmAccountMap.set(acc.id, acc);
    });

    // Phase 1: Fetch all posts from Post for Me posts API
    const postsResult = await getPosts({ limit: 100 });
    if (!postsResult.success) {
      return NextResponse.json(
        { error: 'Failed to fetch posts from Post for Me', details: postsResult.error },
        { status: 500 }
      );
    }

    const allPfmPosts = (postsResult.data || []) as unknown as PFMPost[];

    // Phase 2: Fetch feeds from all connected accounts
    const feedPromises = accountsResult.data.map(acc =>
      getAccountFeed(acc.id, { limit: 50 }).then(result => ({
        account: acc,
        items: result.success ? (result.data || []) as ExtendedFeedItem[] : []
      }))
    );
    const feedResults = await Promise.all(feedPromises);

    // Build maps for matching
    const publishedPostsMap = new Map<string, ExtendedFeedItem & { allPlatformItems: ExtendedFeedItem[], account: SocialAccount }>();
    const directFeedPosts: Array<{ item: ExtendedFeedItem; account: SocialAccount }> = [];

    feedResults.forEach(({ account, items }) => {
      items.forEach(item => {
        if (item.social_post_id) {
          // This post came from Post for Me
          const existing = publishedPostsMap.get(item.social_post_id);
          if (existing) {
            existing.allPlatformItems.push(item);
          } else {
            publishedPostsMap.set(item.social_post_id, {
              ...item,
              allPlatformItems: [item],
              account
            });
          }
        } else {
          // This post was created directly on the platform
          directFeedPosts.push({ item, account });
        }
      });
    });

    let synced = 0;
    let created = 0;
    let updated = 0;
    let imported = 0;
    const errors: string[] = [];

    // Process posts from the posts API (scheduled/draft posts)
    for (const pfmPost of allPfmPosts) {
      try {
        const publishedInfo = publishedPostsMap.get(pfmPost.id);

        const mediaUrl = pfmPost.media?.[0]?.url || '';
        const isVideo = mediaUrl.includes('.mp4') ||
                        mediaUrl.includes('.mov') ||
                        mediaUrl.includes('videodelivery.net') ||
                        mediaUrl.includes('/videos/');
        const mediaType = isVideo ? 'video' : 'image';

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

        let status = pfmPost.status;
        let publishedAt: string | null = null;
        const platformPostIds: Record<string, string> = {};

        if (publishedInfo) {
          status = 'published';
          publishedAt = publishedInfo.posted_at;
          publishedInfo.allPlatformItems.forEach(item => {
            const platform = mapPlatform(item.platform);
            platformPostIds[platform] = item.platform_post_id;
          });
        } else if (status === 'processed') {
          status = 'scheduled';
        }

        const existing = await queryDatabase(
          `SELECT id FROM social_posts WHERE id = ?`,
          [pfmPost.id]
        );

        if (existing && existing.length > 0) {
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
        publishedPostsMap.delete(pfmPost.id);
      } catch (err) {
        errors.push(`Failed to sync post ${pfmPost.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // Phase 3: Import direct feed posts (not created through Post for Me)
    for (const { item, account } of directFeedPosts) {
      try {
        const platform = mapPlatform(item.platform);
        const postId = generateFeedPostId(platform, item.platform_post_id);

        // Get media URL and thumbnail
        const mediaUrl = item.media?.[0]?.url || '';
        const thumbnailUrl = item.media?.[0]?.thumbnail_url || null;
        const isVideo = mediaUrl.includes('.mp4') ||
                        mediaUrl.includes('.mov') ||
                        mediaUrl.includes('cdninstagram.com/o1/v/') ||
                        mediaUrl.includes('video');
        const mediaType = isVideo ? 'video' : 'image';

        // Get local account ID
        const localAccount = accountMap.get(account.id);

        // Check if already imported
        const existing = await queryDatabase(
          `SELECT id FROM social_posts WHERE id = ? OR platform_post_ids LIKE ?`,
          [postId, `%"${item.platform_post_id}"%`]
        );

        if (existing && existing.length > 0) {
          // Update existing with latest metrics
          await executeQuery(
            `UPDATE social_posts SET
              last_synced_at = datetime('now'),
              updated_at = datetime('now')
            WHERE id = ? OR platform_post_ids LIKE ?`,
            [postId, `%"${item.platform_post_id}"%`]
          );
          updated++;
        } else {
          // Create new imported post
          await executeQuery(
            `INSERT INTO social_posts (
              id, status, created_by,
              media_type, media_url, thumbnail_url,
              caption, platforms, account_ids,
              published_at, platform_post_ids,
              postforme_status, last_synced_at,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
            [
              postId,
              'published',
              'imported',
              mediaType,
              mediaUrl,
              thumbnailUrl,
              item.caption || null,
              JSON.stringify([platform]),
              JSON.stringify(localAccount ? [localAccount.id] : []),
              item.posted_at,
              JSON.stringify({ [platform]: item.platform_post_id }),
              'imported',
              item.posted_at,
            ]
          );
          imported++;
          created++;
        }
        synced++;
      } catch (err) {
        errors.push(`Failed to import feed post ${item.platform_post_id}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      created,
      updated,
      imported,
      total_from_postforme: allPfmPosts.length,
      total_from_feeds: directFeedPosts.length,
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

    const importedCount = await queryDatabase(
      `SELECT COUNT(*) as count FROM social_posts WHERE created_by = 'imported'`
    );

    return NextResponse.json({
      last_sync: (result?.[0] as Record<string, unknown>)?.last_sync || null,
      total_posts: (countResult?.[0] as Record<string, unknown>)?.count || 0,
      published: (publishedCount?.[0] as Record<string, unknown>)?.count || 0,
      scheduled: (scheduledCount?.[0] as Record<string, unknown>)?.count || 0,
      imported: (importedCount?.[0] as Record<string, unknown>)?.count || 0,
    });
  } catch (error) {
    console.error('[Posts Sync] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
