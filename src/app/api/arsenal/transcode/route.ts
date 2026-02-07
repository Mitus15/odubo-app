/**
 * Arsenal Transcoding Job Creation Endpoint
 *
 * Creates transcoding job records in database.
 * Actual processing is handled by Railway background worker.
 *
 * Flow:
 * 1. Validate video exists and has source URL
 * 2. Create transcoding_job record (status: queued)
 * 3. Railway worker polls database and processes job
 * 4. UI polls /api/arsenal/transcode/[job_id] for progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * POST /api/arsenal/transcode
 * Create a new transcoding job for a video
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json();
    const { video_id } = body;

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
    }

    const db = await getDb();

    // Get video details
    const video = await db.prepare('SELECT id, title, mp4_url, uid FROM videos WHERE id = ?').bind(video_id).first<{
      id: number;
      title: string;
      mp4_url: string;
      uid: string;
    }>();

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!video.mp4_url) {
      return NextResponse.json({ error: 'Video has no source URL' }, { status: 400 });
    }

    console.log('[Transcode] Creating job for video:', { video_id, title: video.title, source_url: video.mp4_url });

    // Create transcoding job record
    const jobResult = await db.prepare(`
      INSERT INTO transcoding_jobs (
        video_id, status, progress, source_url, started_at
      ) VALUES (?, 'queued', 0, ?, CURRENT_TIMESTAMP)
    `).bind(video_id, video.mp4_url).run();

    const job_id = jobResult.meta.last_row_id;

    console.log('[Transcode] Created job:', { job_id, video_id });

    // Update video with job reference
    await db.prepare('UPDATE videos SET transcoding_job_id = ? WHERE id = ?').bind(job_id, video_id).run();

    // Railway worker will pick up this job and process it
    console.log('[Transcode] Job queued for Railway worker');

    return NextResponse.json({
      success: true,
      job_id,
      video_id,
      status: 'queued',
      message: 'Transcoding job queued. Railway worker will process it. Poll /api/arsenal/transcode/[job_id] for progress.',
    });
  } catch (error: any) {
    console.error('[Transcode] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to start transcoding', details: error.message },
      { status: 500 }
    );
  }
}
