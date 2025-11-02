import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '50')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));
    const rows = await queryDatabase(
      `SELECT slug, title, subtitle, date_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, is_published, created_at, updated_at
       FROM featured_pages ORDER BY created_at DESC LIMIT ? OFFSET ?`,
       [limit, offset]
    );
    return NextResponse.json({ success: true, items: rows });
  } catch (e) {
    console.error('featured list error:', e);
    return NextResponse.json({ error: 'Failed to list featured' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body: any = await req.json();
    const slug = String(body?.slug || '').trim().toLowerCase();
    const title = String(body?.title || '').trim();
    if (!slug || !title) return NextResponse.json({ error: 'slug and title required' }, { status: 400 });

    await executeQuery(
      `INSERT INTO featured_pages (slug, title, subtitle, date_text, venue, album_link, moments_link, extra_links_json, is_published, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        slug,
        title,
  body?.subtitle || null,
  body?.date_text || null,
  body?.venue || null,
  body?.album_link || null,
  body?.moments_link || null,
  body?.extra_links_json || null,
  body?.is_published ? 1 : 0,
        user?.userId || null,
      ]
    );
    try { await writeAuditLog(req, user, 'featured.create', slug); } catch {}
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured create error:', e);
    return NextResponse.json({ error: 'Failed to create featured' }, { status: 500 });
  }
}
