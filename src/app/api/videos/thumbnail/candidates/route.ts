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

    const list = await queryDatabase(
      `SELECT id, url, pct, ai_score, rank, rationale FROM videos_thumbnail_candidates WHERE session_id = ? ORDER BY rank ASC LIMIT 3`,
      [sessionId]
    );
    try { await writeAuditLog(req, user, 'videos.thumbnail.candidates', String(sessionId), { count: list.length }); } catch {}
    return NextResponse.json({ success: true, candidates: list });
  } catch (error) {
    console.error('thumbnail candidates error:', error);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
