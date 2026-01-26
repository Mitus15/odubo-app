import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';
import { GalleryCreateSchema, type GalleryLinkInput } from '@/lib/momentsSchemas';

export async function POST(req: Request) {
  const user = getUserFromRequest(req as any);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  try {
    const rl = await rateLimit({ key: `galleries:create:${user.userId}`, limit: 20, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const raw = await req.json();
    const parsed = GalleryCreateSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });

    const {
      title = 'Moments',
      description = null,
      starts_at = null,
      ends_at = null,
      gallery_type = 'event',
      upload_mode = 'public',
      cover_photo_key = null,
      sort_order = 0,
      links = [],
    } = parsed.data;
    const code = parsed.data.code || Math.random().toString(36).slice(2, 8).toUpperCase();
    const config = parsed.data.config ? JSON.stringify(parsed.data.config) : null;

    // Insert the gallery
    const sql = `INSERT INTO galleries (code, title, description, created_by, starts_at, ends_at, config, gallery_type, upload_mode, cover_photo_key, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await executeQuery(sql, [code, title, description, user.userId, starts_at, ends_at, config, gallery_type, upload_mode, cover_photo_key, sort_order]);

    // Get the created gallery ID
    const galleryRows = await queryDatabase('SELECT id FROM galleries WHERE code = ? LIMIT 1', [code]);
    const galleryId = (galleryRows[0] as any)?.id;

    // Insert links if provided
    if (links && links.length > 0 && galleryId) {
      for (const link of links as GalleryLinkInput[]) {
        await executeQuery(
          `INSERT INTO gallery_links (gallery_id, link_type, link_id, link_handle, is_primary, display_label, sort_order, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            galleryId,
            link.link_type,
            link.link_id,
            link.link_handle || null,
            link.is_primary ? 1 : 0,
            link.display_label || null,
            link.sort_order || 0,
            user.userId,
          ]
        );
      }
    }

    await writeAuditLog(req, user, 'galleries.create', code, { title, gallery_type, upload_mode, linksCount: links?.length || 0 });
    return NextResponse.json({ success: true, code, id: galleryId });
  } catch (e: any) {
    console.error('Create gallery error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
