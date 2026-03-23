import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req as any) || null;
    const isAdmin = isAdminUser(user);

    const body = await req.json() as any;
    const galleryId = body.galleryId;
    const code = body.code || null;
    const r2Key = body.r2_key;
    const thumbnailKey = body.thumbnail_key || null;
    const originalFilename = body.original_filename;
    const userName = body.user_name || body.userName || null;
    const duration = body.duration_seconds || body.duration || 15;
    const caption = body.caption || null;

    if (!r2Key || (!galleryId && !code)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Resolve gallery ID from code if needed
    let resolvedGalleryId = galleryId;
    if (code && !galleryId) {
      const rows = await queryDatabase('SELECT id FROM galleries WHERE code = ? LIMIT 1', [code]);
      if (!rows[0]) {
        return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
      }
      resolvedGalleryId = (rows[0] as any).id;
    }

    // Rate limit
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const rl = await rateLimit({ key: `clips-record:${ip}`, limit: 20, windowMs: 60000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Get public URL
    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, '') || '';
    const r2Url = `${publicBase}/${r2Key}`;
    const thumbnailUrl = thumbnailKey ? `${publicBase}/${thumbnailKey}` : null;

    // Insert clip
    const insertResult = await executeQuery(
      `INSERT INTO event_clips (event_id, r2_key, r2_url, thumbnail_key, thumbnail_url, duration_seconds, caption, user_name, moderated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [resolvedGalleryId, r2Key, r2Url, thumbnailKey, thumbnailUrl, duration, caption, userName, isAdmin ? 1 : 0]
    );

    const clipId = insertResult.lastInsertRowid;

    return NextResponse.json({
      success: true,
      clip_id: clipId,
      r2_url: r2Url,
      thumbnail_url: thumbnailUrl,
    });
  } catch (e: any) {
    console.error('Clips record error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to record clip' }, { status: 500 });
  }
}