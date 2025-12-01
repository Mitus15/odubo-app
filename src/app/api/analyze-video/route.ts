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
    const payload = { jobId, videoId, cfVideoId, userId: (user as any)?.userId || (user as any)?.id };

    // Record job as PENDING in DB for polling/visibility
    await updateJobStatus(jobId, 'PENDING', null, videoId, cfVideoId);

    // Enqueue: placeholder — integrate your queue here (Redis/Cloudflare Queues)
    console.log(`[Analyze Producer] Enqueue requested for job ${jobId}`, payload);

    return NextResponse.json(
      { success: true, status: 'ENQUEUED', jobId, message: 'Clip generation pipeline initiated in the background.' },
      { status: 202 }
    );
  } catch (error) {
    console.error('[Analyze Producer] Error enqueuing job:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
