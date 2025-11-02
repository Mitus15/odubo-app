import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const videoId = Number(form.get('videoId'));
    if (!file || !videoId) return NextResponse.json({ error: 'file and videoId are required' }, { status: 400 });

    const rows = await queryDatabase('SELECT id FROM videos WHERE id = ? LIMIT 1', [videoId]);
    if (!rows.length) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    const ext = (file.type === 'image/png') ? 'png' : 'jpg';
    const key = `thumbnails/videos/${videoId}/${Date.now()}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: file.type || 'image/jpeg',
      ACL: 'public-read',
    } as any));

    const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;

    await executeQuery('UPDATE videos SET poster_url = ?, thumbnail = ?, updated_at = datetime(\'now\') WHERE id = ?', [publicUrl, publicUrl, videoId]);

    try { await writeAuditLog(req, user, 'videos.thumbnail.upload', String(videoId), { key }); } catch {}

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('thumbnail upload error:', error);
    return NextResponse.json({ error: 'Failed to upload thumbnail' }, { status: 500 });
  }
}
