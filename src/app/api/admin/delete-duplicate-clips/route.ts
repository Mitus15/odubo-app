import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const runtime = 'nodejs';

interface DuplicateGroup {
  title: string;
  clips: Array<{ id: number; uid: string; created_at: string }>;
}

/**
 * GET /api/admin/delete-duplicate-clips
 * Find duplicate clips (same title)
 */
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    // Find clips with duplicate titles
    const duplicates = await queryDatabase(
      `SELECT title, COUNT(*) as count
       FROM videos
       WHERE type = 'clip'
       GROUP BY title
       HAVING COUNT(*) > 1
       ORDER BY count DESC`,
      []
    ) as Array<{ title: string; count: number }>;

    if (duplicates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicate clips found',
        duplicates: [],
      });
    }

    // Get full details for each duplicate group
    const groups: DuplicateGroup[] = [];
    for (const dup of duplicates) {
      const clips = await queryDatabase(
        `SELECT id, uid, title, created_at
         FROM videos
         WHERE type = 'clip' AND title = ?
         ORDER BY created_at ASC`,
        [dup.title]
      ) as Array<{ id: number; uid: string; title: string; created_at: string }>;

      groups.push({
        title: dup.title,
        clips,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Found ${duplicates.length} duplicate groups`,
      duplicates: groups,
    });
  } catch (err: any) {
    console.error('Find duplicates error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/delete-duplicate-clips
 * Delete duplicate clips, keeping the oldest one for each title
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const shouldKeepNewest = body.keepNewest === true; // Default: keep oldest

    // Find clips with duplicate titles
    const duplicates = await queryDatabase(
      `SELECT title, COUNT(*) as count
       FROM videos
       WHERE type = 'clip'
       GROUP BY title
       HAVING COUNT(*) > 1`,
      []
    ) as Array<{ title: string; count: number }>;

    if (duplicates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicate clips found',
        deleted: 0,
      });
    }

    const stream = new CloudflareStreamAPI();
    const deleted: Array<{ id: number; uid: string; title: string }> = [];

    for (const dup of duplicates) {
      // Get all clips with this title, ordered by created_at
      const orderDirection = shouldKeepNewest ? 'DESC' : 'ASC';
      const clips = await queryDatabase(
        `SELECT id, uid, title, created_at
         FROM videos
         WHERE type = 'clip' AND title = ?
         ORDER BY created_at ${orderDirection}`,
        [dup.title]
      ) as Array<{ id: number; uid: string; title: string; created_at: string }>;

      // Keep the first one (oldest or newest based on shouldKeepNewest), delete the rest
      const toDelete = clips.slice(1);

      for (const clip of toDelete) {
        // Delete from Cloudflare Stream
        if (clip.uid) {
          try {
            await stream.deleteVideo(clip.uid);
          } catch (e) {
            console.warn('Could not delete from Stream:', clip.uid, e);
          }
        }

        // Delete from database
        await executeQuery('DELETE FROM videos WHERE id = ?', [clip.id]);
        deleted.push({ id: clip.id, uid: clip.uid, title: clip.title });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleted.length} duplicate clips`,
      deleted,
    });
  } catch (err: any) {
    console.error('Delete duplicates error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}
