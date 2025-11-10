import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

// Public endpoint to list recent galleries for the Moments page
// Returns minimal safe fields only. Pagination supported via limit/offset.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '12')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));

    // In the future: filter by visibility in config JSON
    const rows = await queryDatabase(
      `SELECT g.id, g.title, g.description, g.starts_at, g.ends_at, g.created_at, g.updated_at,
        (
          SELECT gp.thumbnail_key FROM gallery_photos gp
          WHERE gp.gallery_id = g.id AND (gp.moderated = 1 OR gp.moderated IS NULL)
          ORDER BY gp.created_at DESC
          LIMIT 1
        ) AS cover_thumbnail_key,
        (
          SELECT gp.r2_key FROM gallery_photos gp
          WHERE gp.gallery_id = g.id AND (gp.moderated = 1 OR gp.moderated IS NULL)
          ORDER BY gp.created_at DESC
          LIMIT 1
        ) AS cover_r2_key
       FROM galleries g
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    const galleries = (rows || []).map((g: any) => ({
      ...g,
      title: g.title || 'Untitled',
      cover_url: g.cover_r2_key && publicBase ? `${publicBase}/${g.cover_r2_key}` : null,
      cover_thumb_url: g.cover_thumbnail_key && publicBase ? `${publicBase}/${g.cover_thumbnail_key}` : null,
    }));

    return NextResponse.json({ galleries });
  } catch (e: any) {
    console.error('Public galleries list error:', e);
    const msg = String(e?.message || e);
    // If tables not created yet, return empty list to avoid breaking public page
    if (/no such table/i.test(msg) && (msg.includes('galleries') || msg.includes('gallery_photos'))) {
      return NextResponse.json({ galleries: [] });
    }
    return NextResponse.json({ error: msg || 'Failed' }, { status: 500 });
  }
}
