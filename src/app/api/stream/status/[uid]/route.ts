import { NextRequest, NextResponse } from 'next/server';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const { uid } = params;
    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    const stream = new CloudflareStreamAPI();
    const details = await stream.getVideo(uid);
    const result = details?.result || {};
    return NextResponse.json({
      uid,
      status: result?.status?.state || 'unknown',
      pctComplete: result?.status?.pctComplete || '0',
      readyToStream: !!result?.readyToStream,
      duration: result?.duration || 0,
      playback: result?.playback || null,
      thumbnail: result?.thumbnail || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch stream status' }, { status: 500 });
  }
}
