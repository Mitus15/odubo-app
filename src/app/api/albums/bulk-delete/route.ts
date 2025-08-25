import { NextRequest, NextResponse } from 'next/server';
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
    
    // Get album data to find associated files
    const albums = await queryDatabase(
      `SELECT id, cover_art_key FROM albums WHERE id IN (${placeholders})`,
      body.ids
    );

    // Get track data to find associated files
    const tracks = await queryDatabase(
      `SELECT audio_id FROM tracks WHERE album_id IN (${placeholders})`,
      body.ids
    );

    // Delete cover art files from R2
    for (const album of albums) {
      if (album.cover_art_key) {
        try {
          const deleteResult = await deleteFile(album.cover_art_key);
          if (!deleteResult.success) {
            console.error('Failed to delete cover art from R2:', deleteResult.error);
          }
        } catch (error) {
          console.error('Error deleting cover art from R2:', error);
        }
      }
    }

    // Delete track files from R2
    for (const track of tracks) {
      if (track.audio_id) {
        try {
          const deleteResult = await deleteFile(track.audio_id);
          if (!deleteResult.success) {
            console.error('Failed to delete track from R2:', deleteResult.error);
          }
        } catch (error) {
          console.error('Error deleting track from R2:', error);
        }
      }
    }
    
    // Delete tracks first (foreign key constraint)
    await executeQuery(
      `DELETE FROM tracks WHERE album_id IN (${placeholders})`,
      body.ids
    );
    
    // Delete albums
    await executeQuery(
      `DELETE FROM albums WHERE id IN (${placeholders})`,
      body.ids
    );

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${body.ids.length} albums and associated files`
    });
  } catch (error) {
    console.error('Error bulk deleting albums:', error);
    return NextResponse.json(
      { error: 'Failed to delete albums' },
      { status: 500 }
    );
  }
}
