import { NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await verifyUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const rl = await rateLimit({ key: `moments:photo-delete:${user!.userId}`, limit: 60, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const rows = await queryDatabase(`SELECT id, gallery_id, r2_key, thumbnail_key FROM gallery_photos WHERE id = ? LIMIT 1`, [id]);
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const row = rows[0] as { id: number; gallery_id: number; r2_key?: string | null; thumbnail_key?: string | null };

    // Best-effort delete from R2 (do not fail if missing)
    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    if (bucket) {
      try {
        if (row.r2_key) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.r2_key }));
      } catch {}
      try {
        if (row.thumbnail_key) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.thumbnail_key }));
      } catch {}
    }

    await executeQuery(`DELETE FROM gallery_photos WHERE id = ?`, [id]);
    try { await writeAuditLog(req, user, 'moments.photo.delete', String(id), { gallery_id: row.gallery_id }); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Delete photo error:', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
