import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/arsenal/feed-order
 * Get all clips ordered by feed position
 * Protected by admin-only access
 */
export async function GET(request: Request) {
  try {
    const clips = await queryDatabase(
      `SELECT id, uid, title, poster_url, duration, feed_position, parent_video_id,
              artist_name, created_at
       FROM videos
       WHERE type = 'clip'
         AND ((is_public = 1 OR is_public IS NULL)
              AND COALESCE(status, 'published') != 'archived'
              AND COALESCE(publication_status, 'live') = 'live')
       ORDER BY
         CASE WHEN feed_position IS NULL THEN 1 ELSE 0 END,
         feed_position ASC,
         created_at DESC`,
      []
    );

    return NextResponse.json({ clips: clips || [] });
  } catch (error) {
    console.error('[Arsenal] Feed order fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch feed order' }, { status: 500 });
  }
}

/**
 * PUT /api/arsenal/feed-order
 * Update feed positions for clips
 * Requires authentication
 */
export async function PUT(request: NextRequest) {
  try {
    // Server-side authentication using httpOnly cookies
    const user = getUserFromRequest(request);
    if (!isAdminUser(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Admins only' },
        { status: 403 }
      );
    }

    const body = await request.json() as { clips: Array<{ id: number; position: number }> };
    const { clips } = body;

    if (!clips || !Array.isArray(clips)) {
      return NextResponse.json({ error: 'clips array required' }, { status: 400 });
    }

    // Update each clip's position
    for (const clip of clips) {
      await executeQuery(
        `UPDATE videos SET feed_position = ?, updated_at = datetime('now') WHERE id = ?`,
        [clip.position, clip.id]
      );
    }

    return NextResponse.json({
      message: `Updated ${clips.length} clip positions`,
      updated: clips.length
    });
  } catch (error) {
    console.error('[Arsenal] Feed order update error:', error);
    return NextResponse.json({ error: 'Failed to update feed order' }, { status: 500 });
  }
}
