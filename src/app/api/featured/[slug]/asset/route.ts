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

// DELETE /api/featured/[slug]/asset?kind=cover|background
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const kind = (url.searchParams.get('kind') || '').toLowerCase();
    if (!['cover','background'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be cover or background' }, { status: 400 });
    }
    const s = slug.toLowerCase();

    const rows = await queryDatabase(
      `SELECT cover_image_url, background_video_url FROM featured_pages WHERE slug = ? LIMIT 1`,
      [s]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const currentUrl: string | null = kind === 'cover' ? (rows[0] as any).cover_image_url : (rows[0] as any).background_video_url;
    if (!currentUrl) return NextResponse.json({ success: true, message: 'No asset set' });

    const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    const toKey = (u: string) => {
      if (base && u.startsWith(base + '/')) return u.substring(base.length + 1);
      try { const parsed = new URL(u); return parsed.pathname.replace(/^\//, ''); } catch { return u; }
    };

    const key = toKey(currentUrl);
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: key }));
    } catch (e) {
      console.warn('R2 delete failed for', key, e);
    }

    const field = kind === 'cover' ? 'cover_image_url' : 'background_video_url';
    await executeQuery(`UPDATE featured_pages SET ${field} = NULL, updated_at = datetime('now') WHERE slug = ?`, [s]);
    try { await writeAuditLog(req, user, 'featured.asset.delete', s, { kind, key }); } catch {}

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured asset delete error:', e);
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
  }
}
