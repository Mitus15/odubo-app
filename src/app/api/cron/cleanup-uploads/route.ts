import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import {
  S3Client,
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const s3 = new S3Client({
  region: 'auto',
  endpoint:
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    process.env.R2_ENDPOINT ||
    `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET || 'odubo-studio-media';

// Stale threshold: 24 hours
const STALE_HOURS = 24;

/**
 * GET /api/cron/cleanup-uploads
 * Daily cron to clean up:
 * 1. Stale video_upload_sessions (incomplete for > 24 hours)
 * 2. Orphaned R2 multipart uploads (incomplete for > 24 hours)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      staleSessions: { cleaned: 0, failed: 0 },
      orphanedUploads: { aborted: 0, failed: 0 },
      expiredGalleries: { marked: 0, deleted: 0, failed: 0 },
    };

    // 1. Clean up stale upload sessions
    try {
      const staleSessions = await queryDatabase(
        `SELECT id, uid, status, created_at
         FROM video_upload_sessions
         WHERE status NOT IN ('done', 'aborted')
           AND created_at < datetime('now', '-${STALE_HOURS} hours')
         LIMIT 50`,
        []
      ) as Array<{ id: number; uid: string; status: string; created_at: string }>;

      for (const session of staleSessions) {
        try {
          await executeQuery(
            `UPDATE video_upload_sessions SET status = 'aborted', updated_at = datetime('now') WHERE id = ?`,
            [session.id]
          );
          results.staleSessions.cleaned++;
        } catch (err) {
          console.error(`[Cleanup] Failed to abort session ${session.id}:`, err);
          results.staleSessions.failed++;
        }
      }

      if (staleSessions.length > 0) {
        console.log(`[Cleanup] Cleaned ${results.staleSessions.cleaned} stale upload sessions`);
      }
    } catch (err) {
      console.error('[Cleanup] Failed to query stale sessions:', err);
    }

    // 2. Abort orphaned R2 multipart uploads
    try {
      const listCommand = new ListMultipartUploadsCommand({ Bucket: R2_BUCKET });
      const listResult = await s3.send(listCommand);
      const uploads = listResult.Uploads || [];

      const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

      for (const upload of uploads) {
        if (upload.Initiated && upload.Initiated < cutoff && upload.Key && upload.UploadId) {
          try {
            await s3.send(
              new AbortMultipartUploadCommand({
                Bucket: R2_BUCKET,
                Key: upload.Key,
                UploadId: upload.UploadId,
              })
            );
            results.orphanedUploads.aborted++;
          } catch (err) {
            console.error(`[Cleanup] Failed to abort multipart upload ${upload.UploadId}:`, err);
            results.orphanedUploads.failed++;
          }
        }
      }

      if (results.orphanedUploads.aborted > 0) {
        console.log(`[Cleanup] Aborted ${results.orphanedUploads.aborted} orphaned R2 multipart uploads`);
      }
    } catch (err) {
      console.error('[Cleanup] Failed to list/abort multipart uploads:', err);
    }

    // 3. Handle expired galleries (retention policy)
    try {
      // Galleries that have passed their expires_at and are not marked permanent
      const expiredGalleries = await queryDatabase(
        `SELECT id, title, expires_at
         FROM galleries
         WHERE expires_at IS NOT NULL
           AND expires_at < datetime('now')
           AND (is_permanent IS NULL OR is_permanent = 0)
           AND deleted_at IS NULL
         LIMIT 50`,
        []
      ) as Array<{ id: number; title: string; expires_at: string }>;

      for (const gallery of expiredGalleries) {
        try {
          // Soft delete: mark as deleted
          await executeQuery(
            `UPDATE galleries SET deleted_at = datetime('now') WHERE id = ?`,
            [gallery.id]
          );
          results.expiredGalleries.marked++;
        } catch (err) {
          console.error(`[Cleanup] Failed to mark gallery ${gallery.id} as deleted:`, err);
          results.expiredGalleries.failed++;
        }
      }

      if (expiredGalleries.length > 0) {
        console.log(`[Cleanup] Marked ${results.expiredGalleries.marked} expired galleries for deletion`);
      }
    } catch (err) {
      console.error('[Cleanup] Failed to process expired galleries:', err);
    }

    console.log('[Cleanup] Cron completed:', results);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cleanup] Cron error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
