/**
 * POST /api/admin/release/multipart — direct-to-R2 upload for the warehouse.
 *
 * A fresh route rather than a branch inside /api/arsenal/multipart-upload.
 * Arsenal's route forces a .mp4 extension and copies every upload into
 * Cloudflare Stream, both correct for video and both wrong here: a master is
 * a WAV or an AIFF, a session is a zipped Logic project, and neither should
 * be transcoded, renamed, or handed to a video pipeline. The S3 mechanics are
 * the same; the policy is not.
 *
 * Actions: start | get-urls | complete | abort.
 *
 * `start` writes the warehouse_files row immediately at status='uploading'.
 * That row is deliberately visible: a half-finished 800MB upload should show
 * up in the UI as an orphan to sweep, not vanish and leave paid-for parts on
 * R2 with nothing pointing at them.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import {
  FILE_CLASSES,
  FILE_CATEGORIES,
  type FileClass,
  type FileCategory,
} from '@/lib/release/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const s3 = new S3Client({
  region: 'auto',
  endpoint:
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    process.env.R2_ENDPOINT ||
    `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey:
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_ACCESS_KEY ||
      '',
  },
});

const R2_BUCKET =
  process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET || 'odubo-studio-media';

/** Presigned part URLs live an hour — long enough for a slow 50MB part. */
const PART_URL_TTL = 3600;

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const body = (await req.json()) as Record<string, unknown>;
    switch (body.action) {
      case 'start':
        return await handleStart(body);
      case 'get-urls':
        return await handleGetUrls(body);
      case 'complete':
        return await handleComplete(body);
      case 'abort':
        return await handleAbort(body);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Warehouse multipart error:', error);
    return NextResponse.json(
      { error: (error as Error)?.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * Keep the real extension. Arsenal renames everything to .mp4 because
 * PostForMe demands it; here the extension is load-bearing in the other
 * direction — canPlayAudioFormat() reads it off the URL to decide whether the
 * browser can play a shipped master at all.
 */
function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const hasExt = lastDot > 0 && lastDot < filename.length - 1;
  const base = (hasExt ? filename.slice(0, lastDot) : filename)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120);
  const ext = hasExt
    ? filename.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
  return ext ? `${base || 'file'}.${ext}` : base || 'file';
}

function isClass(v: unknown): v is FileClass {
  return typeof v === 'string' && (FILE_CLASSES as readonly string[]).includes(v);
}
function isCategory(v: unknown): v is FileCategory {
  return typeof v === 'string' && (FILE_CATEGORIES as readonly string[]).includes(v);
}

async function handleStart(body: Record<string, unknown>) {
  const filename = body.filename as string;
  const contentType = (body.contentType as string) || 'application/octet-stream';
  const projectId = body.projectId as string;
  const pieceId = (body.pieceId as string) || null;
  const fileClass = body.class;
  const category = body.category;
  const size = Number(body.size) || 0;

  if (!filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  if (!isClass(fileClass)) {
    return NextResponse.json(
      { error: `class must be one of ${FILE_CLASSES.join(', ')}` },
      { status: 400 }
    );
  }
  if (!isCategory(category)) {
    return NextResponse.json(
      { error: `category must be one of ${FILE_CATEGORIES.join(', ')}` },
      { status: 400 }
    );
  }

  // The project must exist — otherwise a typo'd id silently creates orphan
  // rows the UI can never surface.
  const project = await queryDatabase('SELECT id FROM warehouse_projects WHERE id = ?', [
    projectId,
  ]);
  if (!project?.length) {
    return NextResponse.json({ error: 'Unknown project' }, { status: 404 });
  }
  if (pieceId) {
    const piece = await queryDatabase(
      'SELECT id FROM warehouse_pieces WHERE id = ? AND project_id = ?',
      [pieceId, projectId]
    );
    if (!piece?.length) {
      return NextResponse.json(
        { error: 'Unknown piece for this project' },
        { status: 404 }
      );
    }
  }

  const sanitized = sanitizeFilename(filename);
  const key = `warehouse/${projectId}/${fileClass}/${category}/${Date.now()}-${sanitized}`;

  const response = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    })
  );
  if (!response.UploadId) {
    throw new Error('R2 did not return an UploadId');
  }

  const fileId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO warehouse_files
       (id, project_id, piece_id, class, category, r2_key, original_filename,
        mime_type, size_bytes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading')`,
    [fileId, projectId, pieceId, fileClass, category, key, filename, contentType, size]
  );

  return NextResponse.json({ success: true, uploadId: response.UploadId, key, fileId });
}

async function handleGetUrls(body: Record<string, unknown>) {
  const uploadId = body.uploadId as string;
  const key = body.key as string;
  const parts = Number(body.parts);

  if (!uploadId || !key || !parts) {
    return NextResponse.json(
      { error: 'uploadId, key and parts are required' },
      { status: 400 }
    );
  }
  if (!key.startsWith('warehouse/')) {
    return NextResponse.json({ error: 'key outside the warehouse prefix' }, { status: 400 });
  }

  const urls = await Promise.all(
    Array.from({ length: parts }, (_, i) =>
      getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: R2_BUCKET,
          Key: key,
          UploadId: uploadId,
          PartNumber: i + 1,
        }),
        { expiresIn: PART_URL_TTL }
      )
    )
  );

  return NextResponse.json({ success: true, urls });
}

async function handleComplete(body: Record<string, unknown>) {
  const uploadId = body.uploadId as string;
  const key = body.key as string;
  const parts = body.parts as Array<{ PartNumber: number; ETag: string }>;
  /** Measured in the browser at upload time — see readAudioDuration(). */
  const durationSeconds = body.durationSeconds != null ? Number(body.durationSeconds) : null;

  if (!uploadId || !key || !Array.isArray(parts) || parts.length === 0) {
    return NextResponse.json(
      { error: 'uploadId, key and parts are required' },
      { status: 400 }
    );
  }

  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .slice()
          .sort((a, b) => a.PartNumber - b.PartNumber)
          .map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })),
      },
    })
  );

  await executeQuery(`UPDATE warehouse_files SET status = 'ready' WHERE r2_key = ?`, [key]);

  const rows = await queryDatabase(
    `SELECT id, project_id, piece_id, class, category, r2_key, original_filename,
            mime_type, size_bytes, status, uploaded_at
       FROM warehouse_files WHERE r2_key = ?`,
    [key]
  );

  return NextResponse.json({
    success: true,
    file: rows?.[0] ?? null,
    durationSeconds:
      durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds
        : null,
  });
}

async function handleAbort(body: Record<string, unknown>) {
  const uploadId = body.uploadId as string;
  const key = body.key as string;

  if (!uploadId || !key) {
    return NextResponse.json({ error: 'uploadId and key are required' }, { status: 400 });
  }

  // Drop the R2 parts first; if that fails we still want the row gone so the
  // UI does not show a file that will never arrive.
  try {
    await s3.send(
      new AbortMultipartUploadCommand({ Bucket: R2_BUCKET, Key: key, UploadId: uploadId })
    );
  } catch (err) {
    console.error('R2 abort failed (removing the row anyway):', err);
  }

  await executeQuery(`DELETE FROM warehouse_files WHERE r2_key = ? AND status = 'uploading'`, [
    key,
  ]);

  return NextResponse.json({ success: true });
}
