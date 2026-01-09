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

    // For engagement mode, order by score. Otherwise randomize for variety.
    // Use seeded random for consistent pagination within session
    let orderBy: string;
    if (withEngagement) {
      orderBy = 'ORDER BY engagement_score DESC, v.created_at DESC, v.id DESC';
    } else if (seed) {
      // Seeded random: hash(id + seed) for consistent order across pages
      orderBy = `ORDER BY (v.id * 2654435761 + ${hashSeed(seed)}) % 2147483647`;
    } else {
      // True random shuffle on first load
      orderBy = 'ORDER BY RANDOM()';
    }

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
