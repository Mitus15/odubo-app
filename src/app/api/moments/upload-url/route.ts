import { NextResponse } from 'next/server';
import { verifyUserFromRequest } from '@/lib/auth';
import { generateFilePath, getMimeType } from '@/lib/fileOrganization';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(req: Request) {
  try {
    // Optionally verify user (attendee can be anonymous)
    const _user = await verifyUserFromRequest(req as any).catch(() => null);

    const body = await req.json() as any;
    const galleryId = body.galleryId;
    const originalName = body.fileName || `photo_${Date.now()}.jpg`;
    const contentType = body.contentType || getMimeType(originalName) || 'application/octet-stream';
    if (!galleryId) return NextResponse.json({ error: 'Missing galleryId' }, { status: 400 });

    // Generate R2 key with a clear prefix for organization
    const key = generateFilePath({ fileType: body.mediaType === 'video' ? 'gallery-video' : 'gallery-photo', galleryId: String(galleryId), fileName: originalName });

    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    const publicUrl = publicBase ? `${publicBase}/${key}` : null;

    // Try to generate a presigned PUT URL using S3 signer (preferred for private buckets)
    try {
      const s3 = new S3Client({
        region: 'auto',
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
        },
      });

      const cmd = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      });

      const presigned = await getSignedUrl(s3, cmd, { expiresIn: 900 });

      return NextResponse.json({ success: true, key, uploadUrl: presigned, publicUrl });
    } catch (e) {
      // If signing fails, fall back to public URL
      console.warn('Presign failed, falling back to public PUT URL', e);
      if (!publicUrl) throw e;
      return NextResponse.json({ success: true, key, uploadUrl: publicUrl, publicUrl });
    }
  } catch (e: any) {
    console.error('Upload URL error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
