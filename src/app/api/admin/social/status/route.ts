import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { getPost } from '@/lib/postforme';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

interface PostData {
  id: string;
  status: string;
  scheduled_at?: string;
  published_at?: string;
  platforms?: Array<{
    platform: string;
    status: string;
    url?: string;
    error?: string;
  }>;
}

/**
 * GET /api/admin/social/status?content_id=123
 * Fetch current status from PostForMe for a piece of content
 */
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('content_id');

    if (!contentId) {
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 });
    }

    // Get the content and its postforme_id
    const contentResult = await queryDatabase(
      'SELECT id, postforme_id, postforme_status, platform_post_ids, platform_urls FROM social_content WHERE id = ?',
      [contentId]
    );
    const content = contentResult?.[0] as { 
      id: number; 
      postforme_id: string | null;
      postforme_status: string | null;
      platform_post_ids: string | null;
      platform_urls: string | null;
    } | undefined;

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if (!content.postforme_id) {
      return NextResponse.json({
        success: true,
        status: 'not_published',
        message: 'Content has not been published to PostForMe yet',
      });
    }

    // Fetch status from PostForMe API
    const result = await getPost(content.postforme_id);

    if (!result.success || !result.data) {
      // If PostForMe doesn't have it, return local status
      return NextResponse.json({
        success: true,
        status: content.postforme_status || 'unknown',
        postforme_id: content.postforme_id,
        platform_post_ids: content.platform_post_ids ? JSON.parse(content.platform_post_ids) : {},
        platform_urls: content.platform_urls ? JSON.parse(content.platform_urls) : {},
        source: 'local',
      });
    }

    const post = result.data as PostData;

    // Parse platform-specific data
    const platformPostIds: Record<string, string> = {};
    const platformUrls: Record<string, string> = {};
    const platformStatuses: Record<string, string> = {};

    if (post.platforms && Array.isArray(post.platforms)) {
      post.platforms.forEach((p) => {
        const platform = p.platform.toLowerCase();
        platformStatuses[platform] = p.status;
        if (p.url) {
          platformUrls[platform] = p.url;
        }
      });
    }

    // Update local database with fresh status
    const now = new Date().toISOString();
    await executeQuery(
      `UPDATE social_content 
       SET postforme_status = ?,
           platform_post_ids = ?,
           platform_urls = ?,
           last_status_sync = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        post.status,
        JSON.stringify(platformPostIds),
        JSON.stringify(platformUrls),
        now,
        now,
        contentId,
      ]
    );

    return NextResponse.json({
      success: true,
      status: post.status,
      postforme_id: content.postforme_id,
      scheduled_at: post.scheduled_at,
      published_at: post.published_at,
      platform_statuses: platformStatuses,
      platform_urls: platformUrls,
      source: 'postforme',
      synced_at: now,
    });
  } catch (error) {
    console.error('[Social Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/social/status
 * Batch sync status for multiple content items
 */
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const contentIds = (body as { content_ids?: number[] }).content_ids || [];

    if (contentIds.length === 0) {
      return NextResponse.json({ error: 'content_ids array is required' }, { status: 400 });
    }

    // Get all content with PostForMe IDs
    const placeholders = contentIds.map(() => '?').join(', ');
    const contentResult = await queryDatabase(
      `SELECT id, postforme_id FROM social_content WHERE id IN (${placeholders}) AND postforme_id IS NOT NULL`,
      contentIds
    );

    if (!contentResult || contentResult.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No content found with PostForMe IDs',
      });
    }

    const updates = [];
    const errors = [];

    for (const content of contentResult as Array<{ id: number; postforme_id: string }>) {
      try {
        const result = await getPost(content.postforme_id);

        if (result.success && result.data) {
          const post = result.data as PostData;
          const now = new Date().toISOString();

          // Extract platform URLs
          const platformUrls: Record<string, string> = {};
          if (post.platforms && Array.isArray(post.platforms)) {
            post.platforms.forEach((p) => {
              if (p.url) {
                platformUrls[p.platform.toLowerCase()] = p.url;
              }
            });
          }

          await executeQuery(
            `UPDATE social_content 
             SET postforme_status = ?,
                 platform_urls = ?,
                 last_status_sync = ?,
                 updated_at = ?
             WHERE id = ?`,
            [
              post.status,
              JSON.stringify(platformUrls),
              now,
              now,
              content.id,
            ]
          );

          updates.push({ content_id: content.id, status: post.status });
        }
      } catch (err) {
        errors.push({ content_id: content.id, error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    return NextResponse.json({
      success: true,
      synced: updates.length,
      failed: errors.length,
      updates,
      errors,
    });
  } catch (error) {
    console.error('[Social Status Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync status', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
