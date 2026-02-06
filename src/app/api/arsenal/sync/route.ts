import { NextResponse, NextRequest } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getPost, mapPlatform } from '@/lib/postforme';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface Deployment {
  id: number;
  video_id: number;
  platform: string;
  postforme_post_id: string;
  parent_video_id: number | null;
}

/**
 * Get the legacy column name for a platform
 */
function getLegacyColumnForPlatform(platform: string, isClip: boolean): string {
  switch (platform) {
    case 'youtube':
      return isClip ? 'youtube_shorts_url' : 'youtube_url';
    case 'tiktok':
      return 'tiktok_url';
    case 'instagram':
      return 'instagram_reels_url';
    default:
      return '';
  }
}

/**
 * POST /api/arsenal/sync
 * Sync platform URLs from Post for Me after publishing
 *
 * FIXED: Now queries video_deployments table (where deploy writes)
 * instead of videos.postforme_post_id (which was never populated)
 *
 * Also makes videos public after successful sync.
 */
export async function POST(request: NextRequest) {
  try {
    // Server-side authentication using httpOnly cookies
    const user = getUserFromRequest(request);
    if (!isAdminUser(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Admins only' },
        { status: 403 }
      );
    }

    // Get all deployments that need syncing from video_deployments table
    // (have a postforme_post_id but no external_url)
    const deployments = await queryDatabase(
      `SELECT
        vd.id,
        vd.video_id,
        vd.platform,
        vd.postforme_post_id,
        v.parent_video_id
       FROM video_deployments vd
       JOIN videos v ON v.id = vd.video_id
       WHERE vd.postforme_post_id IS NOT NULL
         AND (vd.external_url IS NULL OR vd.external_url = '')
         AND vd.status IN ('pending', 'published', 'scheduled')`,
      []
    ) as Deployment[];

    if (!deployments || deployments.length === 0) {
      return NextResponse.json({
        message: 'No deployments to sync',
        updated: 0,
        errors: [],
      });
    }

    let updated = 0;
    let madePublic = 0;
    const errors: string[] = [];

    for (const deployment of deployments) {
      try {
        // Fetch post status from Post for Me
        const postResponse = await getPost(deployment.postforme_post_id);

        if (!postResponse.success || !postResponse.data) {
          errors.push(`Deployment ${deployment.id}: Failed to fetch post ${deployment.postforme_post_id}`);
          continue;
        }

        const post = postResponse.data;

        console.log('[Arsenal Sync]', {
          deploymentId: deployment.id,
          videoId: deployment.video_id,
          postId: deployment.postforme_post_id,
          status: post.status,
          platform: post.platform,
          hasUrl: !!post.external_url,
          scheduledAt: post.scheduled_at,
          publishedAt: post.published_at,
        });

        // Only update if the post is published and has an external URL
        if (post.status !== 'published' || !post.external_url) {
          if (post.status === 'scheduled') {
            console.log(`[Arsenal Sync] Deployment ${deployment.id} still scheduled for:`, post.scheduled_at);
          } else if (post.status === 'failed') {
            // Mark as failed in video_deployments
            await executeQuery(
              `UPDATE video_deployments
               SET status = 'failed', error_message = ?
               WHERE id = ?`,
              [post.error_message || 'Post failed on platform', deployment.id]
            );
          }
          continue;
        }

        // Update video_deployments with external URL
        await executeQuery(
          `UPDATE video_deployments
           SET external_url = ?,
               external_id = ?,
               status = 'synced',
               synced_at = datetime('now')
           WHERE id = ?`,
          [post.external_url, post.external_id || null, deployment.id]
        );

        // Also update legacy columns on videos table for backward compatibility
        const platform = mapPlatform(post.platform);
        const isClip = deployment.parent_video_id !== null;
        const legacyColumn = getLegacyColumnForPlatform(platform, isClip);

        if (legacyColumn) {
          // Update the legacy URL column AND the postforme fields
          await executeQuery(
            `UPDATE videos
             SET ${legacyColumn} = ?,
                 postforme_post_id = ?,
                 postforme_status = 'published'
             WHERE id = ?`,
            [post.external_url, deployment.postforme_post_id, deployment.video_id]
          );
        }

        // Make the video public after successful sync
        const publicResult = await executeQuery(
          `UPDATE videos
           SET is_public = 1,
               publication_status = 'live',
               updated_at = datetime('now')
           WHERE id = ? AND (is_public IS NULL OR is_public = 0)`,
          [deployment.video_id]
        );

        // Check if we actually made the video public
        if (publicResult && typeof publicResult === 'object' && 'changes' in publicResult && (publicResult as any).changes > 0) {
          madePublic++;
          console.log(`[Arsenal Sync] Made video ${deployment.video_id} public`);
        }

        updated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Deployment ${deployment.id}: ${message}`);
      }
    }

    return NextResponse.json({
      message: `Synced ${updated} of ${deployments.length} deployments${madePublic > 0 ? `, ${madePublic} made public` : ''}`,
      updated,
      madePublic,
      total: deployments.length,
      errors,
    });
  } catch (error) {
    console.error('[Arsenal] Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync deployments' },
      { status: 500 }
    );
  }
}
