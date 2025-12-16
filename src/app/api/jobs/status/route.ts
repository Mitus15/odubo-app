import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

// Returns latest job for a given videoId
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });
  try {
    const rows = await queryDatabase(
      `SELECT jobId, status, errorDetails, updated_at FROM job_status WHERE videoId = ? ORDER BY updated_at DESC LIMIT 1`,
      [Number(videoId)]
    );
    return NextResponse.json({ job: rows && rows.length ? rows[0] : null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch latest job' }, { status: 500 });
  }
}
