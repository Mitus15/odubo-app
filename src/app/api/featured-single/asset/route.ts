import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

// DELETE /api/featured-single/asset?kind=cover|background
export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const url = new URL(req.url);
    const kind = String(url.searchParams.get('kind') || '');
    const mode = String(url.searchParams.get('mode') || 'event');
    if (!['cover','background'].includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

    const field = kind === 'cover' ? 'cover_image_url' : 'background_video_url';
    const rows = await queryDatabase(`SELECT ${field} FROM featured_pages WHERE mode = ? LIMIT 1`, [mode]);
    const current = rows[0] || {} as any;
    const currentUrl: string | null = current[field] || null;

    await executeQuery(`UPDATE featured_pages SET ${field} = NULL, updated_at = datetime('now') WHERE mode = ?`, [mode]);

    if (currentUrl) {
      try {
        const publicBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
        const oldBase = publicBase ? `${publicBase}/` : '';
        const key = currentUrl.startsWith(oldBase) ? currentUrl.substring(oldBase.length) : (new URL(currentUrl)).pathname.replace(/^\//, '');
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: key }));
      } catch (e) {
        console.warn('R2 delete failed (asset):', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured-single asset delete error:', e);
    return NextResponse.json({ error: 'Failed to remove asset' }, { status: 500 });
  }
}
