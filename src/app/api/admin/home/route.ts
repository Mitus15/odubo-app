import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { readHome } from '@/lib/admin/home';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * GET /api/admin/home?since=<ISO>&until=<ISO>
 * The admin home's facts (lib/admin/home): today's posts and one fact per job.
 * `since` and `until` are the start and end of his day on his phone's clock.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const q = new URL(request.url).searchParams;
  const since = q.get('since') || '';
  const until = q.get('until') || '';
  if (!ISO.test(since) || !ISO.test(until)) {
    return NextResponse.json({ error: 'since and until must be ISO times (toISOString)' }, { status: 400 });
  }

  return NextResponse.json(await readHome({ since, until }), { headers: { 'Cache-Control': 'private, no-store' } });
}
