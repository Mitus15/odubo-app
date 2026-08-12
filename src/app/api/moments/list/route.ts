import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { readableGallery } from '@/lib/moments/access';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const galleryId = url.searchParams.get('galleryId');
    const limit = Number(url.searchParams.get('limit') || '50');
    const offset = Number(url.searchParams.get('offset') || '0');
  const code = url.searchParams.get('code');

    if (!galleryId) return NextResponse.json({ error: 'Missing galleryId' }, { status: 400 });

    // Photos are visible by default. Moderation only hides inappropriate content.
    // moderated = 0 (default/unreviewed) → visible
    // moderated = 1 (approved) → visible
    // moderated = 2 (rejected/hidden) → hidden from public
    const user = getUserFromRequest(req as any) || null;
    const isAdmin = isAdminUser(user);
    const rlKey = isAdmin ? `moments:list:admin:${user!.userId}` : `moments:list:${galleryId}:public`;
    const rl = await rateLimit({ key: rlKey, limit: 300, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    // A private gallery is link/code-access only. This route took `code` off
    // the query string and never looked at it, so every photo in every private
    // gallery was readable by anyone who could guess the id. 404 rather than
    // 403 — confirming a private gallery exists at an id is itself a leak.
    if (!(await readableGallery(galleryId, { code, isAdmin }))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let where: string;
    if (isAdmin) {
      // Admins see everything (including hidden) for moderation purposes
      where = 'WHERE gallery_id = ?';
    } else {
      // Public view: show all photos except rejected/hidden ones (moderated = 2)
      where = 'WHERE gallery_id = ? AND (moderated != 2 OR moderated IS NULL)';
    }
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
    
    // Cache for 30 seconds for public, 10 seconds for admin (fresher for moderation)
    const cacheTime = isAdmin ? 10 : 30;
    return NextResponse.json({ photos }, {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheTime}, stale-while-revalidate=15`,
      },
    });
  } catch (e: any) {
    console.error('List gallery photos error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
