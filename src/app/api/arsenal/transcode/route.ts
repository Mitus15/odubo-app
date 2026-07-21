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
import { verifyUserFromRequest } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

/**
 * POST /api/arsenal/transcode
 * Create a new transcoding job for a video
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json();
    const { video_id } = body;

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
    }

    // Get video details
    const videos = await queryDatabase(
      'SELECT id, title, mp4_url, uid FROM videos WHERE id = ?',
      [video_id]
    ) as { id: number; title: string; mp4_url: string; uid: string }[];

    const video = videos[0];

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!video.mp4_url) {
      return NextResponse.json({ error: 'Video has no source URL' }, { status: 400 });
    }

    console.log('[Transcode] Creating job for video:', { video_id, title: video.title, source_url: video.mp4_url });

    // Create transcoding job record
    await queryDatabase(`
      INSERT INTO transcoding_jobs (
        video_id, status, progress, source_url, started_at
      ) VALUES (?, 'queued', 0, ?, CURRENT_TIMESTAMP)
    `, [video_id, video.mp4_url]);

    // Get the job id
    const jobs = await queryDatabase(
      'SELECT last_insert_rowid() as job_id',
      []
    ) as { job_id: number }[];

    const job_id = jobs[0]?.job_id;

    console.log('[Transcode] Created job:', { job_id, video_id });

    // Update video with job reference
    await queryDatabase(
      'UPDATE videos SET transcoding_job_id = ? WHERE id = ?',
      [job_id, video_id]
    );

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
