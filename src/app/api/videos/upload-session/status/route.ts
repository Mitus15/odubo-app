import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = Number(searchParams.get('sessionId'));
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const sessions = await queryDatabase('SELECT id, uid, status, created_at, updated_at FROM video_upload_sessions WHERE id = ? LIMIT 1', [sessionId]);
    if (!sessions.length) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const s = sessions[0];
    const counts = await queryDatabase('SELECT COUNT(*) as cnt FROM videos_thumbnail_candidates WHERE session_id = ?', [sessionId]);
    const count = Number(counts?.[0]?.cnt || 0);
    try { await writeAuditLog(req, user, 'videos.upload_session.status', String(sessionId), { candidatesCount: count, status: s.status }); } catch {}
    return NextResponse.json({ success: true, session: s, candidatesCount: count });
  } catch (error) {
    console.error('upload-session status error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
