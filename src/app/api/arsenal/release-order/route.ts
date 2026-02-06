import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/arsenal/release-order
 * Get parent videos ordered by release priority with deployment status
 * Protected by admin-only access
 *
 * FIXED: Now uses video_deployments table for accurate deployment status
 * instead of legacy youtube_url/tiktok_url columns
 */
export async function GET(request: Request) {
  try {
    // Get parent videos with their clips and deployment status
    // FIXED: Count deployments from video_deployments table
    const parents = await queryDatabase(
      `SELECT
        v.id, v.uid, v.title, v.poster_url, v.duration, v.release_order,
        v.created_at, v.artist_name,
        (SELECT COUNT(*) FROM videos c WHERE c.parent_video_id = v.id) as clip_count,
        (SELECT COUNT(DISTINCT c.id) FROM videos c
         LEFT JOIN video_deployments vd ON vd.video_id = c.id
         WHERE c.parent_video_id = v.id
         AND (
           vd.status IN ('published', 'synced')
           OR c.youtube_url IS NOT NULL
           OR c.tiktok_url IS NOT NULL
           OR c.instagram_reels_url IS NOT NULL
         )
        ) as deployed_count
       FROM videos v
       WHERE v.parent_video_id IS NULL AND (v.type != 'clip' OR v.type IS NULL)
       ORDER BY
         CASE WHEN v.release_order IS NULL THEN 1 ELSE 0 END,
         v.release_order ASC,
         v.created_at DESC`,
      []
    );

    // Get clips for each parent, including deployment status from video_deployments
    const clips = await queryDatabase(
      `SELECT
        c.id, c.uid, c.title, c.poster_url, c.duration, c.parent_video_id, c.clip_index,
        c.youtube_url, c.youtube_shorts_url, c.tiktok_url, c.instagram_reels_url,
        c.postforme_status, c.created_at,
        (SELECT COUNT(*) FROM video_deployments vd
         WHERE vd.video_id = c.id AND vd.status IN ('published', 'synced', 'pending', 'scheduled')
        ) as deployment_count,
        (SELECT GROUP_CONCAT(vd.platform || ':' || vd.status) FROM video_deployments vd
         WHERE vd.video_id = c.id
        ) as deployment_details
       FROM videos c
       WHERE c.parent_video_id IS NOT NULL
         AND c.type = 'clip'
       ORDER BY c.clip_index ASC`,
      []
    ) as Array<{
      id: number;
      uid: string;
      title: string;
      poster_url: string | null;
      duration: string | null;
      parent_video_id: number;
      clip_index: number | null;
      youtube_url: string | null;
      youtube_shorts_url: string | null;
      tiktok_url: string | null;
      instagram_reels_url: string | null;
      postforme_status: string | null;
      created_at: string;
      deployment_count: number;
      deployment_details: string | null;
    }>;

    // Group clips by parent
    const clipsByParent: Record<number, typeof clips> = {};
    for (const clip of clips || []) {
      if (!clipsByParent[clip.parent_video_id]) {
        clipsByParent[clip.parent_video_id] = [];
      }
      clipsByParent[clip.parent_video_id].push(clip);
    }

    // Find the next clip to deploy across all parents
    // FIXED: Check both video_deployments AND legacy columns
    let nextToDeployId: number | null = null;
    for (const parent of parents || []) {
      const parentClips = clipsByParent[(parent as { id: number }).id] || [];
      for (const clip of parentClips) {
        // A clip is deployed if it has entries in video_deployments OR legacy URL columns
        const isDeployed = clip.deployment_count > 0 ||
          clip.youtube_url ||
          clip.youtube_shorts_url ||
          clip.tiktok_url ||
          clip.instagram_reels_url;

        if (!isDeployed) {
          nextToDeployId = clip.id;
          break;
        }
      }
      if (nextToDeployId) break;
    }

    return NextResponse.json({
      parents: parents || [],
      clipsByParent,
      nextToDeployId,
    });
  } catch (error) {
    console.error('[Arsenal] Release order fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch release order' }, { status: 500 });
  }
}

/**
 * PUT /api/arsenal/release-order
 * Update release order for parent videos
 */
export async function PUT(request: NextRequest) {
  try {
    // Server-side authentication using httpOnly cookies
    const user = getUserFromRequest(request);
    if (!isAdminUser(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Admins only' },
        { status: 403 }
      );
    }

    const body = await request.json() as { videos: Array<{ id: number; order: number }> };
    const { videos } = body;

    if (!videos || !Array.isArray(videos)) {
      return NextResponse.json({ error: 'videos array required' }, { status: 400 });
    }

    // Update each video's release order
    for (const video of videos) {
      await executeQuery(
        `UPDATE videos SET release_order = ?, updated_at = datetime('now') WHERE id = ?`,
        [video.order, video.id]
      );
    }

    return NextResponse.json({
      message: `Updated ${videos.length} video release orders`,
      updated: videos.length
    });
  } catch (error) {
    console.error('[Arsenal] Release order update error:', error);
    return NextResponse.json({ error: 'Failed to update release order' }, { status: 500 });
  }
}
