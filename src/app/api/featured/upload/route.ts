import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const slug = String(form.get('slug') || '').trim().toLowerCase();
    const kind = String(form.get('kind') || '').trim(); // 'cover' | 'background'
    if (!file || !['cover', 'background'].includes(kind)) {
      return NextResponse.json({ error: 'file and kind required' }, { status: 400 });
    }

    // Decide storage scope: legacy (with slug) vs singleton
    let priorCover: string | null = null;
    let priorBg: string | null = null;
    let keyPrefix = 'featured/single';
    if (slug) {
      const rows = await queryDatabase('SELECT cover_image_url, background_video_url FROM featured_pages WHERE slug = ? LIMIT 1', [slug]);
      if (!rows.length) return NextResponse.json({ error: 'Featured not found' }, { status: 404 });
      priorCover = (rows[0] as any).cover_image_url || null;
      priorBg = (rows[0] as any).background_video_url || null;
      keyPrefix = `featured/${slug}`;
    } else {
      const rows = await queryDatabase('SELECT cover_image_url, background_video_url FROM featured_single WHERE id = 1 LIMIT 1', []);
      priorCover = rows.length ? (rows[0] as any).cover_image_url || null : null;
      priorBg = rows.length ? (rows[0] as any).background_video_url || null : null;
      keyPrefix = 'featured/single';
    }

    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    const isImage = (file.type || '').startsWith('image/');
    const isVideo = (file.type || '').startsWith('video/');
  const ext = (isImage ? (file.type.endsWith('png') ? 'png' : 'jpg') : (isVideo ? 'mp4' : 'bin'));
  // Versioned key to defeat caches and ensure immediate swap on replace
  const version = Date.now();
  const baseName = kind === 'cover' ? 'cover' : 'background';
    const key = `${keyPrefix}/${baseName}-${version}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: file.type || (kind === 'background' ? 'video/mp4' : 'image/jpeg'),
      ACL: 'public-read',
    } as any));

    const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
    const field = kind === 'cover' ? 'cover_image_url' : 'background_video_url';
    // Keep prior URL to delete old object after successful update
    const priorUrl: string | null = kind === 'cover' ? priorCover : priorBg;
    if (slug) {
      await executeQuery(`UPDATE featured_pages SET ${field} = ?, updated_at = datetime('now') WHERE slug = ?`, [publicUrl, slug]);
    } else {
      // Ensure row exists
      await executeQuery(
        `INSERT INTO featured_single (id, ${field}, created_at, updated_at) VALUES (1, ?, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET ${field} = excluded.${field}, updated_at = datetime('now')`,
        [publicUrl]
      );
    }

    // Best-effort delete of previous object to avoid orphaned files
    if (priorUrl) {
      const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
      const toKey = (u: string) => {
        if (base && u.startsWith(base + '/')) return u.substring(base.length + 1);
        try { const parsed = new URL(u); return parsed.pathname.replace(/^\//, ''); } catch { return u; }
      };
      const priorKey = toKey(priorUrl);
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: priorKey }));
      } catch (e) {
        console.warn('R2 delete previous failed for', priorKey, e);
      }
    }

  try { await writeAuditLog(req, user, 'featured.upload', slug || 'singleton', { kind, key }); } catch {}
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (e) {
    console.error('featured upload error:', e);
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}
