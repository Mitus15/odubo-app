import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Increase body size limit for video uploads (100MB)
export const maxDuration = 300; // 5 minutes

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = process.env.R2_BUCKET || 'odubo-studio-media';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://media.odubo.studio';

/**
 * POST /api/arsenal/upload
 *
 * Server-side upload proxy to avoid CORS issues with R2 presigned URLs.
 *
 * Flow:
 * 1. Receive video file from browser
 * 2. Upload to R2, get public mp4_url
 * 3. Copy R2 URL to Cloudflare Stream for processing
 * 4. Return uid + mp4_url to browser for DB record creation
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const filename = formData.get('filename') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate unique key for R2 with date-based organization
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    const sanitized = (filename || file.name).replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `videos/source/${year}/${month}/${timestamp}-${sanitized}`;

    // Convert File to Buffer for R2 upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'video/mp4',
    });

    await s3.send(putCommand);

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
            name: filename || file.name,
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

    return NextResponse.json({
      success: true,
      uid,
      mp4_url,
      key,
    });
  } catch (error: any) {
    console.error('Arsenal upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
