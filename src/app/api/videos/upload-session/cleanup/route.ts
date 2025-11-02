import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

/**
 * Cleanup stale video upload sessions.
 * - Marks sessions older than 24h and not done/aborted as 'aborted'
 * - Optionally prune finished/aborted sessions older than 7 days
 */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });

  try {
    // Count candidates per session for reporting
    const stale = await queryDatabase(
      `SELECT s.id, s.uid, s.status, s.created_at, s.updated_at,
              (SELECT COUNT(1) FROM videos_thumbnail_candidates c WHERE c.session_id = s.id) AS candidates
         FROM video_upload_sessions s
        WHERE s.status NOT IN ('done','aborted')
          AND datetime(s.created_at) <= datetime('now', '-24 hours')`
    );

    let aborted = 0;
    if (stale.length) {
      const ids = stale.map((r: any) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      await executeQuery(
        `UPDATE video_upload_sessions SET status = 'aborted', updated_at = datetime('now') WHERE id IN (${placeholders})`,
        ids
      );
      aborted = ids.length;
    }

    // Hard prune very old sessions (done or aborted) beyond 7 days to keep table small
    const pruned = await executeQuery(
      `DELETE FROM video_upload_sessions WHERE datetime(created_at) <= datetime('now', '-7 days') AND status IN ('done','aborted')`
    ) as any;
    const prunedCount = pruned?.result?.[0]?.meta?.rows_written ?? 0;

    await writeAuditLog(req, user, 'videos.upload_session.cleanup', 'video_upload_sessions', {
      aborted,
      pruned: prunedCount,
      staleChecked: stale.length,
    });

    return NextResponse.json({ success: true, aborted, pruned: prunedCount, stale });
  } catch (error) {
    console.error('upload-session cleanup error:', error);
    return NextResponse.json({ error: 'Failed to cleanup sessions' }, { status: 500 });
  }
}
