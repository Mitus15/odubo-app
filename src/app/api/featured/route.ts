import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';

// Single featured page APIs
export async function GET(_req: NextRequest) {
  try {
    const rows = await queryDatabase(
      `SELECT id, title, subtitle, date_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, is_published, created_at, updated_at
       FROM featured_single WHERE id = 1 LIMIT 1`,
      []
    );
    if (!rows.length) return NextResponse.json({ success: true, item: null });
    return NextResponse.json({ success: true, item: rows[0] });
  } catch (e) {
    console.error('featured single get error:', e);
    return NextResponse.json({ error: 'Failed to fetch featured' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body: any = await req.json();
    const title = String(body?.title || '').trim();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const params = [
      title,
      body?.subtitle || null,
      body?.date_text || null,
      body?.venue || null,
      body?.album_link || null,
      body?.moments_link || null,
      body?.extra_links_json || null,
      body?.is_published ? 1 : 0,
      user?.userId || null,
    ];
    const sql = `INSERT INTO featured_single (id, title, subtitle, date_text, venue, album_link, moments_link, extra_links_json, is_published, created_by, created_at, updated_at)
                 VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET 
                   title = excluded.title,
                   subtitle = excluded.subtitle,
                   date_text = excluded.date_text,
                   venue = excluded.venue,
                   album_link = excluded.album_link,
                   moments_link = excluded.moments_link,
                   extra_links_json = excluded.extra_links_json,
                   is_published = excluded.is_published,
                   updated_at = datetime('now')`;
    await executeQuery(sql, params);
    try { await writeAuditLog(req, user, 'featured_single.upsert', 'singleton'); } catch {}
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured single upsert error:', e);
    return NextResponse.json({ error: 'Failed to save featured' }, { status: 500 });
  }
}
