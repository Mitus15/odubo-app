import { NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    // Check if user is admin for permission handling
    const _user = getUserFromRequest(req as any) || null;
    const isAdmin = isAdminUser(_user);

    const body = await req.json() as any;
    let galleryId = body.galleryId as number | string | undefined;
    const code = body.code || body.eventCode || null;
    const key = body.r2_key || body.key; // r2 object key
    const thumbnailKey = body.thumbnail_key || body.thumbnailKey || null;
    const uid = body.uid || Math.random().toString(36).slice(2, 10);
    const originalFilename = body.original_filename || body.originalFilename || null;
    const userName = body.user_name || body.userName || null;
    const mediaType = body.media_type || body.mediaType || 'photo';
    // New fields for custom galleries
    const source = body.source || (isAdmin ? 'admin' : 'public');
    const caption = body.caption || null;
    const sortOrder = body.sort_order || body.sortOrder || 0;

    if ((!galleryId && !code) || !key) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    // Load gallery with upload_mode for permission check
    const rows = code
      ? await queryDatabase('SELECT id, starts_at, ends_at, upload_mode FROM galleries WHERE code = ? LIMIT 1', [code])
      : await queryDatabase('SELECT id, starts_at, ends_at, upload_mode FROM galleries WHERE id = ? LIMIT 1', [galleryId]);
    if (!rows[0]) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

    const { starts_at, ends_at, id, upload_mode } = rows[0] as {
      id: number;
      starts_at?: string | null;
      ends_at?: string | null;
      upload_mode?: string;
    };
    galleryId = id;

    // Check upload permission based on upload_mode
    const uploadMode = upload_mode || 'public';
    if (uploadMode === 'admin' && !isAdmin) {
      return NextResponse.json({ error: 'This gallery only accepts uploads from administrators.' }, { status: 403 });
    }

    // For public galleries, check time windows (admin bypasses time restrictions)
    if (!isAdmin) {
      const now = Date.now();
      const startOk = !starts_at || !Number.isNaN(Date.parse(starts_at)) ? (!starts_at || now >= Date.parse(starts_at!)) : true;
      const endOk = !ends_at || !Number.isNaN(Date.parse(ends_at)) ? (!ends_at || now <= Date.parse(ends_at!)) : true;
      if (!(startOk && endOk)) {
        return NextResponse.json({ error: 'This gallery is not accepting uploads at this time.' }, { status: 403 });
      }
    }

    // Rate limit per IP per gallery for record writes
    const ip = (req as any).headers?.get?.('x-forwarded-for') || 'unknown';
    const rl = await rateLimit({ key: `moments:record:${ip}:g:${galleryId}`, limit: 180, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // Insert photo with new fields (source, caption, sort_order)
    const sql = `INSERT INTO gallery_photos (gallery_id, uid, r2_key, thumbnail_key, original_filename, user_name, media_type, source, caption, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await executeQuery(sql, [galleryId, uid, key, thumbnailKey, originalFilename, userName, mediaType, source, caption, sortOrder]);

    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    const r2Url = `${publicBase}/${key}`;
    const thumbnailUrl = thumbnailKey ? `${publicBase}/${thumbnailKey}` : null;

    // If this is a video, kick off thumbnail generation asynchronously (do not block response)
    if (mediaType === 'video') {
      // import dynamically to avoid loading heavy dependencies in cold paths
      (async () => {
        try {
          const mod = await import('@/worker/generate_video_thumbnail');
          if (mod && typeof mod.generateThumbnailForVideo === 'function') {
            await mod.generateThumbnailForVideo(key, String(galleryId), uid);
          }
        } catch (err) {
          console.error('Failed to start thumbnail generation:', err);
        }
      })();
    }

    return NextResponse.json({ success: true, uid, r2_url: r2Url, thumbnail_url: thumbnailUrl });
  } catch (e: any) {
    console.error('Record photo error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
