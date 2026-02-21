import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
const CUSTOMER_SUBDOMAIN = 'customer-tpkm273r1u0s40no';

// Alert if video stuck processing for more than 60 minutes
const MAX_PROCESSING_TIME_MS = 60 * 60 * 1000;
// Give up after 8 hours and mark as failed (large films can take 2-3+ hours on Stream)
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

interface Video {
  id: number;
  uid: string;
  title: string;
  mp4_url: string | null;
  mp4_processing_status: string | null;
  mp4_processing_started_at: string | null;
  mp4_processing_retry_count: number;
}

/**
 * POST /api/arsenal/process-stream-downloads
 *
 * Background job to enable Stream MP4 downloads for videos
 * that don't have proper download URLs yet.
 *
 * This runs asynchronously after upload completes.
 */
export async function POST(req: NextRequest) {
  try {
    // Allow cron services to trigger this with a secret token
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      // Valid cron request - proceed
      console.log('[Process Stream Downloads] Triggered by cron service');
    } else {
      // Require admin authentication
      const user = getUserFromRequest(req);
      if (!isAdminUser(user)) {
        return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
      }
    }

    console.log('[Process Stream Downloads] Starting job...');

    // Check for stuck videos (processing > 30 minutes)
    const stuckVideos = await queryDatabase(
      `SELECT id, title, mp4_processing_started_at
       FROM videos
       WHERE mp4_processing_status = 'processing'
         AND mp4_processing_started_at IS NOT NULL
         AND (julianday('now') - julianday(mp4_processing_started_at)) * 86400000 > ?
       ORDER BY mp4_processing_started_at ASC`,
      [MAX_PROCESSING_TIME_MS]
    ) as Array<{ id: number; title: string; mp4_processing_started_at: string }>;

    if (stuckVideos.length > 0) {
      console.warn(`[Process Stream Downloads] ⚠️ ${stuckVideos.length} videos stuck processing > 30 minutes:`);
      stuckVideos.forEach(v => {
        const elapsed = Date.now() - new Date(v.mp4_processing_started_at).getTime();
        console.warn(`  - Video ${v.id}: ${v.title} (${Math.round(elapsed / 60000)} minutes)`);
      });
    }

    // Mark timed-out videos as failed (> 2 hours)
    await executeQuery(
      `UPDATE videos
       SET mp4_processing_status = 'failed',
           mp4_processing_error = 'Timeout: Stream transcoding took > 2 hours'
       WHERE mp4_processing_status = 'processing'
         AND mp4_processing_started_at IS NOT NULL
         AND (julianday('now') - julianday(mp4_processing_started_at)) * 86400000 > ?`,
      [ABSOLUTE_TIMEOUT_MS]
    );

    // Find videos that need MP4 download URLs
    const videos = await queryDatabase(
      `SELECT
         id, uid, title, mp4_url,
         mp4_processing_status,
         mp4_processing_started_at,
         mp4_processing_retry_count
       FROM videos
       WHERE uid IS NOT NULL
         AND mp4_processing_status IN ('pending', 'processing')
       ORDER BY
         CASE mp4_processing_status
           WHEN 'pending' THEN 0
           WHEN 'processing' THEN 1
         END,
         created_at DESC
       LIMIT 10`, // Process 10 at a time
      []
    ) as Video[];

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No videos need processing',
        processed: 0,
      });
    }

    console.log(`[Process Stream Downloads] Found ${videos.length} videos to process`);

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const video of videos) {
      try {
        const retryCount = video.mp4_processing_retry_count || 0;
        const elapsed = video.mp4_processing_started_at
          ? Math.round((Date.now() - new Date(video.mp4_processing_started_at).getTime()) / 60000)
          : 0;

        console.log(`[Process Stream Downloads] Processing video ${video.id}: ${video.title} (retry ${retryCount}, ${elapsed}m)`);

        // Mark as processing if not already
        if (video.mp4_processing_status !== 'processing') {
          await executeQuery(
            `UPDATE videos
             SET mp4_processing_status = 'processing',
                 mp4_processing_started_at = datetime('now')
             WHERE id = ?`,
            [video.id]
          );
        }

        // Update last checked timestamp and retry count
        await executeQuery(
          `UPDATE videos
           SET mp4_processing_last_checked_at = datetime('now'),
               mp4_processing_retry_count = ?
           WHERE id = ?`,
          [retryCount + 1, video.id]
        );

        // Check if Stream video is ready
        const streamResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${video.uid}`,
          {
            headers: { Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` }
          }
        );

        if (!streamResponse.ok) {
          throw new Error('Failed to fetch Stream video info');
        }

        const streamData = await streamResponse.json() as any;
        const status = streamData.result?.status?.state;

        if (status !== 'ready') {
          console.log(`[Process Stream Downloads] Video ${video.id} still transcoding (status: ${status})`);
          continue; // Skip, will be picked up next time
        }

        if (status === 'error') {
          throw new Error(`Stream video in error state: ${streamData.result?.status?.errorReasonText || 'Unknown'}`);
        }

        // Enable MP4 downloads
        const enableResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${video.uid}/downloads`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: 'default' }),
          }
        );

        if (!enableResponse.ok) {
          const errorData = await enableResponse.json();
          // If downloads already exist, that's fine
          if (!errorData.errors?.[0]?.message?.includes('already exists')) {
            throw new Error(`Failed to enable downloads: ${JSON.stringify(errorData)}`);
          }
        }

        // Poll for download URL (shorter timeout since video is already ready)
        let downloadUrl: string | null = null;
        for (let i = 0; i < 12; i++) { // 1 minute max
          await new Promise(resolve => setTimeout(resolve, 5000));

          const downloadResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${video.uid}/downloads`,
            {
              headers: { Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` }
            }
          );

          if (downloadResponse.ok) {
            const downloadData = await downloadResponse.json() as any;
            if (downloadData.result?.default?.status === 'ready') {
              downloadUrl = downloadData.result.default.url;
              break;
            }
          }
        }

        if (!downloadUrl) {
          throw new Error('Timeout waiting for download URL');
        }

        // Update database with success
        await executeQuery(
          `UPDATE videos
           SET mp4_url = ?,
               mp4_processing_status = 'ready',
               mp4_processing_error = NULL,
               updated_at = datetime('now')
           WHERE id = ?`,
          [downloadUrl, video.id]
        );

        console.log(`[Process Stream Downloads] ✅ Updated video ${video.id}: ${downloadUrl}`);
        succeeded++;

      } catch (error: any) {
        console.error(`[Process Stream Downloads] ❌ Failed video ${video.id}:`, error.message);

        // Update error status
        await executeQuery(
          `UPDATE videos
           SET mp4_processing_status = 'failed',
               mp4_processing_error = ?
           WHERE id = ?`,
          [error.message, video.id]
        );

        failed++;
        errors.push(`Video ${video.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${videos.length} videos`,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[Process Stream Downloads] Job failed:', error);

    return NextResponse.json(
      { error: error.message || 'Job failed' },
      { status: 500 }
    );
  }
}
