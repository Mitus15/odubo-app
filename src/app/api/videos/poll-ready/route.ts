import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { generateClipThumbnail, generateAIThumbnailCandidates } from '@/lib/thumbnailService';
import { queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/videos/poll-ready
 * 
 * Polls Cloudflare Stream to check if a video is ready and generates
 * thumbnail automatically when processing completes.
 * 
 * Body: { uid: string }
 * Returns: { ready: boolean, thumbnailGenerated?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json() as { uid: string };
    const { uid } = body;
    if (!uid) {
      return NextResponse.json({ error: 'uid required' }, { status: 400 });
    }

    // Check video readiness via Cloudflare Stream API
    const stream = new CloudflareStreamAPI();
    const videoDetails = await stream.getVideo(uid);
    
    const isReady = videoDetails?.result?.readyToStream === true;
    const duration = videoDetails?.result?.duration || 0;

    if (!isReady) {
      return NextResponse.json({ ready: false });
    }

    // Video is ready - generate thumbnail automatically
    const videoRows = await queryDatabase(
      'SELECT id, parent_video_id, type, title, category, mood FROM videos WHERE uid = ? OR stream_video_id = ? LIMIT 1',
      [uid, uid]
    );

    if (!videoRows || videoRows.length === 0) {
      return NextResponse.json({ 
        ready: true, 
        error: 'Video not found in database' 
      }, { status: 404 });
    }

    const video = videoRows[0];
    const videoId = video.id as number;
    const isClip = video.parent_video_id !== null;

    let thumbnailResult;
    
    if (isClip) {
      // Clip: random frame extraction → R2
      console.log(`[Poll Ready] Generating clip thumbnail for video ${videoId}`);
      thumbnailResult = await generateClipThumbnail(uid, Math.floor(duration), videoId);
    } else {
      // Parent video: AI-powered thumbnail selection
      console.log(`[Poll Ready] Generating AI thumbnails for video ${videoId}`);
      thumbnailResult = await generateAIThumbnailCandidates(uid, videoId, {
        title: video.title as string,
        category: video.category as string,
        mood: video.mood as string
      });
    }

    if (!thumbnailResult.success) {
      console.error(`[Poll Ready] Thumbnail generation failed:`, thumbnailResult.error);
      return NextResponse.json({ 
        ready: true, 
        thumbnailGenerated: false,
        error: thumbnailResult.error 
      });
    }

    console.log(`[Poll Ready] Thumbnail generated successfully for video ${videoId}`);
    return NextResponse.json({ 
      ready: true, 
      thumbnailGenerated: true,
      posterUrl: thumbnailResult.posterUrl
    });

  } catch (error: any) {
    console.error('[Poll Ready] Error:', error);
    return NextResponse.json({ 
      error: error.message,
      ready: false
    }, { status: 500 });
  }
}
