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
    const orderBy = 'ORDER BY created_at DESC, id DESC';

    // Include public clips, treating legacy/null status values as published/live
    const rows = await queryDatabase(
      `SELECT id, title, artist_name, description, url, uid, duration, duration_seconds, poster_url, thumbnail, created_at, shopify_product_handle, related_projects
       FROM videos
       WHERE type = 'clip'
         AND (is_public = 1 OR is_public IS NULL)
         AND COALESCE(status, 'published') != 'archived'
         AND COALESCE(publication_status, 'live') = 'live'
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return NextResponse.json({ clips: rows, feedSource: 'clips', nextOffset: offset + (rows?.length || 0), hasMore: rows?.length === limit });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
