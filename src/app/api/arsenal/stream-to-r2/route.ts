import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';

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
 * POST /api/arsenal/stream-to-r2
 *
 * After uploading to Cloudflare Stream via TUS, copy the video to R2
 * to get a direct mp4_url for PostForMe deployment.
 *
 * Flow:
 * 1. Client uploads file to Stream via TUS (gets uid)
 * 2. Client calls this endpoint with uid
 * 3. Server downloads from Stream, uploads to R2
 * 4. Returns mp4_url
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json() as { uid: string; filename?: string };
    const { uid, filename } = body;

    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    // Download video from Cloudflare Stream
    const streamDownloadUrl = `https://videodelivery.net/${uid}/downloads/default.mp4`;
    const videoResponse = await fetch(streamDownloadUrl);

    if (!videoResponse.ok) {
      throw new Error(`Failed to download from Stream: ${videoResponse.statusText}`);
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // Generate unique key for R2
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();

    // Force .mp4 extension for compatibility
    const baseFilename = (filename || uid).replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9.-]/g, '_');
    const sanitized = `${baseFilename}.mp4`;
    const key = `videos/source/${year}/${month}/${timestamp}-${sanitized}`;

    // Upload to R2
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: videoBuffer,
      ContentType: 'video/mp4',
    });

    await s3.send(putCommand);

    // Calculate public URL
    const mp4_url = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      success: true,
      mp4_url,
      key,
    });
  } catch (error: any) {
    console.error('Stream to R2 copy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to copy to R2' },
      { status: 500 }
    );
  }
}
