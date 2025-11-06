import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateFilePath } from '@/lib/fileOrganization';
import { queryDatabase } from '@/lib/db';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart/form-data expected' }, { status: 400 });
    }

    // Basic flood protection before parsing (very permissive to avoid hindering events)
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const rlPre = await rateLimit({ key: `moments:upload-proxy:${ip}:pre` , limit: 600, windowMs: 60_000 }); // ~10 rps per IP
    if (!rlPre.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

  const user = await verifyUserFromRequest(req as any).catch(() => null);
  const isAdmin = isAdminUser(user);

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const galleryIdRaw = form.get('galleryId');
  const codeRaw = form.get('code') || form.get('eventCode');
  const galleryId = galleryIdRaw ? String(galleryIdRaw) : '';
  const code = codeRaw ? String(codeRaw) : '';
  const mediaType = String(form.get('mediaType') || 'photo');
  const originalFilename = (file as any)?.name || String(form.get('fileName') || 'upload.bin');

    // Enforce upload size limit (50 MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    const contentLengthHeader = req.headers.get('content-length');
    if (contentLengthHeader) {
      const cl = parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(cl) && cl > MAX_SIZE + 10_000) { // small buffer allowance for multipart overhead
        return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
      }
    }

    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
    if (!galleryId && !code) return NextResponse.json({ error: 'galleryId or code required' }, { status: 400 });

    // Validate file size after parse as well
    const fileSize = (file as any).size ?? 0;
    if (fileSize > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
    }

    // MIME-type allowlist
    const detectedType = (file as any).type || 'application/octet-stream';
    const allowedTypes = new Set([
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'video/mp4', 'video/webm'
    ]);
    if (!allowedTypes.has(detectedType)) {
      return NextResponse.json({ error: `Unsupported content-type: ${detectedType}` }, { status: 415 });
    }

    // Resolve gallery and enforce schedule (also load config for public allowance)
    const rows = code
      ? await queryDatabase('SELECT id, code, title, starts_at, ends_at, config FROM galleries WHERE code = ? LIMIT 1', [code])
      : await queryDatabase('SELECT id, code, title, starts_at, ends_at, config FROM galleries WHERE id = ? LIMIT 1', [galleryId]);
    if (!rows[0]) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
  const g = rows[0] as { id: number; code?: string | null; title?: string | null; starts_at?: string | null; ends_at?: string | null; config?: any };
    const now = Date.now();
    const startOk = !g.starts_at || !Number.isNaN(Date.parse(g.starts_at)) ? (!g.starts_at || now >= Date.parse(g.starts_at!)) : true;
    const endOk = !g.ends_at || !Number.isNaN(Date.parse(g.ends_at)) ? (!g.ends_at || now <= Date.parse(g.ends_at!)) : true;
    if (!(startOk && endOk)) return NextResponse.json({ error: 'This gallery is not accepting uploads at this time.' }, { status: 403 });

    // Uploads require code unless admin OR the gallery is public OR an env override allows public proxy
    let allowWithoutCode = false;
    try {
      const cfg = typeof g.config === 'string' ? JSON.parse(g.config || '{}') : (g.config || {});
      allowWithoutCode = cfg?.is_public === true;
    } catch {}
    const envOverride = (process.env.MOMENTS_PROXY_ALLOW_PUBLIC || '').toLowerCase() === '1';
    if (!isAdmin && !envOverride && !allowWithoutCode && (!code || code !== g.code)) {
      return NextResponse.json({ error: 'Event code required to upload' }, { status: 403 });
    }

    // Event-friendly rate limit per IP per gallery (higher throughput for venues)
    const rl = await rateLimit({ key: `moments:upload-proxy:${ip}:g:${g.id}` , limit: 300, windowMs: 60_000 }); // 300/min per IP per gallery
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests for this gallery from your network' }, { status: 429 });
    }

    const key = generateFilePath({
      fileType: mediaType === 'video' ? 'gallery-video' : 'gallery-photo',
      galleryId: String(g.id),
      galleryName: g.title || undefined,
      fileName: originalFilename,
    });

    const buf = Buffer.from(await file.arrayBuffer());
    await s3.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: detectedType,
    }));

    const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    const publicUrl = base ? `${base}/${key}` : null;

    // Audit (non-blocking)
    try { await writeAuditLog(req, user, 'moments.upload', String(g.id), { key, contentType: detectedType, size: fileSize, via: 'proxy', ip }); } catch {}

    return NextResponse.json({ success: true, key, publicUrl });
  } catch (e: any) {
    console.error('Upload proxy error:', e);
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}
