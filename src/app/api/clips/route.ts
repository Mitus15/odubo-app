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
    const withEngagement = searchParams.get('withEngagement') === 'true';

    // Base query fields (including mp4_url for native playback)
    const baseFields = `v.id, v.title, v.artist_name, v.description, v.url, v.uid, v.mp4_url, v.duration, v.duration_seconds, v.poster_url, v.thumbnail, v.created_at, v.shopify_product_handle, v.related_projects`;

    // Engagement fields and scoring
    const engagementFields = withEngagement
      ? `,
        COALESCE(e.view_count, 0) as view_count,
        COALESCE(e.completion_count, 0) as completion_count,
        COALESCE(e.share_count, 0) as share_count,
        COALESCE(e.shop_click_count, 0) as shop_click_count,
        (COALESCE(e.view_count, 0) * 1 +
         COALESCE(e.completion_count, 0) * 3 +
         COALESCE(e.share_count, 0) * 5 +
         COALESCE(e.shop_click_count, 0) * 4) as engagement_score`
      : '';

    const engagementJoin = withEngagement
      ? 'LEFT JOIN clip_engagement e ON v.id = e.clip_id'
      : '';

    // Order by engagement score if available, otherwise by date
    const orderBy = withEngagement
      ? 'ORDER BY engagement_score DESC, v.created_at DESC, v.id DESC'
      : 'ORDER BY v.created_at DESC, v.id DESC';

    // Include public clips, treating legacy/null status values as published/live
    const rows = await queryDatabase(
      `SELECT ${baseFields}${engagementFields}
       FROM videos v
       ${engagementJoin}
       WHERE v.type = 'clip'
         AND (v.is_public = 1 OR v.is_public IS NULL)
         AND COALESCE(v.status, 'published') != 'archived'
         AND COALESCE(v.publication_status, 'live') = 'live'
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return NextResponse.json({
      clips: rows,
      feedSource: 'clips',
      nextOffset: offset + (rows?.length || 0),
      hasMore: rows?.length === limit,
      includesEngagement: withEngagement,
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
