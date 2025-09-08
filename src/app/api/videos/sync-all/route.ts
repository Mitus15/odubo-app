import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

export const runtime = 'edge';
export const maxDuration = 300;

function buildStreamMeta(row: any): Record<string, any> {
  const credits = row.credits ? (typeof row.credits === 'string' ? row.credits : JSON.stringify(row.credits)) : '';
  const related = row.related_projects ? (typeof row.related_projects === 'string' ? row.related_projects : JSON.stringify(row.related_projects)) : '';
  const tags = [row.category, row.type, row.mood].filter(Boolean).join(',');
  return {
    title: row.title || '',
    creator: row.artist_name || '',
    artist_name: row.artist_name || '',
    description: row.description || '',
    category: row.category || '',
    type: row.type || '',
    mood: row.mood || '',
    credits,
    related_projects: related,
    tags,
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const rows = await queryDatabase('SELECT * FROM videos ORDER BY id ASC');
    const { default: CloudflareStreamAPI } = await import('@/lib/cloudflareStream');
    const stream = new CloudflareStreamAPI();

    let updated = 0;
    for (const row of rows) {
      let uid: string | null = row.stream_video_id || null;
      if (!uid) {
        const url = String(row.url || '');
        const m = url.match(/iframe\.videodelivery\.net\/([a-z0-9]+)/i);
        if (m) uid = m[1];
      }
      if (!uid) continue;
      try {
        await stream.updateVideo(uid, { meta: buildStreamMeta(row) });
        updated++;
      } catch (e) {
        console.warn('Sync failed for', row.id, e);
      }
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('Sync-all to Stream failed:', error);
    return NextResponse.json({ error: 'Sync-all failed' }, { status: 500 });
  }
}


