import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';

// GET /api/featured/active -> returns the active featured item if present
export async function GET() {
  try {
    try {
      const rows = await queryDatabase(
        `SELECT slug, title, subtitle, date_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, is_published, is_active, created_at, updated_at FROM featured_pages WHERE is_active = 1 LIMIT 1`,
        []
      );
      if (rows && rows.length) return NextResponse.json({ success: true, item: rows[0] });
    } catch (e: any) {
      // Likely column doesn't exist yet; fall through to fallback
      if (String(e?.message || '').includes('no such column: is_active')) {
        // ignore
      } else {
        console.warn('active GET primary query error:', e);
      }
    }

    // Fallback: latest published
    const fb = await queryDatabase(
      `SELECT slug, title, subtitle, date_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, is_published, 0 as is_active, created_at, updated_at FROM featured_pages WHERE is_published = 1 ORDER BY updated_at DESC LIMIT 1`,
      []
    );
    if (fb && fb.length) return NextResponse.json({ success: true, item: fb[0], fallback: true });
    return NextResponse.json({ error: 'No featured items available' }, { status: 404 });
  } catch (e) {
    console.error('featured active get error:', e);
    return NextResponse.json({ error: 'Failed to resolve active featured' }, { status: 500 });
  }
}

// PUT /api/featured/active -> { slug }
export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body: any = await req.json().catch(() => ({}));
    const slug = String(body?.slug || '').trim().toLowerCase();
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

    // Ensure record exists
    const exists = await queryDatabase(`SELECT slug FROM featured_pages WHERE slug = ? LIMIT 1`, [slug]);
    if (!exists.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Attempt update sequence; if column missing, instruct migration
    try {
      await executeQuery(`UPDATE featured_pages SET is_active = 0 WHERE is_active = 1`, []);
      await executeQuery(`UPDATE featured_pages SET is_active = 1, updated_at = datetime('now') WHERE slug = ?`, [slug]);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('no such column: is_active')) {
        return NextResponse.json({ error: 'Active feature not enabled. Please apply latest D1 migrations.' }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured active set error:', e);
    return NextResponse.json({ error: 'Failed to set active featured' }, { status: 500 });
  }
}
