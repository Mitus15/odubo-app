import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getPost, mapPlatform } from '@/lib/postforme';

export const runtime = 'nodejs';

interface VideoWithPostForMe {
  id: number;
  postforme_post_id: string;
  parent_video_id: number | null;
}

/**
 * POST /api/arsenal/sync
 * Sync platform URLs from Post for Me after publishing
 * Fetches external_url for published posts and updates local database
 */
export async function POST() {
  try {
    // Get all videos with Post for Me IDs that need syncing
    // (have a postforme_post_id but missing some platform URLs)
    const videos = await queryDatabase(
      `SELECT id, postforme_post_id, parent_video_id
       FROM videos
       WHERE postforme_post_id IS NOT NULL
         AND (
           (parent_video_id IS NULL AND youtube_url IS NULL)
           OR (parent_video_id IS NOT NULL AND (
             youtube_shorts_url IS NULL
             OR tiktok_url IS NULL
             OR instagram_reels_url IS NULL
           ))
         )`,
      []
    ) as VideoWithPostForMe[];

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        message: 'No videos to sync',
        updated: 0,
        errors: [],
      });
    }

    let updated = 0;
    const errors: string[] = [];

    for (const video of videos) {
      try {
        // Fetch post status from Post for Me
        const postResponse = await getPost(video.postforme_post_id);

        if (!postResponse.success || !postResponse.data) {
          errors.push(`Video ${video.id}: Failed to fetch post ${video.postforme_post_id}`);
          continue;
        }

        const post = postResponse.data;

        // Only update if the post is published and has an external URL
        if (post.status !== 'published' || !post.external_url) {
          continue;
        }

        // Determine which column to update based on platform and video type
        const platform = mapPlatform(post.platform);
        const isClip = video.parent_video_id !== null;

        let column: string;
        let idColumn: string;

        switch (platform) {
          case 'youtube':
            column = isClip ? 'youtube_shorts_url' : 'youtube_url';
            idColumn = 'youtube_post_id';
            break;
          case 'tiktok':
            column = 'tiktok_url';
            idColumn = 'tiktok_post_id';
            break;
          case 'instagram':
            column = 'instagram_reels_url';
            idColumn = 'instagram_post_id';
            break;
          default:
            continue;
        }

        // Update the video with the platform URL
        await executeQuery(
          `UPDATE videos
           SET ${column} = ?,
               ${idColumn} = ?,
               postforme_status = 'published'
           WHERE id = ?`,
          [post.external_url, post.external_id || null, video.id]
        );

        updated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Video ${video.id}: ${message}`);
      }
    }

    return NextResponse.json({
      message: `Synced ${updated} of ${videos.length} videos`,
      updated,
      total: videos.length,
      errors,
    });
  } catch (error) {
    console.error('[Arsenal] Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync videos' },
      { status: 500 }
    );
  }
}
