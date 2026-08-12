import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { GalleryUpdateSchema, type GalleryLinkInput } from '@/lib/momentsSchemas';
import { writeAuditLog } from '@/lib/audit';
import { rateLimit } from '@/lib/rateLimit';
import { readableGallery } from '@/lib/moments/access';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    // This response includes the gallery's `code` — the credential that grants
    // access to a private gallery — so an unguarded read here handed out the
    // key, not just the contents.
    const code = new URL(req.url).searchParams.get('code');
    const isAdmin = isAdminUser(getUserFromRequest(req as any));
    if (!(await readableGallery(id, { code, isAdmin }))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rows = await queryDatabase(
      `SELECT id, code, title, description, starts_at, ends_at, created_by, created_at, updated_at, config,
              shopify_product_id, shopify_product_handle, gallery_type, upload_mode, cover_photo_key, sort_order
       FROM galleries WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fetch links for this gallery
    const links = await queryDatabase(
      `SELECT id, link_type, link_id, link_handle, is_primary, display_label, sort_order, created_at
       FROM gallery_links WHERE gallery_id = ? ORDER BY sort_order ASC`,
      [id]
    );

    const gallery = { ...(rows[0] as object), links };
    // Parse config if stored as JSON string
    if (gallery && typeof (gallery as any).config === 'string') {
      try { (gallery as any).config = JSON.parse((gallery as any).config); } catch { (gallery as any).config = {}; }
    }
    return NextResponse.json({ gallery });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const rl = await rateLimit({ key: `galleries:update:${user!.userId}`, limit: 60, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const json = await req.json();
    const parsed = GalleryUpdateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });

    // Separate links from other fields
    const { links, ...galleryFields } = parsed.data;

    // Update gallery fields
    const updates: string[] = [];
    const sqlParams: any[] = [];
    for (const [k, v] of Object.entries(galleryFields)) {
      updates.push(`${k} = ?`);
      sqlParams.push(k === 'config' && v != null ? JSON.stringify(v) : v);
    }
    if (updates.length > 0) {
      sqlParams.push(id);
      await executeQuery(`UPDATE galleries SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, sqlParams);
    }

    // Handle links update if provided (replaces all existing links)
    if (links !== undefined) {
      // Delete existing links
      await executeQuery('DELETE FROM gallery_links WHERE gallery_id = ?', [id]);

      // Insert new links
      if (links && links.length > 0) {
        for (const link of links as GalleryLinkInput[]) {
          await executeQuery(
            `INSERT INTO gallery_links (gallery_id, link_type, link_id, link_handle, is_primary, display_label, sort_order, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              link.link_type,
              link.link_id,
              link.link_handle || null,
              link.is_primary ? 1 : 0,
              link.display_label || null,
              link.sort_order || 0,
              user!.userId,
            ]
          );
        }
      }
    }

    await writeAuditLog(req, user, 'galleries.update', String(id), {
      fields: Object.keys(galleryFields),
      linksUpdated: links !== undefined,
      linksCount: links?.length || 0,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Update gallery error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const rl = await rateLimit({ key: `galleries:delete:${user!.userId}`, limit: 20, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    // Links are deleted automatically via ON DELETE CASCADE
    await executeQuery('DELETE FROM galleries WHERE id = ?', [id]);
    await writeAuditLog(req, user, 'galleries.delete', String(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Delete gallery error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
