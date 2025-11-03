import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const prefix = (searchParams.get('prefix') || '').trim();
  const token = searchParams.get('token') || undefined;
  const maxKeys = Math.min(parseInt(searchParams.get('max') || '50', 10) || 50, 1000);

  try {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Prefix: prefix || undefined,
      ContinuationToken: token,
      MaxKeys: maxKeys,
    }));

    return NextResponse.json({
      success: true,
      prefix,
      items: (res.Contents || []).map((o) => ({
        key: o.Key,
        size: o.Size,
        lastModified: o.LastModified,
        eTag: o.ETag,
        storageClass: o.StorageClass,
      })),
      isTruncated: !!res.IsTruncated,
      nextToken: res.NextContinuationToken || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'List failed') }, { status: 500 });
  }
}
