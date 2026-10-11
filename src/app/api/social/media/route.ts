import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { isStreamUrl, resolveStreamDownload } from '@/lib/social/streamDownload';

export const dynamic = 'force-dynamic';

/**
 * GET /api/social/media?src=<Stream download URL>
 * The signed link a browser can fetch the video from (see lib/social/streamDownload).
 * Admin only, like all of /api/social.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const src = new URL(request.url).searchParams.get('src') || '';
  if (!isStreamUrl(src)) {
    return NextResponse.json({ error: 'Only Cloudflare Stream links' }, { status: 400 });
  }
  try {
    return NextResponse.json({ url: await resolveStreamDownload(src) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
