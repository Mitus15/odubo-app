import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { deleteFile } from '@/worker/upload';
import { writeAuditLog } from '@/lib/audit';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export async function DELETE(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }
    const body = await req.json() as { ids: string[] };
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs array is required' },
        { status: 400 }
      );
    }

    // Helper function to extract key from URL
    const extractKeyFromUrl = (url: string): string | null => {
      if (!url) return null;
      
      if (url.startsWith('https://media.odubo.studio/')) {
        return url.replace('https://media.odubo.studio/', '');
      }
      
      if (!url.startsWith('http')) return url;
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1] || null;
    };

    // Recursive function to delete all descendants of a video
    async function deleteAllDescendants(parentId: number): Promise<void> {
      const childClips = await queryDatabase(
        `SELECT id, url, poster_url, thumbnail, stream_video_id FROM videos WHERE parent_video_id = ?`,
        [parentId]
      );
      
      console.log(`[BULK DELETE] Found ${childClips?.length || 0} child clips where parent_video_id = ${parentId}`);

      for (const clip of childClips || []) {
        // Recursively delete this clip's children first
        await deleteAllDescendants(clip.id);
        
        console.log(`[BULK DELETE] Deleting child clip ${clip.id}`);
        
        // Delete clip resources from R2
        const clipKeys = [clip.url, clip.poster_url, clip.thumbnail]
          .map((u: string) => extractKeyFromUrl(u))
          .filter(Boolean) as string[];

        for (const key of clipKeys) {
          try {
            const res = await deleteFile(key);
            if (!res.success) console.warn('Failed to delete clip from R2:', key, res.error);
          } catch (e) {
            console.warn('Delete R2 error for clip', key, e);
          }
        }

        // Delete from Cloudflare Stream
        try {
          const uid = clip.stream_video_id as string | undefined;
          if (uid) {
            const { default: CloudflareStreamAPI } = await import('@/lib/cloudflareStream');
            const stream = new CloudflareStreamAPI();
            await stream.deleteVideo(uid);
          }
        } catch (e) {
          console.warn('Failed to delete clip from Cloudflare Stream (non-fatal):', e);
        }

        // Delete dependent records
        try {
          await executeQuery('DELETE FROM video_markers WHERE video_id = ?', [clip.id]);
          await executeQuery('DELETE FROM social_content WHERE video_id = ?', [clip.id]);
          await executeQuery('DELETE FROM ai_training_examples WHERE video_id = ?', [clip.id]);
          await executeQuery('DELETE FROM woda_video_context WHERE video_id = ?', [clip.id]);
        } catch (e) {
          console.warn('Failed to delete dependent records for clip', clip.id, e);
        }

        // Delete the child video
        await executeQuery('DELETE FROM videos WHERE id = ?', [clip.id]);
      }
    }

    // Convert string IDs to integers
    const videoIds = body.ids.map(id => parseInt(id, 10));
    
    // Get parent videos to be deleted
    const placeholders = videoIds.map(() => '?').join(',');
    const videos = await queryDatabase(
      `SELECT id, url, poster_url, thumbnail, stream_video_id FROM videos WHERE id IN (${placeholders})`,
      videoIds
    );

    console.log(`[BULK DELETE] Starting bulk delete for ${videoIds.length} videos`);

    // For each parent video, delete all its descendants and then the video itself
    for (const video of videos) {
      try {
        console.log(`[BULK DELETE] Processing video ${video.id}`);
        
        // Delete all descendants recursively
        await deleteAllDescendants(video.id);
        
        // Delete parent's resources from R2
        const videoKeys = [video.url, video.poster_url, video.thumbnail]
          .map((u: string) => extractKeyFromUrl(u))
          .filter(Boolean) as string[];

        for (const key of videoKeys) {
          try {
            const res = await deleteFile(key);
            if (!res.success) console.warn('Failed to delete from R2:', key, res.error);
          } catch (e) {
            console.warn('Delete R2 error', key, e);
          }
        }

        // Delete from Cloudflare Stream
        try {
          const uid = video.stream_video_id as string | undefined;
          if (uid) {
            const { default: CloudflareStreamAPI } = await import('@/lib/cloudflareStream');
            const stream = new CloudflareStreamAPI();
            await stream.deleteVideo(uid);
          }
        } catch (e) {
          console.warn('Failed to delete from Cloudflare Stream (non-fatal):', e);
        }

        // Delete parent's dependent records
        try {
          await executeQuery('DELETE FROM video_markers WHERE video_id = ?', [video.id]);
          await executeQuery('DELETE FROM social_content WHERE video_id = ?', [video.id]);
          await executeQuery('DELETE FROM ai_training_examples WHERE video_id = ?', [video.id]);
          await executeQuery('DELETE FROM woda_video_context WHERE video_id = ?', [video.id]);
        } catch (e) {
          console.warn('Failed to delete dependent records for parent', video.id, e);
        }

        // Delete the parent video
        await executeQuery('DELETE FROM videos WHERE id = ?', [video.id]);
        console.log(`[BULK DELETE] Successfully deleted video ${video.id} and all descendants`);
      } catch (error) {
        console.error(`[BULK DELETE] Error deleting video ${video.id}:`, error);
        // Continue with next video instead of failing entire operation
      }
    }

    try { await writeAuditLog(req, user, 'videos.bulk_delete', body.ids.join(','), { count: body.ids.length }); } catch {}
    
    console.log(`[BULK DELETE] Successfully completed bulk delete for ${videoIds.length} videos`);
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${videoIds.length} videos and all associated files and descendants`
    });
  } catch (error) {
    console.error('Error bulk deleting videos:', error);
    return NextResponse.json(
      { error: `Failed to delete videos: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
