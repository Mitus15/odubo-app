import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
    const body: any = await req.json().catch(() => ({}));
    const src = String(body?.source || '');
    const dest = String(body?.destination || '');
    if (!src || !dest) return NextResponse.json({ error: 'source and destination required' }, { status: 400 });

    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
    await s3.send(new CopyObjectCommand({ Bucket: bucket, CopySource: `/${bucket}/${src}`, Key: dest }));
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: src }));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Move failed') }, { status: 500 });
  }
}
