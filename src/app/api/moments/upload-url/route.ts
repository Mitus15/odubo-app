import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { gallery } from '@/lib/storage/pathGenerators';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

// MIME type helper (extracted from fileOrganization.ts)
function getMimeType(fileName: string | undefined) {
  if (!fileName) return undefined;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska', mp3: 'audio/mpeg', m4a: 'audio/mp4',
    wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac'
  };
  return ext ? (map[ext] || 'application/octet-stream') : undefined;
}

export async function POST(req: Request) {
  try {
    // Optionally verify user (attendee can be anonymous)
    const _user = getUserFromRequest(req as any) || null;
    const isAdmin = isAdminUser(_user);

    const body = await req.json() as any;
    const galleryId = body.galleryId;
    const code = body.code || body.eventCode || null;
    const originalName = body.fileName || `photo_${Date.now()}.jpg`;
    const contentType = body.contentType || getMimeType(originalName) || 'application/octet-stream';
    if (!galleryId && !code) return NextResponse.json({ error: 'Missing gallery identifier (galleryId or code)' }, { status: 400 });

    // Load gallery (by id or code) with upload_mode for permission check
    const rows = code
      ? await queryDatabase('SELECT id, code, title, starts_at, ends_at, upload_mode, gallery_type FROM galleries WHERE code = ? LIMIT 1', [code])
      : await queryDatabase('SELECT id, code, title, starts_at, ends_at, upload_mode, gallery_type FROM galleries WHERE id = ? LIMIT 1', [galleryId]);
    if (!rows[0]) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

    const { id, starts_at, ends_at, code: gCode, title, upload_mode, gallery_type } = rows[0] as {
      id: number;
      starts_at?: string | null;
      ends_at?: string | null;
      code?: string | null;
      title?: string | null;
      upload_mode?: string;
      gallery_type?: string;
    };

    // Check upload permission based on upload_mode
    const uploadMode = upload_mode || 'public';
    if (uploadMode === 'admin' && !isAdmin) {
      return NextResponse.json({ error: 'This gallery only accepts uploads from administrators.' }, { status: 403 });
    }

    // For public galleries, check time windows (admin bypasses time restrictions)
    if (!isAdmin) {
      const now = Date.now();
      const startOk = !starts_at || !Number.isNaN(Date.parse(starts_at)) ? (!starts_at || now >= Date.parse(starts_at!)) : true;
      const endOk = !ends_at || !Number.isNaN(Date.parse(ends_at)) ? (!ends_at || now <= Date.parse(ends_at!)) : true;
      if (!(startOk && endOk)) {
        return NextResponse.json({ error: 'This gallery is not accepting uploads at this time.' }, { status: 403 });
      }
    }

    // Accept uploads via galleryId (preferred) or by valid event code.
    // If a code is provided by the client, validate it; otherwise allow by galleryId.
    const hasCode = typeof code === 'string' && code.length > 0;
    if (!isAdmin && hasCode && code !== gCode) {
      return NextResponse.json({ error: 'Invalid event code' }, { status: 403 });
    }

    // Rate limit per IP per gallery to be event-friendly but safe
    const ip = (req.headers as any).get?.('x-forwarded-for') || (req as any).headers?.get?.('x-forwarded-for') || 'unknown';
    const rl = await rateLimit({ key: `moments:upload-url:${ip}:g:${id}`, limit: 120, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // Generate R2 key using pathGenerators (consistent with rest of system)
    const gallerySlug = title || gCode || String(id);
    const key = body.mediaType === 'video' 
      ? gallery.video(gallerySlug, originalName)
      : gallery.photo(gallerySlug, originalName);

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
