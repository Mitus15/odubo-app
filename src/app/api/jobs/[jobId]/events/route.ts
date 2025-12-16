import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { jobId } = params;
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  try {
    const rows = await queryDatabase(
      `SELECT step, message, created_at FROM job_status_events WHERE jobId = ? ORDER BY created_at ASC`,
      [jobId]
    );
    return NextResponse.json({ events: rows || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch events' }, { status: 500 });
  }
}
