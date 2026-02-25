import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/clips/parents — distinct parent videos that have live public clips.
 * Used by the clip feed menu to populate filter options.
 */
export async function GET() {
  try {
    const rows = await queryDatabase(
      `SELECT DISTINCT parent.id, parent.title
       FROM videos v
       JOIN videos parent ON v.parent_video_id = parent.id
       WHERE v.type = 'clip'
         AND (v.is_public = 1 OR v.is_public IS NULL)
         AND COALESCE(v.status, 'published') != 'archived'
         AND COALESCE(v.publication_status, 'live') = 'live'
       ORDER BY parent.title ASC`,
      []
    );

    return NextResponse.json({ parents: rows });
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
