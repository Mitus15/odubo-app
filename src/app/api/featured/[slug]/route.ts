import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const s = slug.toLowerCase();
    const rows = await queryDatabase(
  `SELECT slug, title, subtitle, date_text, time_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, is_published, created_at, updated_at
       FROM featured_pages WHERE slug = ? LIMIT 1`,
       [s]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, item: rows[0] });
  } catch (e) {
    console.error('featured get error:', e);
    return NextResponse.json({ error: 'Failed to fetch featured' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { slug } = await params;
    const s = slug.toLowerCase();
    const body: any = await req.json().catch(() => ({}));
    const fields: string[] = [];
    const paramsArr: any[] = [];
    const set = (col: string, val: any) => { if (val !== undefined) { fields.push(`${col} = ?`); paramsArr.push(val); } };

    set('title', body?.title);
    set('subtitle', body?.subtitle);
  set('date_text', body?.date_text);
  set('time_text', body?.time_text);
    set('venue', body?.venue);
    set('album_link', body?.album_link);
    set('moments_link', body?.moments_link);
    set('extra_links_json', body?.extra_links_json);
    if (typeof body?.is_published !== 'undefined') set('is_published', body.is_published ? 1 : 0);

    if (fields.length === 0) return NextResponse.json({ success: true, message: 'No updates' });

    const sql = `UPDATE featured_pages SET ${fields.join(', ')}, updated_at = datetime('now') WHERE slug = ?`;
    paramsArr.push(s);
    await executeQuery(sql, paramsArr);
    try { await writeAuditLog(req, user, 'featured.update', s, { fields }); } catch {}
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured update error:', e);
    return NextResponse.json({ error: 'Failed to update featured' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { slug } = await params;
    const s = slug.toLowerCase();
    const rows = await queryDatabase(
      `SELECT cover_image_url, background_video_url FROM featured_pages WHERE slug = ? LIMIT 1`,
      [s]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { cover_image_url, background_video_url } = rows[0] as any;

    const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    const toKey = (url: string | null | undefined) => {
      if (!url) return null;
      if (base && url.startsWith(base + '/')) return url.substring(base.length + 1);
      try { const u = new URL(url); return u.pathname.replace(/^\//, ''); } catch { return url; }
    };

    const keys = [toKey(cover_image_url), toKey(background_video_url)].filter(Boolean) as string[];
    for (const key of keys) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: key }));
      } catch (e) {
        console.warn('R2 delete failed for', key, e);
      }
    }

    await executeQuery(`DELETE FROM featured_pages WHERE slug = ?`, [s]);
    try { await writeAuditLog(req, user, 'featured.delete', s, { deletedKeys: keys }); } catch {}
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured delete error:', e);
    return NextResponse.json({ error: 'Failed to delete featured' }, { status: 500 });
  }
}
