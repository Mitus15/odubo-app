
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });

    const rows = await queryDatabase(
      `SELECT jobId, status, errorDetails, updated_at FROM job_status WHERE jobId = ?`,
      [jobId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ job: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
