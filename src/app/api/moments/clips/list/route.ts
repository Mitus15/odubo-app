import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req as any) || null;
    const isAdmin = isAdminUser(user);

    const url = new URL(req.url);
    const eventId = url.searchParams.get('eventId');
    const galleryId = url.searchParams.get('galleryId');
    const sort = url.searchParams.get('sort') || 'newest';
    const seed = url.searchParams.get('seed') || null;
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '20')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));
    const includePending = url.searchParams.get('includePending') === 'true' && isAdmin;

    // Rate limit
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const rlKey = `clips-list:${ip}`;
    const rl = await rateLimit({ key: rlKey, limit: 60, windowMs: 60000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Build query - support both filtered (by event) and all clips
    let sql = `
      SELECT ec.*, g.title as event_title, g.code as event_code
      FROM event_clips ec
      JOIN galleries g ON ec.event_id = g.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Filter by event if specified
    if (eventId || galleryId) {
      const id = eventId || galleryId;
      sql += ' AND ec.event_id = ?';
      params.push(id);
    }

    if (!includePending) {
      sql += ' AND (ec.moderated = 1 OR ec.moderated IS NULL)';
    }

    // Sort options
    switch (sort) {
      case 'newest':
        sql += ' ORDER BY ec.created_at DESC';
        break;
      case 'oldest':
        sql += ' ORDER BY ec.created_at ASC';
        break;
      case 'popular':
        sql += ' ORDER BY ec.view_count DESC, ec.created_at DESC';
        break;
      case 'shuffle':
      default:
        // For shuffle, we'll order by pinned/featured first, then use a seed for pseudo-random
        if (seed) {
          // Use seed for consistent random ordering
          sql += ` ORDER BY ec.is_pinned DESC, ec.is_featured DESC, (ec.id * ${parseInt(seed, 36) || 1}) % 1000 ASC`;
        } else {
          sql += ' ORDER BY ec.is_pinned DESC, ec.is_featured DESC, ec.created_at DESC';
        }
        break;
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const clips = await queryDatabase(sql, params);

    // Transform for response
    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, '') || '';
    const transformedClips = (clips || []).map((c: any) => ({
      id: c.id,
      event_id: c.event_id,
      event_title: c.event_title,
      event_code: c.event_code,
      user_name: c.user_name,
      r2_url: c.r2_url || (c.r2_key ? `${publicBase}/${c.r2_key}` : null),
      thumbnail_url: c.thumbnail_url || (c.thumbnail_key ? `${publicBase}/${c.thumbnail_key}` : null),
      duration_seconds: c.duration_seconds,
      caption: c.caption,
      view_count: c.view_count,
      is_featured: c.is_featured,
      is_pinned: c.is_pinned,
      moderated: c.moderated,
      created_at: c.created_at,
    }));

    // Get unique parent videos for filter (only when listing all clips)
    let parents: Array<{ id: number; title: string }> = [];
    if (!eventId && !galleryId) {
      const parentResult = await queryDatabase(
        'SELECT DISTINCT ec.event_id as id, g.title FROM event_clips ec JOIN galleries g ON ec.event_id = g.id WHERE (ec.moderated = 1 OR ec.moderated IS NULL) ORDER BY g.title',
        []
      );
      parents = (parentResult || []).map((p: any) => ({ id: p.id, title: p.title }));
    }

    return NextResponse.json({
      clips: transformedClips,
      parents,
      pagination: {
        limit,
        offset,
        has_more: transformedClips.length >= limit,
      },
    });
  } catch (e: any) {
    console.error('Clips list error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to list clips' }, { status: 500 });
  }
}