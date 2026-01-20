import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getPosts, getAccounts, mapPlatform } from '@/lib/postforme';

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
 */
export async function POST() {
  try {
    // Get all accounts from Post for Me to map IDs
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

    // Fetch all posts from Post for Me (no status filter to get all including "processed")
    const postsResult = await getPosts({ limit: 100 });

    if (!postsResult.success) {
      return NextResponse.json(
        { error: 'Failed to fetch posts from Post for Me', details: postsResult.error },
        { status: 500 }
      );
    }

    const allPosts = (postsResult.data || []) as unknown as PFMPost[];

    let synced = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const pfmPost of allPosts) {
      try {
        // Extract media URL from the media array
        const mediaUrl = pfmPost.media?.[0]?.url || '';

        // Determine media type from URL (video extensions or default to video for social posts)
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

          // Try to find local account ID
          const localAccount = accountMap.get(acc.id);
          if (localAccount && !localAccountIds.includes(localAccount.id)) {
            localAccountIds.push(localAccount.id);
          }
        });

        // Map Post for Me status to our status
        // "processed" = ready/scheduled, "published" = published, etc.
        let status = pfmPost.status;
        if (status === 'processed') {
          status = 'scheduled'; // Map "processed" to "scheduled" for our UI
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
              pfmPost.status, // Original PFM status
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
              scheduled_at,
              postforme_status, last_synced_at,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
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
              pfmPost.status, // Original PFM status
              pfmPost.created_at || new Date().toISOString(),
            ]
          );
          created++;
        }
        synced++;
      } catch (err) {
        errors.push(`Failed to sync post ${pfmPost.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      created,
      updated,
      total_from_postforme: allPosts.length,
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

    return NextResponse.json({
      last_sync: (result?.[0] as Record<string, unknown>)?.last_sync || null,
      total_posts: (countResult?.[0] as Record<string, unknown>)?.count || 0,
    });
  } catch (error) {
    console.error('[Posts Sync] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
