import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * POST /api/admin/backfill-thumbnails
 * Backfill poster_url and thumbnail for all videos that have a uid but empty thumbnail
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find all videos with uid but no poster_url or empty poster_url
    const videosToUpdate = await queryDatabase(
      `SELECT id, uid FROM videos
       WHERE uid IS NOT NULL
         AND uid != ''
         AND (poster_url IS NULL OR poster_url = '' OR thumbnail IS NULL OR thumbnail = '')`,
      []
    );

    if (!videosToUpdate || videosToUpdate.length === 0) {
      return NextResponse.json({
        message: 'No videos need thumbnail backfill',
        updated: 0
      });
    }

    let updated = 0;
    const errors: string[] = [];

    for (const video of videosToUpdate) {
      try {
        const uid = video.uid;
        // Cloudflare Stream thumbnail URL
        const posterUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;

        await executeQuery(
          `UPDATE videos
           SET poster_url = ?, thumbnail = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [posterUrl, posterUrl, video.id]
        );
        updated++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Video ${video.id}: ${errorMsg}`);
      }
    }

    return NextResponse.json({
      message: `Backfilled thumbnails for ${updated} videos`,
      updated,
      total: videosToUpdate.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Admin] Backfill thumbnails error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to backfill thumbnails', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/backfill-thumbnails
 * Check how many videos need thumbnail backfill
 */
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await queryDatabase(
      `SELECT COUNT(*) as count FROM videos
       WHERE uid IS NOT NULL
         AND uid != ''
         AND (poster_url IS NULL OR poster_url = '' OR thumbnail IS NULL OR thumbnail = '')`,
      []
    );

    const count = result[0]?.count || 0;

    return NextResponse.json({
      needsBackfill: count,
      message: count > 0
        ? `${count} videos need thumbnail backfill. POST to this endpoint to fix.`
        : 'All videos have thumbnails.'
    });
  } catch (error) {
    console.error('[Admin] Check thumbnails error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to check thumbnails', details: errorMessage },
      { status: 500 }
    );
  }
}
