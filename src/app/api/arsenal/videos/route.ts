import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/arsenal/videos
 * Fetch all videos with Arsenal-related fields for the content library
 * Protected by admin-only access
 */
export async function GET(request: Request) {
  try {
    console.log('[Arsenal] Fetching videos...');
    // Fetch ALL videos for Arsenal management (including unpublished)
    // LEFT JOIN tracks and albums to get music relationship names
    // LEFT JOIN video_deployments to get deployment status per platform
    const results = await queryDatabase(
      `SELECT
        v.id,
        v.uid,
        v.title,
        v.description,
        v.original_filename,
        v.poster_url,
        v.duration,
        v.parent_video_id,
        v.clip_index,
        v.total_siblings,
        v.category,
        v.mood,
        v.type,
        v.artist_name,
        v.track_id,
        v.album_id,
        t.title as track_title,
        a.title as album_title,
        v.is_public,
        v.publication_status,
        v.youtube_url,
        v.youtube_shorts_url,
        v.tiktok_url,
        v.instagram_reels_url,
        v.postforme_post_id,
        v.postforme_status,
        v.social_description,
        v.social_hashtags,
        v.social_first_comment,
        v.social_visibility,
        v.created_at,
        (SELECT COUNT(*) FROM video_deployments vd WHERE vd.video_id = v.id) as deployment_count,
        (SELECT GROUP_CONCAT(vd.platform || ':' || vd.status) FROM video_deployments vd WHERE vd.video_id = v.id) as deployment_details
      FROM videos v
      LEFT JOIN tracks t ON v.track_id = t.id
      LEFT JOIN albums a ON v.album_id = a.id
      WHERE COALESCE(v.status, 'published') != 'archived'
      ORDER BY
        CASE WHEN v.parent_video_id IS NULL THEN 0 ELSE 1 END,
        v.parent_video_id,
        v.clip_index,
        v.created_at DESC`,
      []
    );

    return NextResponse.json({ videos: results || [] });
  } catch (error) {
    console.error('[Arsenal] Error fetching videos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch videos', details: errorMessage },
      { status: 500 }
    );
  }
}
