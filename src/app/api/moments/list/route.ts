import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const galleryId = url.searchParams.get('galleryId');
    const limit = Number(url.searchParams.get('limit') || '50');
    const offset = Number(url.searchParams.get('offset') || '0');
  const code = url.searchParams.get('code');

    if (!galleryId) return NextResponse.json({ error: 'Missing galleryId' }, { status: 400 });

    // Public viewing mode controlled by env flag:
    // MOMENTS_PUBLIC_MODE = 'all' | 'moderated' (default 'all')
    const publicMode = (process.env.MOMENTS_PUBLIC_MODE || 'all').toLowerCase();
    // Keep basic rate limiting. Admin detection is retained only for key scoping.
    const user = await verifyUserFromRequest(req as any).catch(() => null);
    const isAdmin = isAdminUser(user);
    const rlKey = isAdmin ? `moments:list:admin:${user!.userId}` : `moments:list:${galleryId}:public`;
    const rl = await rateLimit({ key: rlKey, limit: 300, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    // Apply moderation filter if configured
    const where = publicMode === 'moderated'
      ? 'WHERE gallery_id = ? AND (moderated = 1 OR moderated IS NULL)'
      : 'WHERE gallery_id = ?';
    const rows = await queryDatabase(
      `SELECT id, uid, r2_key, thumbnail_key, user_name, moderated, created_at, media_type, original_filename
       FROM gallery_photos ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [galleryId, limit, offset]
    );
    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    const photos = (rows || []).map((r: any) => ({
      ...r,
      r2_url: publicBase ? `${publicBase}/${r.r2_key}` : null,
      thumbnail_url: r.thumbnail_key ? (publicBase ? `${publicBase}/${r.thumbnail_key}` : null) : null,
    }));
    return NextResponse.json({ photos });
  } catch (e: any) {
    console.error('List gallery photos error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
