import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin endpoint for clips - returns ALL clips regardless of status
 * Unlike /api/clips which only returns public, live clips
 */
export async function GET(req: NextRequest) {
  try {
    // Require admin auth
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const withEngagement = searchParams.get('withEngagement') === 'true';
    const status = searchParams.get('status'); // 'all', 'published', 'draft', 'archived'

    // Build WHERE clause
    const conditions: string[] = ["v.type = 'clip'"];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('COALESCE(v.status, \'published\') = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Base query fields
    const baseFields = `
      v.id,
      v.title,
      v.artist_name,
      v.description,
      v.url,
      v.uid,
      v.duration,
      v.duration_seconds,
      v.poster_url,
      v.thumbnail,
      v.is_public,
      COALESCE(v.status, 'published') as status,
      COALESCE(v.publication_status, 'live') as publication_status,
      v.shopify_product_handle,
      v.related_projects,
      v.created_at,
      v.updated_at
    `;

    // Engagement fields
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
      ? 'ORDER BY engagement_score DESC, v.created_at DESC'
      : 'ORDER BY v.created_at DESC';

    params.push(limit, offset);

    const rows = await queryDatabase(
      `SELECT ${baseFields}${engagementFields}
       FROM videos v
       ${engagementJoin}
       ${whereClause}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      params
    );

    // Get total count for pagination
    const countResult = await queryDatabase(
      `SELECT COUNT(*) as total FROM videos v ${whereClause}`,
      params.slice(0, -2) // Exclude limit/offset
    );
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      success: true,
      clips: rows,
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total,
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Admin clips error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
