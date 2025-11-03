import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

function extFromName(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : 'bin';
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data')) return NextResponse.json({ error: 'multipart/form-data expected' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const kind = String(formData.get('kind') || ''); // 'cover' | 'background'
    if (!file || !kind || (kind !== 'cover' && kind !== 'background')) return NextResponse.json({ error: 'file and kind required' }, { status: 400 });

    // Lookup current URLs
    const rows = await queryDatabase('SELECT cover_image_url, background_video_url FROM featured_pages LIMIT 1', []);
    const current = rows[0] || {} as any;

    // Build versioned key to bust caches
    const baseKey = kind === 'cover' ? 'featured/cover' : 'featured/background';
    const version = Date.now();
    const ext = extFromName(file.name);
    const key = `${baseKey}_v${version}.${ext}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(arrayBuffer),
      ContentType: file.type || (kind === 'cover' ? 'image/*' : 'video/*'),
      ACL: undefined as any,
    }));

    const publicBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    const publicUrl = `${publicBase}/${key}`;

    // Update DB
    const field = kind === 'cover' ? 'cover_image_url' : 'background_video_url';
    await executeQuery(`UPDATE featured_pages SET ${field} = ?, updated_at = datetime('now') WHERE rowid = (SELECT rowid FROM featured_pages LIMIT 1)`, [publicUrl]);

    // Delete previous object if same base path (best-effort)
    const oldUrl: string | null = current[field] || null;
    if (oldUrl) {
      try {
        const oldBase = publicBase ? `${publicBase}/` : '';
        const oldKey = oldUrl.startsWith(oldBase) ? oldUrl.substring(oldBase.length) : (new URL(oldUrl)).pathname.replace(/^\//, '');
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: oldKey }));
      } catch (e) {
        console.warn('R2 delete previous failed:', e);
      }
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (e) {
    console.error('featured-single upload error:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
