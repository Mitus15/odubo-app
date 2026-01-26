import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/arsenal/videos
 * Fetch all videos with Arsenal-related fields for the content library
 */
export async function GET() {
  try {
    const results = await queryDatabase(
      `SELECT
        id,
        uid,
        title,
        description,
        original_filename,
        poster_url,
        duration,
        parent_video_id,
        clip_index,
        total_siblings,
        category,
        mood,
        type,
        artist_name,
        youtube_url,
        youtube_shorts_url,
        tiktok_url,
        instagram_reels_url,
        postforme_post_id,
        postforme_status,
        social_description,
        social_hashtags,
        social_first_comment,
        social_visibility,
        created_at
      FROM videos
      WHERE publication_status = 'live' OR status = 'published'
      ORDER BY
        CASE WHEN parent_video_id IS NULL THEN 0 ELSE 1 END,
        parent_video_id,
        clip_index,
        created_at DESC`,
      []
    );

    return NextResponse.json({ videos: results || [] });
  } catch (error) {
    console.error('[Arsenal] Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}
