import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 10, 1), 50);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const random = (searchParams.get('random') || '').toLowerCase() === 'true';

    // Base query: public clips only
    // Note: assumes clips are stored in `videos` table with type='clip'
    const orderBy = random ? 'ORDER BY RANDOM()' : 'ORDER BY created_at DESC, id DESC';
    // Primary query: public/live published clips
    let rows = await queryDatabase(
      `SELECT id, title, description, url, uid, duration, poster_url, thumbnail, created_at
       FROM videos
       WHERE type = 'clip' AND (is_public = 1 OR status = 'published' OR publication_status = 'live')
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [limit, random ? 0 : offset] // for random ignore offset to avoid duplicates
    );

    // Fallback to any published non-clip videos if no clips yet
    let feedSource: 'clips' | 'videos_fallback' = 'clips';
    if ((!rows || rows.length === 0) && offset === 0) {
      rows = await queryDatabase(
        `SELECT id, title, description, url, uid, duration, poster_url, thumbnail, created_at
         FROM videos
         WHERE (is_public = 1 OR publication_status = 'live') AND status = 'published'
         ${orderBy}
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      feedSource = 'videos_fallback';
    }

    return NextResponse.json({ clips: rows, feedSource, nextOffset: offset + (rows?.length || 0), hasMore: rows?.length === limit });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
