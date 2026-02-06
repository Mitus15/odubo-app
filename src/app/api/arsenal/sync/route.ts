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
 * Sync platform URLs from PostForMe after publishing
 *
 * Groups deployments by postforme_post_id to avoid redundant API calls,
 * since one PostForMe post can cover multiple platforms.
 * Parses the per-platform status/URL data from PostForMe's platforms array.
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

    // Group deployments by postforme_post_id to avoid redundant API calls
    // One PostForMe post can cover multiple platforms
    const byPostId = new Map<string, Deployment[]>();
    for (const d of deployments) {
      const group = byPostId.get(d.postforme_post_id) || [];
      group.push(d);
      byPostId.set(d.postforme_post_id, group);
    }

    let updated = 0;
    let madePublic = 0;
    const errors: string[] = [];

    for (const [postformePostId, group] of byPostId) {
      try {
        // One API call per unique PostForMe post ID
        const postResponse = await getPost(postformePostId);

        if (!postResponse.success || !postResponse.data) {
          errors.push(`Post ${postformePostId}: Failed to fetch from PostForMe`);
          continue;
        }

        const post = postResponse.data;

        console.log('[Arsenal Sync]', {
          postId: postformePostId,
          deploymentCount: group.length,
          platforms: group.map(d => d.platform),
          status: post.status,
          hasPlatformsArray: !!post.platforms?.length,
        });

        // Build per-platform data from PostForMe response
        const platformData = new Map<string, { url?: string; externalId?: string; status: string; error?: string }>();

        if (post.platforms && Array.isArray(post.platforms)) {
          // Multi-platform post — use per-platform data
          for (const p of post.platforms) {
            const normalizedPlatform = mapPlatform(p.platform);
            platformData.set(normalizedPlatform, {
              url: p.url,
              externalId: p.external_id,
              status: p.status,
              error: p.error,
            });
          }
        } else {
          // Single-platform post — use top-level fields
          const normalizedPlatform = mapPlatform(post.platform);
          platformData.set(normalizedPlatform, {
            url: post.external_url,
            externalId: post.external_id,
            status: post.status,
          });
        }

        // Update each deployment row with its platform-specific data
        for (const deployment of group) {
          const pData = platformData.get(deployment.platform);

          // If no data for this platform, check the overall post status
          const effectiveStatus = pData?.status || post.status;
          const effectiveUrl = pData?.url || (group.length === 1 ? post.external_url : undefined);
          const effectiveExternalId = pData?.externalId || (group.length === 1 ? post.external_id : undefined);

          if (effectiveStatus === 'failed') {
            await executeQuery(
              `UPDATE video_deployments
               SET status = 'failed', error_message = ?
               WHERE id = ?`,
              [pData?.error || post.error_message || 'Post failed on platform', deployment.id]
            );
            continue;
          }

          if (effectiveStatus === 'scheduled') {
            console.log(`[Arsenal Sync] Deployment ${deployment.id} (${deployment.platform}) still scheduled`);
            continue;
          }

          // Only update if published and has URL
          if (effectiveStatus !== 'published' || !effectiveUrl) {
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
            [effectiveUrl, effectiveExternalId || null, deployment.id]
          );

          // Also update legacy columns on videos table for backward compatibility
          const isClip = deployment.parent_video_id !== null;
          const legacyColumn = getLegacyColumnForPlatform(deployment.platform, isClip);

          if (legacyColumn) {
            await executeQuery(
              `UPDATE videos
               SET ${legacyColumn} = ?,
                   postforme_post_id = ?,
                   postforme_status = 'published'
               WHERE id = ?`,
              [effectiveUrl, postformePostId, deployment.video_id]
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

          if (publicResult && typeof publicResult === 'object' && 'changes' in publicResult && (publicResult as any).changes > 0) {
            madePublic++;
            console.log(`[Arsenal Sync] Made video ${deployment.video_id} public`);
          }

          updated++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Post ${postformePostId}: ${message}`);
      }
    }

    return NextResponse.json({
      message: `Synced ${updated} of ${deployments.length} deployments (${byPostId.size} API calls)${madePublic > 0 ? `, ${madePublic} made public` : ''}`,
      updated,
      madePublic,
      total: deployments.length,
      postsFetched: byPostId.size,
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
