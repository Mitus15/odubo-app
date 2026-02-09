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

    // FIXED: Use parent_video_id FK instead of fragile related_projects LIKE
    // Order by clip_index for proper sequencing, fall back to position then created_at
    const clips = await queryDatabase(
      `SELECT * FROM videos
       WHERE parent_video_id = ?
       ORDER BY clip_index ASC, position ASC, created_at ASC`,
      [id]
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
    const {
      uid, title, duration, thumbnail, url, is_public, thumbnail_timestamp_pct,
      description, credits, category, mood, mp4_url, source_format
    } = body;

    // Inherit artist from parent, but clips are ALWAYS hidden until distributed
    const parent = await queryDatabase(
      `SELECT artist_name AS parent_artist
       FROM videos WHERE id = ? LIMIT 1`,
      [id]
    );
    const parentRow = Array.isArray(parent) ? parent[0] : null;
    // Always use parent's artist_name for clips
    const parentArtist = parentRow?.parent_artist || 'Mani Odubo';

    if (!uid || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Always generate thumbnail URL from UID if not provided
    const posterUrl = thumbnail || `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
    const embedUrl = url || `https://iframe.videodelivery.net/${uid}`;

    // NOTE: Clips are created with publication_status = 'archived' (hidden)
    // They become visible when distributed via Social CMS → PostForMe
    await executeQuery(
      `INSERT INTO videos (
        title, artist_name, uid, stream_video_id, url, mp4_url, source_format, poster_url, thumbnail, duration,
        status, type, is_public, publication_status, related_projects,
        parent_video_id, thumbnail_timestamp_pct,
        description, credits, category, mood,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'published', 'clip', 0, 'archived', ?,
        ?, ?,
        ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )`,
      [
        title,
        parentArtist,
        uid,
        uid, // stream_video_id = uid
        embedUrl,
        mp4_url || '', // R2 MP4 URL for deployment
        source_format || null, // Original video format
        posterUrl,
        posterUrl,
        duration || 0,
        JSON.stringify([`parent_id:${id}`, `style:vertical`]),
        id,  // explicit parent_video_id FK
        thumbnail_timestamp_pct || 0.5,  // Default to 50% if not provided
        description || null,
        credits || null,
        category || null,
        mood || null,
      ]
    );

    // FIXED: Auto-assign clip_index and update total_siblings for all clips
    // This was previously missing, causing clips to have NULL clip_index values
    try {
      // Get the max clip_index for this parent (to assign next index)
      const maxResult = await queryDatabase(
        'SELECT MAX(clip_index) as max_index FROM videos WHERE parent_video_id = ?',
        [id]
      ) as Array<{ max_index: number | null }>;
      const currentMax = maxResult[0]?.max_index || 0;
      const newIndex = currentMax + 1;

      // Update the newly inserted clip with its index (identified by uid)
      await executeQuery(
        'UPDATE videos SET clip_index = ? WHERE uid = ?',
        [newIndex, uid]
      );

      // Get total count of clips under this parent
      const countResult = await queryDatabase(
        'SELECT COUNT(*) as total FROM videos WHERE parent_video_id = ?',
        [id]
      ) as Array<{ total: number }>;
      const totalSiblings = countResult[0]?.total || newIndex;

      // Update total_siblings for ALL clips under this parent (including the new one)
      await executeQuery(
        'UPDATE videos SET total_siblings = ? WHERE parent_video_id = ?',
        [totalSiblings, id]
      );

      console.log(`[Clips] Assigned clip_index=${newIndex}, total_siblings=${totalSiblings} for parent ${id}`);
    } catch (indexError) {
      // Non-fatal: clip was created, just without index
      console.warn('[Clips] Failed to assign clip_index:', indexError);
    }

    // Clips are created with publication_status = 'archived' by default (as per INSERT above).
    // Visibility is controlled by parent cascade at query level (feed checks parent status).
    // No need to sync status to parent — this was causing crashes with undefined variables.

    // Enable MP4 downloads for the clip (non-blocking)
    try {
      const stream = new CloudflareStreamAPI();
      await stream.enableDownloads(uid);
    } catch (mp4Error) {
      // Non-fatal: MP4 might already be enabled or video still processing
      console.warn('Could not enable MP4 downloads for clip:', uid, mp4Error);
    }

    // Reset homepage mode to 'auto' so clips show up automatically
    try {
      await executeQuery(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES ('homepage_mode', 'auto', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = 'auto', updated_at = datetime('now')`,
        []
      );
    } catch {
      // Non-fatal: table might not exist yet
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

    const { id: parentId } = await params;
    const body = await req.json();
    const { clipId } = body;

    if (!clipId) {
      return NextResponse.json({ error: 'clipId is required' }, { status: 400 });
    }

    // Get the clip UID for Cloudflare Stream deletion
    const clips = await queryDatabase(
      'SELECT uid, parent_video_id FROM videos WHERE id = ? AND type = ?',
      [clipId, 'clip']
    ) as Array<{ uid?: string; parent_video_id?: number }>;

    const clip = clips[0];

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

    // FIXED: Update total_siblings for remaining clips after deletion
    const effectiveParentId = clip?.parent_video_id || parentId;
    if (effectiveParentId) {
      try {
        const countResult = await queryDatabase(
          'SELECT COUNT(*) as total FROM videos WHERE parent_video_id = ?',
          [effectiveParentId]
        ) as Array<{ total: number }>;
        const newTotal = countResult[0]?.total || 0;

        await executeQuery(
          'UPDATE videos SET total_siblings = ? WHERE parent_video_id = ?',
          [newTotal, effectiveParentId]
        );

        console.log(`[Clips] Updated total_siblings=${newTotal} after deleting clip from parent ${effectiveParentId}`);
      } catch (e) {
        console.warn('[Clips] Failed to update total_siblings after delete:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting clip:', error);
    return NextResponse.json({ error: 'Failed to delete clip' }, { status: 500 });
  }
}
