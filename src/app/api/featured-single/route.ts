import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';

async function getOrCreateSingleton() {
  const rows = await queryDatabase(
    `SELECT slug, title, subtitle, date_text, time_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, is_published, created_at, updated_at FROM featured_pages LIMIT 1`,
    []
  );
  if (rows && rows.length) return rows[0];
  // Create default singleton row
  await executeQuery(
    `INSERT INTO featured_pages (slug, title, is_published, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    ['featured', 'Featured', 1]
  );
  const rows2 = await queryDatabase(
    `SELECT slug, title, subtitle, date_text, time_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, is_published, created_at, updated_at FROM featured_pages LIMIT 1`,
    []
  );
  return rows2[0];
}

export async function GET() {
  try {
    const item = await getOrCreateSingleton();
    return NextResponse.json({ success: true, item });
  } catch (e) {
    console.error('featured-single get error:', e);
    return NextResponse.json({ error: 'Failed to load featured' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body: any = await req.json().catch(() => ({}));
    const fields: string[] = [];
    const paramsArr: any[] = [];
    const set = (col: string, val: any) => { if (val !== undefined) { fields.push(`${col} = ?`); paramsArr.push(val); } };

    set('title', body?.title);
    set('subtitle', body?.subtitle);
  set('date_text', body?.date_text);
  set('time_text', body?.time_text);
    set('venue', body?.venue);
    set('album_link', body?.album_link);
    set('moments_link', body?.moments_link);
    set('extra_links_json', body?.extra_links_json);
    if (typeof body?.is_published !== 'undefined') set('is_published', body.is_published ? 1 : 0);

    if (!fields.length) return NextResponse.json({ success: true, message: 'No updates' });

    // Update the first/only row
    await executeQuery(`UPDATE featured_pages SET ${fields.join(', ')}, updated_at = datetime('now') WHERE rowid = (SELECT rowid FROM featured_pages LIMIT 1)`, paramsArr);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured-single put error:', e);
    return NextResponse.json({ error: 'Failed to update featured' }, { status: 500 });
  }
}
