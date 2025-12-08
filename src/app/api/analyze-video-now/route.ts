import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { updateJobStatus } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body: any = await req.json().catch(() => ({}));
    const videoId = body.videoId as number | undefined;
    const cfVideoId = body.cfVideoId as string | undefined;
    if (!cfVideoId || !videoId) {
      return NextResponse.json({ error: 'Missing videoId or cfVideoId' }, { status: 400 });
    }

    const jobId = crypto.randomUUID();
    
    console.log(`[Analyze Queue] Queuing job ${jobId} for video ${videoId}`);

    // Insert job as PENDING for the worker to pick up
    await updateJobStatus(jobId, 'PENDING', null, videoId, cfVideoId);

    return NextResponse.json(
      { success: true, status: 'PENDING', jobId, message: 'Analysis queued.' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Analyze Queue] Error queuing job:', error);
    return NextResponse.json({ error: error?.message || 'Failed to queue request' }, { status: 500 });
  }
}
