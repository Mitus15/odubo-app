import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: { jobId: string } }) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { jobId } = ctx.params || ({} as any);
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    const rows = await queryDatabase(
      `SELECT jobId, status, videoId, cfVideoId, errorDetails, updated_at as updatedAt, created_at as createdAt
       FROM job_status WHERE jobId = ? LIMIT 1`,
      [jobId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, status: 'UNKNOWN', error: 'Job not found' }, { status: 404 });
    }

    const row = rows[0];
    return NextResponse.json({ success: true, ...row });
  } catch (error) {
    console.error('[Status Poller] Error fetching job status:', error);
    return NextResponse.json({ error: 'Failed to retrieve job status' }, { status: 500 });
  }
}
