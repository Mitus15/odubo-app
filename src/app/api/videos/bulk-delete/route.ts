import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { executeQuery, queryDatabase } from '@/lib/db';
import { deleteFile } from '@/worker/upload';

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { ids: string[] };
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs array is required' },
        { status: 400 }
      );
    }

    // Create placeholders for the IN clause
    const placeholders = body.ids.map(() => '?').join(',');
    
    // Get video data to find associated files
    const videos = await queryDatabase(
      `SELECT * FROM videos WHERE id IN (${placeholders})`,
      body.ids
    );

    // Helper function to extract key from URL
    const extractKeyFromUrl = (url: string): string | null => {
      if (!url) return null;
      
      // Handle different URL formats
      if (url.startsWith('https://media.odubo.studio/')) {
        return url.replace('https://media.odubo.studio/', '');
      }
      
      // If it's already just a key (no protocol), use as-is
      if (!url.startsWith('http')) {
        return url;
      }
      
      // For other URL formats, try to extract the last part
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    };

    // Delete video and thumbnail files from R2
    for (const video of videos) {
      // Extract file keys from URLs
      const videoUrl = video.url || video.video_url;
      const thumbnailUrl = video.poster_url || video.thumbnail_url || video.thumbnail;
      
      const videoKey = extractKeyFromUrl(videoUrl);
      const thumbnailKey = extractKeyFromUrl(thumbnailUrl);

      console.log('Bulk deleting files for video ID:', video.id, { videoKey, thumbnailKey });

      if (videoKey) {
        try {
          const deleteResult = await deleteFile(videoKey);
          if (!deleteResult.success) {
            console.error('Failed to delete video from R2:', deleteResult.error);
          } else {
            console.log('Successfully deleted video from R2:', videoKey);
          }
        } catch (error) {
          console.error('Error deleting video from R2:', error);
        }
      }

      if (thumbnailKey) {
        try {
          const deleteResult = await deleteFile(thumbnailKey);
          if (!deleteResult.success) {
            console.error('Failed to delete thumbnail from R2:', deleteResult.error);
          } else {
            console.log('Successfully deleted thumbnail from R2:', thumbnailKey);
          }
        } catch (error) {
          console.error('Error deleting thumbnail from R2:', error);
        }
      }
    }
    
    // Delete videos from database
    await executeQuery(
      `DELETE FROM videos WHERE id IN (${placeholders})`,
      body.ids
    );

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${body.ids.length} videos and associated files`
    });
  } catch (error) {
    console.error('Error bulk deleting videos:', error);
    return NextResponse.json(
      { error: 'Failed to delete videos' },
      { status: 500 }
    );
  }
}
