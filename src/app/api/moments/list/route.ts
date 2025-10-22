import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const galleryId = url.searchParams.get('galleryId');
    const limit = Number(url.searchParams.get('limit') || '50');
    const offset = Number(url.searchParams.get('offset') || '0');

    if (!galleryId) return NextResponse.json({ error: 'Missing galleryId' }, { status: 400 });

    const rows = await queryDatabase('SELECT id, uid, r2_key, thumbnail_key, user_name, moderated, created_at, media_type, original_filename FROM gallery_photos WHERE gallery_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [galleryId, limit, offset]);
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
