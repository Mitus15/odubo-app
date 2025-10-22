import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json() as any;
    const galleryId = body.galleryId;
    const key = body.r2_key || body.key; // r2 object key
    const thumbnailKey = body.thumbnail_key || body.thumbnailKey || null;
    const uid = body.uid || Math.random().toString(36).slice(2, 10);
    const originalFilename = body.original_filename || body.originalFilename || null;
    const userName = body.user_name || body.userName || null;
    const mediaType = body.media_type || body.mediaType || 'photo';

    if (!galleryId || !key) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    const sql = `INSERT INTO gallery_photos (gallery_id, uid, r2_key, thumbnail_key, original_filename, user_name, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await executeQuery(sql, [galleryId, uid, key, thumbnailKey, originalFilename, userName, mediaType]);

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
