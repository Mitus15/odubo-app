import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { queryDatabase, executeQuery } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const albums = await queryDatabase('SELECT * FROM albums WHERE id = ?', [id]);
    
    if (albums.length === 0) {
      return NextResponse.json(
        { error: 'Album not found' },
        { status: 404 }
      );
    }

    // Get tracks for this album
    const tracks = await queryDatabase(
      'SELECT * FROM tracks WHERE album_id = ? ORDER BY track_number',
      [id]
    );

    const album = { ...albums[0], tracks };
    
    return NextResponse.json({
      success: true,
      album
    });
  } catch (error) {
    console.error('Error fetching album:', error);
    return NextResponse.json(
      { error: 'Failed to fetch album' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await req.formData();
    
    const title = formData.get('title') as string;
    const artist_name = formData.get('artist_name') as string;
    const release_type = formData.get('release_type') as string;
    const release_date = formData.get('release_date') as string;
    const record_label = formData.get('record_label') as string;
    const genre = formData.get('genre') as string;
    const subgenre = formData.get('subgenre') as string;
    const explicit_content = formData.get('explicit_content') === 'true';
    const featured = formData.get('featured') === 'true';
    const description = formData.get('description') as string;
    const cover_art = formData.get('cover_art') as File;

    // If we're only updating the cover art, make other fields optional
    const isCoverOnlyUpdate = cover_art && cover_art.size > 0 && !title && !artist_name && !release_type;
    
    if (!isCoverOnlyUpdate && (!title || !artist_name || !release_type)) {
      return NextResponse.json(
        { error: 'Title, artist name, and release type are required' },
        { status: 400 }
      );
    }

    let cover_art_url = null;
    let cover_art_key = null;

    // Handle new cover art upload
    if (cover_art && cover_art.size > 0) {
      try {
        const { uploadFile } = await import('@/worker/upload');
        const arrayBuffer = await cover_art.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const uploadResult = await uploadFile(
          uint8Array,
          cover_art.name,
          cover_art.type,
          'cover-art'
        );
        
        if (uploadResult.success) {
          cover_art_url = uploadResult.url;
          cover_art_key = uploadResult.key;
        }
      } catch (uploadError) {
        console.error('Cover art upload failed:', uploadError);
      }
    }

    if (isCoverOnlyUpdate) {
      // Only update cover art and timestamp
      if (cover_art_url) {
        await executeQuery(
          `UPDATE albums SET cover_art_url = ?, cover_art_key = ?, updated_at = datetime(?) WHERE id = ?`,
          [cover_art_url, cover_art_key || null, 'now', id]
        );
      }
    } else {
      // Full album update
      const updateFields = [];
      const updateParams = [];

      updateFields.push('title = ?', 'artist_name = ?', 'release_type = ?', 'release_date = ?');
      updateParams.push(title, artist_name, release_type, release_date);

      updateFields.push('record_label = ?', 'genre = ?', 'subgenre = ?');
      updateParams.push(record_label, genre, subgenre);

      updateFields.push('explicit_content = ?', 'featured = ?', 'description = ?');
      updateParams.push(explicit_content ? 1 : 0, featured ? 1 : 0, description);

      if (cover_art_url) {
        updateFields.push('cover_art_url = ?', 'cover_art_key = ?');
        updateParams.push(cover_art_url, cover_art_key);
      }

      updateFields.push('updated_at = datetime(?)');
      updateParams.push('now');
      updateParams.push(id);

      const sql = `UPDATE albums SET ${updateFields.join(', ')} WHERE id = ?`;
      
      await executeQuery(sql, updateParams);
    }

    return NextResponse.json({
      success: true,
      message: 'Album updated successfully',
      cover_art_url: cover_art_url || null,
      cover_art_key: cover_art_key || null
    });
  } catch (error) {
    console.error('Error updating album:', error);
    return NextResponse.json(
      { error: 'Failed to update album' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as { status?: string; [key: string]: any };
    
    if (!body.status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    if (!['draft', 'published', 'archived'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be draft, published, or archived' },
        { status: 400 }
      );
    }

    await executeQuery(
      'UPDATE albums SET status = ?, updated_at = datetime(?) WHERE id = ?',
      [body.status, 'now', id]
    );

    return NextResponse.json({
      success: true,
      message: 'Album status updated successfully'
    });
  } catch (error) {
    console.error('Error updating album status:', error);
    return NextResponse.json(
      { error: 'Failed to update album status' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Delete tracks first (foreign key constraint)
    await executeQuery('DELETE FROM tracks WHERE album_id = ?', [id]);
    
    // Delete album
    await executeQuery('DELETE FROM albums WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: 'Album deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting album:', error);
    return NextResponse.json(
      { error: 'Failed to delete album' },
      { status: 500 }
    );
  }
}
