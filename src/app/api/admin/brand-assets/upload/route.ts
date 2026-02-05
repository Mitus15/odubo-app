import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { brandAssets } from '@/lib/storage/pathGenerators';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

// Supported image MIME types
const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/tiff',
  'image/bmp',
];

// Get file extension from MIME type
function getExtension(mimeType: string, filename: string): string {
  const extFromName = filename.split('.').pop()?.toLowerCase();
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
    'image/tiff': 'tiff',
    'image/bmp': 'bmp',
  };
  return mimeToExt[mimeType] || extFromName || 'bin';
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart/form-data expected' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const categorySlug = String(form.get('category_slug') || 'uncategorized');
    const albumSlug = String(form.get('album_slug') || 'uncategorized');

    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    // Validate file type
    const mimeType = file.type || 'application/octet-stream';
    if (!IMAGE_MIME_TYPES.includes(mimeType) && !mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Images only.' }, { status: 400 });
    }

    const originalFilename = file.name || 'upload';
    const ext = getExtension(mimeType, originalFilename);
    const uuid = uuidv4();
    const fileSize = file.size;

    // Generate storage keys using pathGenerators
    const r2Key = brandAssets.original(categorySlug, albumSlug, uuid, ext);
    const r2KeyThumb = brandAssets.thumbnail(categorySlug, albumSlug, uuid, 'webp');
    const r2KeyWeb = brandAssets.web(categorySlug, albumSlug, uuid, 'webp');

    // Upload original file
    const buf = Buffer.from(await file.arrayBuffer());
    await s3.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: r2Key,
      Body: buf,
      ContentType: mimeType,
    }));

    // TODO: Generate thumbnail and web-optimized versions
    // For now, we'll use the original for both until we add image processing
    // This would typically be done with sharp or a Cloudflare Worker

    const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');

    return NextResponse.json({
      success: true,
      r2_key: r2Key,
      r2_key_thumb: r2Key, // Use original until we add processing
      r2_key_web: r2Key, // Use original until we add processing
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size: fileSize,
      url: base ? `${base}/${r2Key}` : null,
      thumb_url: base ? `${base}/${r2Key}` : null,
    });
  } catch (e: any) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: String(e?.message || 'Upload failed') }, { status: 500 });
  }
}
