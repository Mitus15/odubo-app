import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';
import { GalleryTypeEnum } from '@/lib/momentsSchemas';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const id = url.searchParams.get('id');

    // Public endpoint when querying by code (for attendees to validate event code)
    if (code) {
      const rl = await rateLimit({ key: `galleries:bycode:${code}`, limit: 30, windowMs: 60_000 });
      if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

      const rows = await queryDatabase(
        `SELECT id, code, title, description, starts_at, ends_at, created_at,
                gallery_type, upload_mode, cover_photo_key
         FROM galleries WHERE code = ? LIMIT 1`,
        [code.trim().toUpperCase()]
      );

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Invalid event code' }, { status: 404 });
      }

      // Fetch links for the gallery
      const gallery = rows[0] as any;
      const links = await queryDatabase(
        `SELECT id, link_type, link_id, link_handle, is_primary, display_label, sort_order
         FROM gallery_links WHERE gallery_id = ? ORDER BY sort_order ASC`,
        [gallery.id]
      );
      gallery.links = links;

      return NextResponse.json({ galleries: [gallery] });
    }

    // Public endpoint when querying by ID (for camera modal to get gallery info)
    if (id) {
      const galleryId = parseInt(id, 10);
      if (isNaN(galleryId)) {
        return NextResponse.json({ error: 'Invalid gallery ID' }, { status: 400 });
      }

      const rl = await rateLimit({ key: `galleries:byid:${id}`, limit: 30, windowMs: 60_000 });
      if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

      const rows = await queryDatabase(
        `SELECT id, code, title, description, starts_at, ends_at, created_at,
                gallery_type, upload_mode, cover_photo_key
         FROM galleries WHERE id = ? LIMIT 1`,
        [galleryId]
      );

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
      }

      // Fetch links for the gallery
      const gallery = rows[0] as any;
      const links = await queryDatabase(
        `SELECT id, link_type, link_id, link_handle, is_primary, display_label, sort_order
         FROM gallery_links WHERE gallery_id = ? ORDER BY sort_order ASC`,
        [gallery.id]
      );
      gallery.links = links;

      return NextResponse.json({ galleries: [gallery] });
    }

    // Admin-only endpoint for listing all galleries
    const user = getUserFromRequest(req as any);
    console.log('[galleries/GET] Auth check:', {
      hasUser: !!user,
      isAdmin: isAdminUser(user),
      userId: user?.userId,
      email: user?.email
    });

    if (!isAdminUser(user)) {
      console.error('[galleries] Admin check failed - returning 403');
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '20')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));

    // Type filtering
    const typeParam = url.searchParams.get('type');
    const typesParam = url.searchParams.get('types'); // comma-separated
    const uploadModeParam = url.searchParams.get('upload_mode');

    const rl = await rateLimit({ key: `galleries:list:${user!.userId}`, limit: 120, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: { 'x-ratelimit-remaining': String(rl.remaining), 'x-ratelimit-reset': String(rl.resetAt) } });

    // Build WHERE clause for filters
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (typeParam) {
      const parsed = GalleryTypeEnum.safeParse(typeParam);
      if (parsed.success) {
        whereClauses.push('gallery_type = ?');
        params.push(parsed.data);
      }
    } else if (typesParam) {
      const types = typesParam.split(',').map(t => t.trim()).filter(t => GalleryTypeEnum.safeParse(t).success);
      if (types.length > 0) {
        whereClauses.push(`gallery_type IN (${types.map(() => '?').join(', ')})`);
        params.push(...types);
      }
    }

    if (uploadModeParam && ['public', 'admin'].includes(uploadModeParam)) {
      whereClauses.push('upload_mode = ?');
      params.push(uploadModeParam);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = await queryDatabase(
      `SELECT id, code, title, description, starts_at, ends_at, created_by, created_at, updated_at, config,
              gallery_type, upload_mode, cover_photo_key, sort_order,
              shopify_product_id, shopify_product_handle
       FROM galleries ${whereClause}
       ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Fetch links for all galleries (batch query)
    const galleryIds = rows.map((r: any) => r.id);
    let linksMap: Record<number, any[]> = {};
    if (galleryIds.length > 0) {
      const allLinks = await queryDatabase(
        `SELECT id, gallery_id, link_type, link_id, link_handle, is_primary, display_label, sort_order
         FROM gallery_links WHERE gallery_id IN (${galleryIds.map(() => '?').join(', ')})
         ORDER BY sort_order ASC`,
        galleryIds
      );
      for (const link of allLinks as any[]) {
        if (!linksMap[link.gallery_id]) linksMap[link.gallery_id] = [];
        linksMap[link.gallery_id].push(link);
      }
    }

    // Attach links to galleries
    const galleriesWithLinks = rows.map((g: any) => ({
      ...g,
      links: linksMap[g.id] || [],
    }));

    console.log('[galleries/GET] Success - returning', rows.length, 'galleries');
    await writeAuditLog(req, user, 'galleries.list', `count=${rows.length}`, { limit, offset, type: typeParam });
    return NextResponse.json({ galleries: galleriesWithLinks });
  } catch (e: any) {
    console.error('List galleries error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
