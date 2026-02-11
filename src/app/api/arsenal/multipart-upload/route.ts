import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET || 'odubo-studio-media';
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || 'https://media.odubo.studio';

/**
 * POST /api/arsenal/multipart-upload
 *
 * Handles multipart upload to R2 in three stages:
 * 1. action=start: Initiate multipart upload
 * 2. action=get-urls: Get presigned URLs for parts
 * 3. action=complete: Complete upload and copy to Stream
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
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
  } catch (error: any) {
    console.error('Multipart upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * Start multipart upload
 */
async function handleStart(body: { filename: string; contentType: string }) {
  const { filename, contentType } = body;

  if (!filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 });
  }

  // Generate unique key for R2
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();

  // Force .mp4 extension for compatibility with PostForMe
  // Remove original extension and sanitize
  const baseFilename = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9.-]/g, '_');
  const sanitized = `${baseFilename}.mp4`;
  const key = `videos/source/${year}/${month}/${timestamp}-${sanitized}`;

  // Initiate multipart upload
  // Always use video/mp4 content-type regardless of input format
  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: 'video/mp4',
  });

  const response = await s3.send(command);

  if (!response.UploadId) {
    throw new Error('Failed to initiate multipart upload');
  }

  return NextResponse.json({
    success: true,
    uploadId: response.UploadId,
    key,
  });
}

/**
 * Get presigned URLs for upload parts
 */
async function handleGetUrls(body: {
  uploadId: string;
  key: string;
  parts: number;
}) {
  const { uploadId, key, parts } = body;

  if (!uploadId || !key || !parts) {
    return NextResponse.json(
      { error: 'uploadId, key, and parts are required' },
      { status: 400 }
    );
  }

  // Generate presigned URLs for each part
  const urls: string[] = [];
  for (let partNumber = 1; partNumber <= parts; partNumber++) {
    const command = new UploadPartCommand({
      Bucket: R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    urls.push(url);
  }

  return NextResponse.json({
    success: true,
    urls,
  });
}

/**
 * Complete multipart upload and copy to Stream
 */
async function handleComplete(body: {
  uploadId: string;
  key: string;
  parts: Array<{ PartNumber: number; ETag: string }>;
  filename: string;
  source_format?: string;
}) {
  const { uploadId, key, parts, filename, source_format } = body;

  if (!uploadId || !key || !parts || !parts.length) {
    return NextResponse.json(
      { error: 'uploadId, key, and parts are required' },
      { status: 400 }
    );
  }

  // Complete multipart upload
  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await s3.send(command);

  // Calculate public URL
  const mp4_url = `${R2_PUBLIC_URL}/${key}`;

  // Copy to Cloudflare Stream for processing
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  const streamResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: mp4_url,
        meta: {
          name: filename,
        },
        requireSignedURLs: false,
      }),
    }
  );

  if (!streamResponse.ok) {
    const error = await streamResponse.json();
    console.error('Cloudflare Stream copy failed:', error);
    throw new Error(error.errors?.[0]?.message || 'Failed to copy to Stream');
  }

  const streamData = await streamResponse.json();
  const uid = streamData.result?.uid;

  if (!uid) {
    throw new Error('No UID returned from Cloudflare Stream');
  }

  // Try to enable downloads quickly - if Stream is already ready, this will work fast
  // If not ready yet, background job will handle it
  console.log('[Arsenal Upload] Checking if Stream video is ready for downloads...');

  let streamMp4Url = mp4_url; // Start with R2 URL as fallback

  try {
    // Check Stream video status first
    const statusResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      }
    );

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      const streamState = statusData.result?.status?.state;

      if (streamState === 'ready') {
        // Video is already transcoded! Try to enable downloads immediately
        console.log('[Arsenal Upload] Stream video ready, enabling downloads...');

        await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: 'default' }),
          }
        );

        // Quick poll - max 30 seconds
        for (let i = 0; i < 6; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000));

          const downloadResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`,
            { headers: { 'Authorization': `Bearer ${apiToken}` } }
          );

          if (downloadResponse.ok) {
            const downloadData = await downloadResponse.json();
            if (downloadData.result?.default?.status === 'ready' && downloadData.result?.default?.url) {
              streamMp4Url = downloadData.result.default.url;
              console.log('[Arsenal Upload] ✅ Stream MP4 ready immediately:', streamMp4Url);
              break;
            }
          }
        }
      } else {
        console.log(`[Arsenal Upload] Stream video still transcoding (state: ${streamState}). Background job will update later.`);
      }
    }
  } catch (error) {
    // Don't fail upload if download generation fails - background job will retry
    console.log('[Arsenal Upload] Could not enable downloads immediately, background job will handle it:', error);
  }

  // Trigger background processing job (fire and forget)
  fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/arsenal/process-stream-downloads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': req.headers.get('cookie') || '', // Forward auth
    },
  }).catch(() => {
    // Ignore errors - job runs on schedule anyway
  });

  return NextResponse.json({
    success: true,
    uid,
    mp4_url: streamMp4Url, // Use Stream MP4 URL if available, otherwise R2 URL
    key,
    source_format,
  });
}

/**
 * Abort multipart upload
 */
async function handleAbort(body: { uploadId: string; key: string }) {
  const { uploadId, key } = body;

  if (!uploadId || !key) {
    return NextResponse.json(
      { error: 'uploadId and key are required' },
      { status: 400 }
    );
  }

  const command = new AbortMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: key,
    UploadId: uploadId,
  });

  await s3.send(command);

  return NextResponse.json({ success: true });
}
