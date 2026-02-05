import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const runtime = 'nodejs';

interface StreamVideo {
  uid: string;
  meta?: {
    name?: string;
    title?: string;
    creator?: string;
    artist_name?: string;
    description?: string;
    category?: string;
    type?: string;
    mood?: string;
  };
  created?: string;
  duration?: number;
  thumbnail?: string;
  playback?: {
    hls?: string;
    dash?: string;
  };
  status?: {
    state?: string;
  };
  readyToStream?: boolean;
}

/**
 * POST /api/arsenal/sync-from-stream
 * Sync videos from Cloudflare Stream to database
 * Creates database records for videos that exist in Stream but not in DB
 */
export async function POST() {
  try {
    console.log('[Arsenal] Syncing videos from Cloudflare Stream...');

    // Initialize Cloudflare Stream API
    const stream = new CloudflareStreamAPI();

    // Fetch all videos from Cloudflare Stream
    const response = await stream.listVideos({ status: 'ready' }) as { result?: StreamVideo[] };
    const streamVideos = response.result || [];

    console.log(`[Arsenal] Found ${streamVideos.length} videos in Cloudflare Stream`);

    if (streamVideos.length === 0) {
      return NextResponse.json({
        message: 'No videos found in Cloudflare Stream',
        synced: 0,
        skipped: 0,
        errors: [],
      });
    }

    // Get all existing video UIDs from database
    const existingVideos = await queryDatabase(
      'SELECT uid, stream_video_id FROM videos WHERE uid IS NOT NULL OR stream_video_id IS NOT NULL',
      []
    ) as Array<{ uid: string | null; stream_video_id: string | null }>;

    const existingUids = new Set<string>();
    existingVideos.forEach(v => {
      if (v.uid) existingUids.add(v.uid);
      if (v.stream_video_id) existingUids.add(v.stream_video_id);
    });

    console.log(`[Arsenal] Found ${existingUids.size} existing videos in database`);

    // Find videos that need to be synced
    const missingVideos = streamVideos.filter(v => !existingUids.has(v.uid));

    console.log(`[Arsenal] Need to sync ${missingVideos.length} videos`);

    if (missingVideos.length === 0) {
      return NextResponse.json({
        message: 'All videos are already synced',
        synced: 0,
        skipped: streamVideos.length,
        errors: [],
      });
    }

    let synced = 0;
    const errors: string[] = [];

    // Create database records for missing videos
    for (const video of missingVideos) {
      try {
        const meta = video.meta || {};
        const title = meta.title || meta.name || `Video ${video.uid}`;
        const artistName = meta.artist_name || meta.creator || 'ODUBO';
        const description = meta.description || null;
        const category = meta.category || null;
        const type = meta.type || 'clip';
        const mood = meta.mood || null;
        const duration = video.duration ? Math.floor(video.duration).toString() : null;
        const thumbnailUrl = video.thumbnail || null;
        const url = video.playback?.hls || null;
        const isPublic = 0; // Default to unpublished for safety
        const status = video.readyToStream && video.status?.state === 'ready' ? 'published' : 'draft';

        await executeQuery(
          `INSERT INTO videos (
            uid,
            stream_video_id,
            title,
            artist_name,
            description,
            category,
            type,
            mood,
            duration,
            poster_url,
            thumbnail,
            url,
            is_public,
            status,
            publication_status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            video.uid,
            video.uid,
            title,
            artistName,
            description,
            category,
            type,
            mood,
            duration,
            thumbnailUrl,
            thumbnailUrl,
            url,
            isPublic,
            status,
            'archived', // Default to archived for safety
            video.created || new Date().toISOString(),
            new Date().toISOString(),
          ]
        );

        synced++;
        console.log(`[Arsenal] Synced video: ${title} (${video.uid})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${video.uid}: ${message}`);
        console.error(`[Arsenal] Failed to sync video ${video.uid}:`, error);
      }
    }

    return NextResponse.json({
      message: `Synced ${synced} of ${missingVideos.length} missing videos`,
      synced,
      skipped: streamVideos.length - missingVideos.length,
      total: streamVideos.length,
      errors,
    });
  } catch (error) {
    console.error('[Arsenal] Sync from Stream error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to sync from Cloudflare Stream', details: errorMessage },
      { status: 500 }
    );
  }
}
