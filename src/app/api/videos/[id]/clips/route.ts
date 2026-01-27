import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    
    // Find clips where related_projects contains "parent_id:ID"
    // Since related_projects is a JSON array string, we use LIKE
    const clips = await queryDatabase(
      `SELECT * FROM videos 
       WHERE type = 'clip' 
       AND related_projects LIKE ? 
       ORDER BY position ASC, created_at ASC`,
      [`%parent_id:${id}%`]
    );

    return NextResponse.json({ success: true, clips });
  } catch (error) {
    console.error('Error fetching clips:', error);
    return NextResponse.json({ error: 'Failed to fetch clips' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { uid, title, duration, thumbnail, url, is_public } = body;

    // Inherit visibility/status/artist from parent video
    const parent = await queryDatabase(
      `SELECT is_public, status, publication_status, artist_name AS parent_artist
       FROM videos WHERE id = ? LIMIT 1`,
      [id]
    );
    const parentRow = Array.isArray(parent) ? parent[0] : null;
    const parentPublic = parentRow?.is_public === 1 || parentRow?.is_public === true;
    const parentStatus = parentRow?.status || 'published';
    const parentPublication = parentRow?.publication_status || 'live';
    // Always use parent's artist_name for clips
    const parentArtist = parentRow?.parent_artist || 'Mani Odubo';

    if (!uid || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Always generate thumbnail URL from UID if not provided
    const posterUrl = thumbnail || `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
    const embedUrl = url || `https://iframe.videodelivery.net/${uid}`;

    await executeQuery(
      `INSERT INTO videos (
        title, artist_name, uid, url, poster_url, thumbnail, duration,
        status, type, is_public, publication_status, related_projects,
        parent_video_id, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        'published', 'clip', ?, 'live', ?,
        ?, datetime('now'), datetime('now')
      )`,
      [
        title,
        parentArtist,
        uid,
        embedUrl,
        posterUrl,
        posterUrl,
        duration || 0,
        (is_public ? 1 : undefined) ?? (parentPublic ? 1 : 0),
        JSON.stringify([`parent_id:${id}`, `style:vertical`]),
        id  // explicit parent_video_id FK
      ]
    );

    // Ensure status/publication match parent for gating
    await executeQuery(
      `UPDATE videos SET status = ?, publication_status = ?, updated_at = datetime('now') WHERE uid = ?`,
      [parentStatus, parentPublication, uid]
    );

    // Enable MP4 downloads for the clip (non-blocking)
    try {
      const stream = new CloudflareStreamAPI();
      await stream.enableDownloads(uid);
    } catch (mp4Error) {
      // Non-fatal: MP4 might already be enabled or video still processing
      console.warn('Could not enable MP4 downloads for clip:', uid, mp4Error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating clip:', error);
    return NextResponse.json({ error: 'Failed to create clip' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { clips } = body; // Expecting array of { id, position }

    if (!Array.isArray(clips)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Batch update positions
    for (const clip of clips) {
      if (clip.id && typeof clip.position === 'number') {
        await executeQuery(
          'UPDATE videos SET position = ? WHERE id = ?',
          [clip.position, clip.id]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering clips:', error);
    return NextResponse.json({ error: 'Failed to reorder clips' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { clipId } = body;

    if (!clipId) {
      return NextResponse.json({ error: 'clipId is required' }, { status: 400 });
    }

    // Get the clip UID for Cloudflare Stream deletion
    const clips = await queryDatabase(
      'SELECT uid FROM videos WHERE id = ? AND type = ?',
      [clipId, 'clip']
    );

    const clip = clips[0] as { uid?: string } | undefined;

    // Delete from Cloudflare Stream if UID exists
    if (clip?.uid) {
      try {
        const stream = new CloudflareStreamAPI();
        await stream.deleteVideo(clip.uid);
      } catch (streamError) {
        // Non-fatal: video might not exist in Stream
        console.warn('Could not delete from Cloudflare Stream:', clip.uid, streamError);
      }
    }

    // Delete from database
    await executeQuery('DELETE FROM videos WHERE id = ? AND type = ?', [clipId, 'clip']);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting clip:', error);
    return NextResponse.json({ error: 'Failed to delete clip' }, { status: 500 });
  }
}
