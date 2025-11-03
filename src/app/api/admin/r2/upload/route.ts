import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';

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
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data')) return NextResponse.json({ error: 'multipart/form-data expected' }, { status: 400 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    let key = String(form.get('key') || '').replace(/^\/+/, '');
    const prefix = String(form.get('prefix') || '');
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
    if (!key) {
      const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
      const name = (file as any).name || 'upload.bin';
      key = cleanPrefix ? `${cleanPrefix}/${name}` : name;
    }

    const buf = Buffer.from(await file.arrayBuffer());
    await s3.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: file.type || 'application/octet-stream',
      ACL: undefined as any,
    }));

    const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    const url = base ? `${base}/${key}` : null;
    return NextResponse.json({ success: true, key, url });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Upload failed') }, { status: 500 });
  }
}
