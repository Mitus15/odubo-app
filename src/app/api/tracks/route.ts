import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { withoutAudio } from '@/lib/release/audioSource';
// Use Web Crypto API for Edge compatibility

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const albumId = url.searchParams.get('album_id');
    
    // SELECT tracks with video count (how many videos are linked to this track)
    // `album_status` rides along so an unreleased track can have its audio
    // location withheld below. It never decides WHO may listen (the byte
    // routes do), only that the address of an unreleased recording is not
    // handed to everybody who asks. Since 2026-10-24 an unreleased album's
    // tracks are not listed at all except to the owner and team: the 14 titles
    // of the shelved record were public here, and they are its story.
    const admin = isAdminUser(await getUserFromRequest(req));
    let query = `
      SELECT 
        t.*,
        a.status AS album_status,
        COUNT(v.id) as video_count
      FROM tracks t
      LEFT JOIN videos v ON v.track_id = t.id
      LEFT JOIN albums a ON a.id = t.album_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (albumId) {
      conditions.push('t.album_id = ?');
      params.push(albumId);
    }
    if (!admin) {
      conditions.push("LOWER(COALESCE(a.status, '')) = 'published'");
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY t.id ORDER BY t.track_number ASC';
    
    const rows = (await queryDatabase(query, params)) as Record<string, unknown>[];
    // Until an album is published, the public listing carries the track but
    // not the way to play it. The byte routes enforce the real rule; this
    // stops the catalogue from advertising the door.
    const tracks = rows.map(({ album_status, ...t }) =>
      String(album_status ?? '').toLowerCase() === 'published' ? t : withoutAudio(t)
    );
    const res = NextResponse.json({ success: true, tracks });
    // The answer depends on who asks, so no shared cache may hold it.
    res.headers.set('Cache-Control', 'private, max-age=60');
    res.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding');
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
    const user = await getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }
    const body = await req.json() as {
      title: string;
      album_id: string;
      track_number: number;
      audio_url?: string;
      duration?: number;
      explicit_content?: boolean;
    };

    const { title, album_id, track_number, audio_url, duration, explicit_content } = body;

    if (!title || !album_id || !track_number) {
      return NextResponse.json(
        { error: 'Title, album_id, and track_number are required' },
        { status: 400 }
      );
    }

    // A track's id is this UUID, not a rowid, so it is what the caller gets back.
    const id = globalThis.crypto.randomUUID();
    await executeQuery(
      `INSERT INTO tracks (id, title, album_id, track_number, audio_url, duration, explicit_content, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'))`,
      [
        id,
        title,
        album_id,
        track_number,
        audio_url || '',
        duration || 0,
        explicit_content ? 1 : 0
      ]
    );

    return NextResponse.json(
      { success: true, id },
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
    const user = await getUserFromRequest(req);
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
    const user = await getUserFromRequest(req);
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
