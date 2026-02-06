import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const runtime = 'nodejs';

/**
 * DELETE /api/admin/stream/clear-all
 * 
 * **DESTRUCTIVE ACTION**
 * Deletes ALL videos from Cloudflare Stream.
 * Use this to start fresh during development/testing.
 * 
 * Requires admin authentication.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    console.log('[Admin] Clearing ALL videos from Cloudflare Stream...');

    const stream = new CloudflareStreamAPI();
    
    // Get all videos (including processing, failed, etc.)
    const allVideos = await stream.listAllVideos({});
    
    console.log(`[Admin] Found ${allVideos.length} videos to delete`);

    if (allVideos.length === 0) {
      return NextResponse.json({
        message: 'No videos found in Cloudflare Stream',
        deleted: 0
      });
    }

    // Delete all videos
    const results = {
      attempted: allVideos.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const video of allVideos) {
      try {
        await stream.deleteVideo(video.uid);
        results.successful++;
        console.log(`[Admin] Deleted video: ${video.uid} - ${video.meta?.name || 'Untitled'}`);
      } catch (error) {
        results.failed++;
        results.errors.push(`${video.uid}: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`[Admin] Failed to delete video ${video.uid}:`, error);
      }
    }

    console.log(`[Admin] Stream cleared: ${results.successful}/${results.attempted} deleted successfully`);

    return NextResponse.json({
      message: 'Cloudflare Stream cleared',
      ...results
    });

  } catch (error: any) {
    console.error('[Admin] Error clearing Cloudflare Stream:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear Cloudflare Stream' },
      { status: 500 }
    );
  }
}
