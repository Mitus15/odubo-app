import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

// DELETE /api/featured/asset?kind=cover|background
export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const url = new URL(req.url);
    const kind = String(url.searchParams.get('kind') || '').trim();
    if (!['cover', 'background'].includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

    const rows = await queryDatabase(
      `SELECT cover_image_url, background_video_url FROM featured_single WHERE id = 1 LIMIT 1`,
      []
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const field = kind === 'cover' ? 'cover_image_url' : 'background_video_url';
    const priorUrl: string | null = (rows[0] as any)[field] || null;

    await executeQuery(`UPDATE featured_single SET ${field} = NULL, updated_at = datetime('now') WHERE id = 1`, []);

    if (priorUrl) {
      const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
      const toKey = (u: string) => {
        if (base && u.startsWith(base + '/')) return u.substring(base.length + 1);
        try { const parsed = new URL(u); return parsed.pathname.replace(/^\//, ''); } catch { return u; }
      };
      const priorKey = toKey(priorUrl);
      try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: priorKey })); } catch (e) {
        console.warn('R2 delete previous failed for', priorKey, e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured asset delete error:', e);
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
  }
}
