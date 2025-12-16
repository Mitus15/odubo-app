import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';

async function getOrCreateByMode(mode: string = 'event') {
  const rows = await queryDatabase(
    `SELECT slug, title, subtitle, date_text, time_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, mode, product_handle, product_price, product_cta_text, is_published, created_at, updated_at FROM featured_pages WHERE mode = ? LIMIT 1`,
    [mode]
  );
  if (rows && rows.length) return rows[0];
  // Create default row for this mode
  await executeQuery(
    `INSERT INTO featured_pages (slug, title, mode, is_published, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [`featured-${mode}`, `Featured ${mode.charAt(0).toUpperCase() + mode.slice(1)}`, mode, 1]
  );
  const rows2 = await queryDatabase(
    `SELECT slug, title, subtitle, date_text, time_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json, mode, product_handle, product_price, product_cta_text, is_published, created_at, updated_at FROM featured_pages WHERE mode = ? LIMIT 1`,
    [mode]
  );
  return rows2[0];
}

export async function GET(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get('mode') || 'event';
    const item = await getOrCreateByMode(mode);
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
    const mode = body?.mode || 'event';
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
    set('mode', mode);
    set('product_handle', body?.product_handle);
    set('product_price', body?.product_price);
    set('product_cta_text', body?.product_cta_text);
    
    // Handle is_published - if setting to 1, unpublish all other modes first
    if (typeof body?.is_published !== 'undefined') {
      const newPublishState = body.is_published ? 1 : 0;
      if (newPublishState === 1) {
        // Unpublish all other modes first to ensure only one mode is published
        await executeQuery(`UPDATE featured_pages SET is_published = 0, updated_at = datetime('now') WHERE mode != ?`, [mode]);
      }
      set('is_published', newPublishState);
    }

    if (!fields.length) return NextResponse.json({ success: true, message: 'No updates' });

    // Update the row for this specific mode
    paramsArr.push(mode);
    await executeQuery(`UPDATE featured_pages SET ${fields.join(', ')}, updated_at = datetime('now') WHERE mode = ?`, paramsArr);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('featured-single put error:', e);
    return NextResponse.json({ error: 'Failed to update featured' }, { status: 500 });
  }
}
