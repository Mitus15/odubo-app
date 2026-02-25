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
    // Seed for consistent shuffle within a session (optional, for pagination)
    const seed = searchParams.get('seed') || '';
    // Filter by parent video
    const parentId = searchParams.get('parentId') ? Number(searchParams.get('parentId')) : null;
    // Sort mode: shuffle (default), newest, popular
    const sort = searchParams.get('sort') || '';

    // IMMUTABLE PRINCIPLE: Default is ALWAYS randomized. Other ordering can exist for specific use cases.
    // See /docs/my_thoughts/admin.md for rationale. Never change the DEFAULT from random without owner consultation.

    // Check if manual ordering is requested (for specific use cases, not the default)
    const useManualOrder = searchParams.get('order') === 'manual';

    // Base query fields (including mp4_url for native playback)
    // Join with parent video to get parent title
    const baseFields = `v.id, v.title, v.artist_name, v.description, v.url, v.uid, v.mp4_url, v.duration, v.duration_seconds, v.poster_url, v.thumbnail, v.created_at, v.shopify_product_handle, v.related_projects, v.feed_position, parent.title as parent_title`;

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

    // Popular sort needs engagement data
    const isPopularSort = sort === 'popular';
    const needsEngagement = withEngagement || isPopularSort;

    const engagementFieldsFinal = needsEngagement
      ? `,
        COALESCE(e.view_count, 0) as view_count,
        COALESCE(e.completion_count, 0) as completion_count,
        COALESCE(e.share_count, 0) as share_count,
        COALESCE(e.shop_click_count, 0) as shop_click_count,
        (COALESCE(e.view_count, 0) * 1 +
         COALESCE(e.completion_count, 0) * 3 +
         COALESCE(e.share_count, 0) * 5 +
         COALESCE(e.shop_click_count, 0) * 4) as engagement_score`
      : engagementFields;

    const engagementJoinFinal = needsEngagement
      ? `LEFT JOIN clip_engagement e ON v.id = e.clip_id`
      : engagementJoin;

    // For engagement mode, order by score. Otherwise randomize for variety.
    // Use seeded random for consistent pagination within session
    let orderBy: string;
    if (useManualOrder) {
      orderBy = 'ORDER BY CASE WHEN v.feed_position IS NULL THEN 1 ELSE 0 END, v.feed_position ASC, v.created_at DESC';
    } else if (sort === 'newest') {
      orderBy = 'ORDER BY v.created_at DESC, v.id DESC';
    } else if (sort === 'oldest') {
      orderBy = 'ORDER BY v.created_at ASC, v.id ASC';
    } else if (isPopularSort) {
      orderBy = 'ORDER BY engagement_score DESC, v.created_at DESC, v.id DESC';
    } else if (withEngagement) {
      orderBy = 'ORDER BY engagement_score DESC, v.created_at DESC, v.id DESC';
    } else if (seed) {
      orderBy = `ORDER BY (v.id * 2654435761 + ${hashSeed(seed)}) % 2147483647`;
    } else {
      orderBy = 'ORDER BY RANDOM()';
    }

    // Parent filter
    const parentFilter = parentId ? 'AND v.parent_video_id = ?' : '';
    const params: (number | string)[] = [];
    if (parentId) params.push(parentId);
    params.push(limit, offset);

    // Include public clips, treating legacy/null status values as published/live
    // CRITICAL: Parentheses added to fix operator precedence bug
    const rows = await queryDatabase(
      `SELECT ${baseFields}${engagementFieldsFinal}
       FROM videos v
       LEFT JOIN videos parent ON v.parent_video_id = parent.id
       ${engagementJoinFinal}
       WHERE v.type = 'clip'
         AND ((v.is_public = 1 OR v.is_public IS NULL)
              AND COALESCE(v.status, 'published') != 'archived'
              AND COALESCE(v.publication_status, 'live') = 'live')
       ${parentFilter}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      params
    );

    const response = NextResponse.json({
      clips: rows,
      feedSource: 'clips',
      nextOffset: offset + (rows?.length || 0),
      hasMore: rows?.length === limit,
      includesEngagement: withEngagement,
    });

    // CDN caching: 60s fresh, 5min stale-while-revalidate for faster repeat visits
    // Only cache seeded requests (pagination) - random shuffles should stay fresh
    if (seed) {
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    } else {
      // For random shuffles, allow brief client cache only
      response.headers.set('Cache-Control', 'private, max-age=10');
    }

    return response;
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// Simple hash for seed string to number
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
