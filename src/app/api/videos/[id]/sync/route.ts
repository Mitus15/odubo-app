import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const id = params.id;
    const rows = await queryDatabase('SELECT * FROM videos WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const row = rows[0];

    // Determine Stream UID
    let uid: string | null = row.stream_video_id || null;
    if (!uid) {
      const url = String(row.url || '');
      const m = url.match(/iframe\.videodelivery\.net\/([a-z0-9]+)/i);
      if (m) uid = m[1];
    }
    if (!uid) return NextResponse.json({ error: 'No Stream ID found for this video' }, { status: 400 });

    const { default: CloudflareStreamAPI } = await import('@/lib/cloudflareStream');
    const stream = new CloudflareStreamAPI();
    await stream.updateVideo(uid, { meta: buildStreamMeta(row) });
    try { await writeAuditLog(req, user, 'videos.sync', String(id), { uid }); } catch {}
    return NextResponse.json({ success: true, uid });
  } catch (error) {
    console.error('Sync to Stream failed:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}


