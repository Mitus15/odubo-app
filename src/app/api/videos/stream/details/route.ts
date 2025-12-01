import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return NextResponse.json({ error: 'UID is required' }, { status: 400 });
  }

  try {
    const stream = new CloudflareStreamAPI();
    const details = await stream.getVideo(uid);

    if (!details.success) {
      return NextResponse.json({ error: 'Video not found in Stream' }, { status: 404 });
    }

    const result = details.result;
    
    return NextResponse.json({
      success: true,
      video: {
        uid: result.uid,
        title: result.meta?.name || result.meta?.title || 'Untitled Video',
        duration: result.duration,
        width: result.input.width,
        height: result.input.height,
        thumbnail: result.thumbnail,
        preview: result.preview,
        hls: result.playback.hls,
        dash: result.playback.dash,
        ready: result.readyToStream,
        status: result.status.state
      }
    });

  } catch (error: any) {
    console.error('Error fetching stream details:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch details' }, { status: 500 });
  }
}
