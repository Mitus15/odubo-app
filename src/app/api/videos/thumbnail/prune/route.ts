import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

/**
 * Prune video thumbnail candidates.
 * - Mode A: TTL (default) — delete candidates older than N days (default 14)
 * - Mode B: By session — delete all candidates for a given sessionId
 */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({})) as { sessionId?: number; ttlDays?: number };
    const { sessionId } = body;
    const ttlDays = Math.max(1, Math.min(90, Number(body.ttlDays ?? 14)));

    let deleted = 0;
    if (sessionId) {
      const res = await executeQuery(`DELETE FROM videos_thumbnail_candidates WHERE session_id = ?`, [sessionId]) as any;
      deleted = res?.result?.[0]?.meta?.rows_written ?? 0;
    } else {
      const res = await executeQuery(
        `DELETE FROM videos_thumbnail_candidates WHERE datetime(created_at) <= datetime('now', ?)`,
        [`-${ttlDays} days`]
      ) as any;
      deleted = res?.result?.[0]?.meta?.rows_written ?? 0;
    }

    await writeAuditLog(req, user, 'videos.thumbnail.prune', sessionId ? String(sessionId) : `ttl:${ttlDays}`, { deleted });
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('thumbnail prune error:', error);
    return NextResponse.json({ error: 'Failed to prune candidates' }, { status: 500 });
  }
}
