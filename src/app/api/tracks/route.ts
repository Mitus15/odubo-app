import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const albumId = url.searchParams.get('album_id');
    
    let query = 'SELECT * FROM tracks';
    const params: any[] = [];
    
    if (albumId) {
      query += ' WHERE album_id = ?';
      params.push(albumId);
    }
    
    query += ' ORDER BY track_number ASC';
    
    const tracks = await queryDatabase(query, params);
    const res = NextResponse.json({ success: true, tracks });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return res;
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracks' },
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
    const body = await req.json() as {
      title: string;
      album_id: string;
      track_number: number;
      audio_url?: string;
      duration?: number;
    };
    
    const { title, album_id, track_number, audio_url, duration } = body;

    if (!title || !album_id || !track_number) {
      return NextResponse.json(
        { error: 'Title, album_id, and track_number are required' },
        { status: 400 }
      );
    }

    const result = await executeQuery(
      `INSERT INTO tracks (id, title, album_id, track_number, audio_url, duration, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', datetime('now'))`,
      [
        crypto.randomUUID(),
        title,
        album_id,
        track_number,
        audio_url || '',
        duration || 0
      ]
    );

    return NextResponse.json(
      { success: true, id: result.meta?.last_row_id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating track:', error);
    return NextResponse.json(
      { error: 'Failed to create track' },
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
    const body = await req.json() as { id: string; status: string };
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'ID and status are required' },
        { status: 400 }
      );
    }

    await executeQuery(
      'UPDATE tracks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [status, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating track status:', error);
    return NextResponse.json(
      { error: 'Failed to update track status' },
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    await executeQuery('DELETE FROM tracks WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting track:', error);
    return NextResponse.json(
      { error: 'Failed to delete track' },
      { status: 500 }
    );
  }
}
