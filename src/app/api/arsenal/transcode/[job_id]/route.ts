/**
 * Transcoding Job Status Endpoint
 *
 * GET /api/arsenal/transcode/[job_id]
 * Returns real-time progress for a transcoding job
 *
 * Response format:
 * {
 *   job_id: number,
 *   video_id: number,
 *   status: 'queued' | 'analyzing' | 'transcoding' | 'complete' | 'failed',
 *   progress: 0-100,
 *   source_url: string,
 *   output_url: string | null,
 *   duration_seconds: number | null,
 *   source_size: number | null,
 *   output_size: number | null,
 *   error_message: string | null,
 *   started_at: string,
 *   completed_at: string | null,
 *   created_at: string,
 *   updated_at: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { job_id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const job_id = parseInt(params.job_id);

    if (isNaN(job_id)) {
      return NextResponse.json({ error: 'Invalid job_id' }, { status: 400 });
    }

    // Get job status
    const jobs = await queryDatabase(`
      SELECT
        id as job_id,
        video_id,
        status,
        progress,
        source_url,
        output_url,
        source_format,
        target_format,
        source_size,
        output_size,
        duration_seconds,
        codec_info,
        error_message,
        retry_count,
        started_at,
        completed_at,
        created_at,
        updated_at
      FROM transcoding_jobs
      WHERE id = ?
    `, [job_id]) as any[];

    const job = jobs[0];

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error: any) {
    console.error('[Transcode Status] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get job status', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/arsenal/transcode/[job_id]
 * Cancel a running transcoding job
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { job_id: string } }
) {
  try {
    // Verify admin authentication
    const user = await verifyUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const job_id = parseInt(params.job_id);

    if (isNaN(job_id)) {
      return NextResponse.json({ error: 'Invalid job_id' }, { status: 400 });
    }

    // Update job status to failed
    await queryDatabase(`
      UPDATE transcoding_jobs
      SET status = 'failed', error_message = 'Cancelled by user', completed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status NOT IN ('complete', 'failed')
    `, [job_id]);

    return NextResponse.json({ success: true, message: 'Job cancelled' });
  } catch (error: any) {
    console.error('[Transcode Status] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job', details: error.message },
      { status: 500 }
    );
  }
}
