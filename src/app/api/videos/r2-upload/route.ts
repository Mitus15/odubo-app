import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const runtime = 'nodejs';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = process.env.R2_BUCKET || 'odubo';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://media.odubo.studio';

/**
 * POST /api/videos/r2-upload
 *
 * Step 1: Generate presigned URL for direct R2 upload
 * Returns presigned URL that client can use to upload video directly to R2
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json() as { filename: string; contentType?: string };
    const { filename, contentType = 'video/mp4' } = body;

    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    // Generate unique key for R2 with date-based organization
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `videos/source/${year}/${month}/${timestamp}-${sanitized}`;

    // Generate presigned URL for direct upload
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour

    // Calculate public URL
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      success: true,
      uploadUrl: presignedUrl,
      publicUrl,
      key,
    });
  } catch (error: any) {
    console.error('Error generating R2 presigned URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/videos/r2-upload
 *
 * Step 2: After R2 upload completes, copy to Cloudflare Stream for processing
 * Takes the R2 URL and sends it to Cloudflare Stream for ingestion
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json() as { r2Url: string; metadata?: Record<string, string> };
    const { r2Url, metadata = {} } = body;

    if (!r2Url) {
      return NextResponse.json({ error: 'R2 URL required' }, { status: 400 });
    }

    // Send video to Cloudflare Stream for processing
    const stream = new CloudflareStreamAPI();

    // Use copy-from-URL endpoint to ingest video from R2
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
          url: r2Url,
          meta: metadata,
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

    return NextResponse.json({
      success: true,
      uid,
      r2Url,
    });
  } catch (error: any) {
    console.error('Error copying to Cloudflare Stream:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
