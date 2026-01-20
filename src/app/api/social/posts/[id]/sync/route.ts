import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getPost as getPostFromPFM } from '@/lib/postforme';

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
 * POST /api/social/posts/[id]/sync
 * Sync post status from Post for Me API
 * Updates local post status, platform URLs, and published_at
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get post from DB
    const rows = await queryDatabase(
      `SELECT id, status, platform_post_ids FROM social_posts WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const post = rows[0] as { id: string; status: string; platform_post_ids?: string };
    const platformPostIds = parseJSON<Record<string, string>>(post.platform_post_ids, {});

    // Check if we have a Post for Me ID
    if (!platformPostIds.postforme_id) {
      return NextResponse.json(
        { error: 'No Post for Me ID found. Post may not have been published yet.' },
        { status: 400 }
      );
    }

    // Fetch from Post for Me
    const pfmResult = await getPostFromPFM(platformPostIds.postforme_id);

    if (!pfmResult.success || !pfmResult.data) {
      return NextResponse.json(
        { error: `Failed to fetch from Post for Me: ${pfmResult.error || 'Unknown error'}` },
        { status: 500 }
      );
    }

    const pfmPost = pfmResult.data;

    // Map Post for Me status to our status
    let newStatus = post.status;
    if (pfmPost.status === 'published') {
      newStatus = 'published';
    } else if (pfmPost.status === 'scheduled') {
      newStatus = 'scheduled';
    } else if (pfmPost.status === 'failed') {
      newStatus = 'failed';
    }

    // Update platform_post_ids with external URL and ID
    const updatedPlatformPostIds = {
      ...platformPostIds,
      external_url: pfmPost.external_url,
      external_id: pfmPost.external_id,
    };

    // Update local DB
    await executeQuery(
      `UPDATE social_posts SET
        status = ?,
        platform_post_ids = ?,
        published_at = COALESCE(?, published_at),
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        newStatus,
        JSON.stringify(updatedPlatformPostIds),
        pfmPost.published_at || null,
        id,
      ]
    );

    // Log activity
    await executeQuery(
      `INSERT INTO social_activity_log (id, user_id, action, target_type, target_id, details)
       VALUES (?, 'system', 'synced', 'post', ?, ?)`,
      [
        crypto.randomUUID().split('-')[0],
        id,
        JSON.stringify({
          previous_status: post.status,
          new_status: newStatus,
          external_url: pfmPost.external_url,
        }),
      ]
    );

    // Fetch updated post
    const updatedRows = await queryDatabase(
      `SELECT * FROM social_posts WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      synced: true,
      previous_status: post.status,
      new_status: newStatus,
      external_url: pfmPost.external_url,
      post: updatedRows?.[0] || null,
    });
  } catch (error) {
    console.error('[Social Posts] Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync post', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
