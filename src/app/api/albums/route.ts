import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { queryDatabase, executeQuery } from '@/lib/db';
import { Album } from '@/types/music';
import { deleteFile } from '@/worker/upload';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const featured = url.searchParams.get('featured');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    
    let query = 'SELECT * FROM albums';
    const params: any[] = [];
    const conditions: string[] = [];

    if (featured === 'true') {
      conditions.push('featured = ?');
      params.push(1);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
      
      if (offset) {
        query += ' OFFSET ?';
        params.push(parseInt(offset));
      }
    }

    const albums = await queryDatabase(query, params);
    const res = NextResponse.json({ success: true, albums });
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    res.headers.set('CDN-Cache-Control', 'public, max-age=300');
    res.headers.set('Vary', 'Accept-Encoding');
    return res;
  } catch (error) {
    console.error('Error fetching albums:', error);
    return NextResponse.json(
      { error: 'Failed to fetch albums' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }
    console.log('Albums POST request received');
    const body = await req.json() as {
      title: string;
      artist_name: string;
      release_type: Album['release_type'];
      release_date?: string;
      record_label?: string;
      genre?: string;
      subgenre?: string;
      explicit_content: boolean;
      featured: boolean;
      description?: string;
      total_tracks?: number;
      total_duration?: number;
      cover_art_url?: string;
    };
    
    const {
      title,
      artist_name,
      release_type,
      release_date,
      record_label,
      genre,
      subgenre,
      explicit_content,
      featured,
      description,
      total_tracks,
      total_duration,
      cover_art_url
    } = body;

    console.log('Album data:', { title, artist_name, release_type });

    if (!title || !artist_name || !release_type) {
      return NextResponse.json(
        { error: 'Title, artist name, and release type are required' },
        { status: 400 }
      );
    }

    const albumId = `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Inserting album into database...');
    await executeQuery(`
      INSERT INTO albums (
        id, title, artist_name, release_type, release_date, 
        record_label, genre, subgenre, cover_art_url, explicit_content, featured, 
        description, total_tracks, total_duration, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      albumId, title, artist_name, release_type, release_date || null,
      record_label || null, genre || null, subgenre || null, cover_art_url || null,
      explicit_content ? 1 : 0, featured ? 1 : 0, description || null,
      total_tracks || 0, total_duration || 0, 'draft'
    ]);

    console.log('Album created successfully:', albumId);
    return NextResponse.json({
      success: true,
      id: albumId,
      message: 'Album created successfully'
    });
  } catch (error) {
    console.error('Error creating album:', error);
    return NextResponse.json(
      { error: 'Failed to create album: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }
    const body = await req.json() as { id: string; title?: string; artist_name?: string; status?: string };
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Album ID is required' },
        { status: 400 }
      );
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];

    if (body.title !== undefined) {
      updates.push('title = ?');
      params.push(body.title);
    }

    if (body.artist_name !== undefined) {
      updates.push('artist_name = ?');
      params.push(body.artist_name);
    }

    if (body.status !== undefined) {
      updates.push('status = ?');
      params.push(body.status);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = datetime(\'now\')');
    params.push(body.id);

    const query = `UPDATE albums SET ${updates.join(', ')} WHERE id = ?`;
    await executeQuery(query, params);

    return NextResponse.json({
      success: true,
      message: 'Album updated successfully'
    });
  } catch (error) {
    console.error('Error updating album:', error);
    return NextResponse.json(
      { error: 'Failed to update album' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }
    const body = await req.json() as { id: string };
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Album ID is required' },
        { status: 400 }
      );
    }

    // First, get the album data to find associated files
    const albums = await queryDatabase('SELECT cover_art_key FROM albums WHERE id = ?', [body.id]);
    const album = albums[0];

    // Delete from R2 storage if cover art exists
    if (album?.cover_art_key) {
      try {
        const deleteResult = await deleteFile(album.cover_art_key);
        if (!deleteResult.success) {
          console.error('Failed to delete cover art from R2:', deleteResult.error);
        }
      } catch (error) {
        console.error('Error deleting cover art from R2:', error);
      }
    }

    // Get track files to delete
    const tracks = await queryDatabase('SELECT audio_id FROM tracks WHERE album_id = ?', [body.id]);
    
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

    // Delete tracks from database first (foreign key constraint)
    await executeQuery('DELETE FROM tracks WHERE album_id = ?', [body.id]);
    
    // Delete album from database
    await executeQuery('DELETE FROM albums WHERE id = ?', [body.id]);

    return NextResponse.json({
      success: true,
      message: 'Album and associated files deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting album:', error);
    return NextResponse.json(
      { error: 'Failed to delete album' },
      { status: 500 }
    );
  }
}
