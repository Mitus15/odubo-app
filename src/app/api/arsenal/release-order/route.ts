import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/arsenal/release-order
 * Get parent videos ordered by release priority with deployment status
 */
export async function GET() {
  try {
    // Get parent videos with their clips and deployment status
    const parents = await queryDatabase(
      `SELECT
        v.id, v.uid, v.title, v.poster_url, v.duration, v.release_order,
        v.created_at, v.artist_name,
        (SELECT COUNT(*) FROM videos c WHERE c.parent_video_id = v.id) as clip_count,
        (SELECT COUNT(*) FROM videos c
         WHERE c.parent_video_id = v.id
         AND (c.youtube_url IS NOT NULL OR c.tiktok_url IS NOT NULL OR c.instagram_reels_url IS NOT NULL)
        ) as deployed_count
       FROM videos v
       WHERE v.type = 'video' OR (v.type IS NULL AND v.parent_video_id IS NULL)
       ORDER BY
         CASE WHEN v.release_order IS NULL THEN 1 ELSE 0 END,
         v.release_order ASC,
         v.created_at DESC`,
      []
    );

    // Get clips for each parent
    const clips = await queryDatabase(
      `SELECT
        id, uid, title, poster_url, duration, parent_video_id, clip_index,
        youtube_url, youtube_shorts_url, tiktok_url, instagram_reels_url,
        postforme_status, created_at
       FROM videos
       WHERE parent_video_id IS NOT NULL
         AND type = 'clip'
       ORDER BY clip_index ASC`,
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
    let nextToDeployId: number | null = null;
    for (const parent of parents || []) {
      const parentClips = clipsByParent[(parent as { id: number }).id] || [];
      for (const clip of parentClips) {
        const isDeployed = clip.youtube_url || clip.tiktok_url || clip.instagram_reels_url;
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
