import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { generateThumbnailForVideo } from '@/worker/generate_video_thumbnail';

export async function POST(req: Request) {
  try {
    // simple secret check to ensure only the worker enqueues jobs
    const secret = req.headers.get('x-thumbnail-secret');
    if (secret !== process.env.THUMBNAIL_JOB_SECRET) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json() as any;
    const r2Key = body.r2Key;
    const galleryId = body.galleryId;
    const uid = body.uid;
    if (!r2Key || !galleryId || !uid) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    // Run thumbnail generation (non-blocking is fine, but we'll run here for simplicity)
    const res = await generateThumbnailForVideo(r2Key, String(galleryId), String(uid));

    if (!res.success) return NextResponse.json({ error: res.error || 'Failed' }, { status: 500 });

    return NextResponse.json({ success: true, thumbnailKey: res.thumbnailKey });
  } catch (e: any) {
    console.error('Thumbnail job error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
