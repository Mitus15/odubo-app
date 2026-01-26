import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';
import {
  GalleryLinkAddSchema,
  GalleryLinkUpdateSchema,
  GalleryLinksReorderSchema,
} from '@/lib/momentsSchemas';

/**
 * GET /api/moments/galleries/[id]/links
 * List all links for a gallery
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const links = await queryDatabase(
      `SELECT id, link_type, link_id, link_handle, is_primary, display_label, sort_order, created_at, created_by
       FROM gallery_links WHERE gallery_id = ? ORDER BY sort_order ASC`,
      [id]
    );

    return NextResponse.json({ links });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

/**
 * POST /api/moments/galleries/[id]/links
 * Add a new link to a gallery
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const { id: idStr } = await ctx.params;
    const galleryId = Number(idStr);
    if (!Number.isFinite(galleryId)) return NextResponse.json({ error: 'Invalid gallery id' }, { status: 400 });

    const rl = await rateLimit({ key: `gallery-links:add:${user!.userId}`, limit: 60, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    // Verify gallery exists
    const gallery = await queryDatabase('SELECT id FROM galleries WHERE id = ? LIMIT 1', [galleryId]);
    if (gallery.length === 0) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

    const json = await req.json();
    const parsed = GalleryLinkAddSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });

    const { link_type, link_id, link_handle, is_primary, display_label, sort_order } = parsed.data;

    // If this link is primary, unset other primary links
    if (is_primary) {
      await executeQuery('UPDATE gallery_links SET is_primary = 0 WHERE gallery_id = ?', [galleryId]);
    }

    // Get max sort_order if not provided
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const maxResult = await queryDatabase(
        'SELECT MAX(sort_order) as max_order FROM gallery_links WHERE gallery_id = ?',
        [galleryId]
      );
      finalSortOrder = ((maxResult[0] as any)?.max_order || 0) + 1;
    }

    // Insert the link
    await executeQuery(
      `INSERT INTO gallery_links (gallery_id, link_type, link_id, link_handle, is_primary, display_label, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [galleryId, link_type, link_id, link_handle || null, is_primary ? 1 : 0, display_label || null, finalSortOrder, user!.userId]
    );

    // Get the created link
    const created = await queryDatabase(
      `SELECT id, link_type, link_id, link_handle, is_primary, display_label, sort_order, created_at
       FROM gallery_links WHERE gallery_id = ? AND link_type = ? AND link_id = ? LIMIT 1`,
      [galleryId, link_type, link_id]
    );

    await writeAuditLog(req, user, 'gallery-links.add', String(galleryId), { link_type, link_id });
    return NextResponse.json({ success: true, link: created[0] });
  } catch (e: any) {
    // Handle unique constraint violation
    if (e.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'This content is already linked to the gallery' }, { status: 409 });
    }
    console.error('Add gallery link error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

/**
 * PATCH /api/moments/galleries/[id]/links
 * Update a specific link (pass linkId in body)
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const { id: idStr } = await ctx.params;
    const galleryId = Number(idStr);
    if (!Number.isFinite(galleryId)) return NextResponse.json({ error: 'Invalid gallery id' }, { status: 400 });

    const rl = await rateLimit({ key: `gallery-links:update:${user!.userId}`, limit: 60, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const json = await req.json();
    const { linkId, ...updateData } = json;

    if (!linkId || typeof linkId !== 'number') {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    const parsed = GalleryLinkUpdateSchema.safeParse(updateData);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });

    // Verify link exists and belongs to this gallery
    const existingLink = await queryDatabase(
      'SELECT id FROM gallery_links WHERE id = ? AND gallery_id = ? LIMIT 1',
      [linkId, galleryId]
    );
    if (existingLink.length === 0) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

    const { is_primary, display_label, sort_order } = parsed.data;

    // If setting as primary, unset other primary links
    if (is_primary) {
      await executeQuery('UPDATE gallery_links SET is_primary = 0 WHERE gallery_id = ?', [galleryId]);
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    if (is_primary !== undefined) {
      updates.push('is_primary = ?');
      params.push(is_primary ? 1 : 0);
    }
    if (display_label !== undefined) {
      updates.push('display_label = ?');
      params.push(display_label);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order);
    }

    if (updates.length > 0) {
      params.push(linkId);
      await executeQuery(`UPDATE gallery_links SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    await writeAuditLog(req, user, 'gallery-links.update', String(galleryId), { linkId, updates: Object.keys(parsed.data) });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Update gallery link error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/moments/galleries/[id]/links
 * Delete a link (pass linkId in query param or body)
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const { id: idStr } = await ctx.params;
    const galleryId = Number(idStr);
    if (!Number.isFinite(galleryId)) return NextResponse.json({ error: 'Invalid gallery id' }, { status: 400 });

    const rl = await rateLimit({ key: `gallery-links:delete:${user!.userId}`, limit: 60, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    // Get linkId from query or body
    const url = new URL(req.url);
    let linkId = Number(url.searchParams.get('linkId'));

    if (!linkId || !Number.isFinite(linkId)) {
      try {
        const body = await req.json();
        linkId = body.linkId;
      } catch {
        // No body
      }
    }

    if (!linkId || !Number.isFinite(linkId)) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    // Verify link belongs to this gallery
    const existingLink = await queryDatabase(
      'SELECT id FROM gallery_links WHERE id = ? AND gallery_id = ? LIMIT 1',
      [linkId, galleryId]
    );
    if (existingLink.length === 0) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

    await executeQuery('DELETE FROM gallery_links WHERE id = ?', [linkId]);

    await writeAuditLog(req, user, 'gallery-links.delete', String(galleryId), { linkId });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Delete gallery link error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

/**
 * PUT /api/moments/galleries/[id]/links
 * Reorder links (pass array of link_ids in body)
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const { id: idStr } = await ctx.params;
    const galleryId = Number(idStr);
    if (!Number.isFinite(galleryId)) return NextResponse.json({ error: 'Invalid gallery id' }, { status: 400 });

    const rl = await rateLimit({ key: `gallery-links:reorder:${user!.userId}`, limit: 30, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const json = await req.json();
    const parsed = GalleryLinksReorderSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });

    const { link_ids } = parsed.data;

    // Update sort_order for each link
    for (let i = 0; i < link_ids.length; i++) {
      await executeQuery(
        'UPDATE gallery_links SET sort_order = ? WHERE id = ? AND gallery_id = ?',
        [i, link_ids[i], galleryId]
      );
    }

    await writeAuditLog(req, user, 'gallery-links.reorder', String(galleryId), { count: link_ids.length });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Reorder gallery links error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
