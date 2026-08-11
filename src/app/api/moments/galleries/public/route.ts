import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

// Public endpoint to list recent galleries for the Moments page
// Returns minimal safe fields only. Pagination supported via limit/offset.
// Now includes photo_count and latest 4 photos for preview to reduce N+1 queries
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '12')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));
    const includePreview = url.searchParams.get('preview') === 'true';

    // Galleries whose config marks them private (config.visibility = 'private')
    // are link/code-access only and stay off the public listing. json_valid
    // guards rows with malformed config; missing visibility means public.
    const rows = await queryDatabase(
      `SELECT g.id, g.title, g.description, g.starts_at, g.ends_at, g.created_at, g.updated_at,
        (
          SELECT gp.thumbnail_key FROM gallery_photos gp
          WHERE gp.gallery_id = g.id AND (gp.moderated != 2 OR gp.moderated IS NULL)
          ORDER BY gp.created_at DESC
          LIMIT 1
        ) AS cover_thumbnail_key,
        (
          SELECT gp.r2_key FROM gallery_photos gp
          WHERE gp.gallery_id = g.id AND (gp.moderated != 2 OR gp.moderated IS NULL)
          ORDER BY gp.created_at DESC
          LIMIT 1
        ) AS cover_r2_key,
        (
          SELECT COUNT(*) FROM gallery_photos gp
          WHERE gp.gallery_id = g.id AND (gp.moderated != 2 OR gp.moderated IS NULL)
        ) AS photo_count
       FROM galleries g
       WHERE g.config IS NULL
          OR NOT (json_valid(g.config) AND json_extract(g.config, '$.visibility') = 'private')
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
      photo_count: Number(g.photo_count) || 0,
    }));

    // If preview requested, fetch latest 4 photos for each gallery in batch
    if (includePreview && galleries.length > 0) {
      const galleryIds = galleries.map((g: any) => g.id);
      const photoRows = await queryDatabase(
        `SELECT id, gallery_id, thumbnail_key, r2_key, created_at,
          ROW_NUMBER() OVER (PARTITION BY gallery_id ORDER BY created_at DESC) as rn
         FROM gallery_photos
         WHERE gallery_id IN (${galleryIds.map(() => '?').join(',')})
           AND (moderated != 2 OR moderated IS NULL)
         ORDER BY gallery_id, created_at DESC`,
        galleryIds
      );

      // Group photos by gallery and filter to top 4
      const photosByGallery: Record<number, any[]> = {};
      (photoRows || []).forEach((p: any) => {
        if (p.rn <= 4) {
          if (!photosByGallery[p.gallery_id]) photosByGallery[p.gallery_id] = [];
          photosByGallery[p.gallery_id].push({
            id: p.id,
            thumbnail_url: p.thumbnail_key && publicBase ? `${publicBase}/${p.thumbnail_key}` : null,
            r2_url: publicBase ? `${publicBase}/${p.r2_key}` : null,
          });
        }
      });

      // Attach preview photos to each gallery
      galleries.forEach((g: any) => {
        g.preview_photos = photosByGallery[g.id] || [];
      });
    }

    // Cache for 2 minutes
    return NextResponse.json({ galleries }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      },
    });
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
