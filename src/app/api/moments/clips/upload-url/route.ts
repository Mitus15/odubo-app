import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { gallery } from '@/lib/storage/pathGenerators';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

function getMimeType(fileName: string | undefined) {
  if (!fileName) return undefined;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    m4v: 'video/x-m4v', avi: 'video/x-msvideo', mkv: 'video/x-matroska'
  };
  return ext ? (map[ext] || 'video/mp4') : undefined;
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req as any) || null;
    const isAdmin = isAdminUser(user);

    const body = await req.json() as any;
    const galleryId = body.galleryId;
    const code = body.code || body.eventCode || null;
    const originalName = body.fileName || `clip_${Date.now()}.mp4`;
    const contentType = body.contentType || getMimeType(originalName) || 'video/mp4';
    const duration = body.duration || 15;

    if (!galleryId && !code) {
      return NextResponse.json({ error: 'Missing gallery identifier (galleryId or code)' }, { status: 400 });
    }

    // Load gallery and check permissions
    const rows = code
      ? await queryDatabase('SELECT id, code, title, starts_at, ends_at, upload_mode FROM galleries WHERE code = ? LIMIT 1', [code])
      : await queryDatabase('SELECT id, code, title, starts_at, ends_at, upload_mode FROM galleries WHERE id = ? LIMIT 1', [galleryId]);

    if (!rows[0]) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    const g = rows[0] as { id: number; code?: string; title?: string; starts_at?: string; ends_at?: string; upload_mode?: string };

    // Check upload mode
    const uploadMode = g.upload_mode || 'public';
    if (uploadMode === 'admin' && !isAdmin) {
      return NextResponse.json({ error: 'This gallery only accepts uploads from administrators.' }, { status: 403 });
    }

    // Check time window
    const now = Date.now();
    const startOk = !g.starts_at || now >= new Date(g.starts_at).getTime();
    const endOk = !g.ends_at || now <= new Date(g.ends_at).getTime();
    if (!startOk || !endOk) {
      return NextResponse.json({ error: 'This gallery is not accepting uploads at this time.' }, { status: 403 });
    }

    // Rate limit
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const rl = await rateLimit({ key: `clips-upload:${ip}`, limit: 30, windowMs: 60000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Generate R2 key
    const key = gallery.clips(String(g.id), originalName);

    // Generate presigned URL
    const signedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 300 }
    );

    return NextResponse.json({
      key,
      uploadUrl: signedUrl,
      expiresIn: 300,
    });
  } catch (e: any) {
    console.error('Clips upload URL error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to generate upload URL' }, { status: 500 });
  }
}