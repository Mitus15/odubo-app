import { NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';
import { GalleryCreateSchema } from '@/lib/momentsSchemas';

export async function POST(req: Request) {
  const user = await verifyUserFromRequest(req as any);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  try {
    const rl = await rateLimit({ key: `galleries:create:${user.userId}`, limit: 20, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const raw = await req.json();
    const parsed = GalleryCreateSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
    const { title = 'Moments', description = null, starts_at = null, ends_at = null } = parsed.data;
    const code = parsed.data.code || Math.random().toString(36).slice(2, 8).toUpperCase();
    const config = parsed.data.config ? JSON.stringify(parsed.data.config) : null;

    const sql = `INSERT INTO galleries (code, title, description, created_by, starts_at, ends_at, config) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await executeQuery(sql, [code, title, description, user.userId, starts_at, ends_at, config]);
    await writeAuditLog(req, user, 'galleries.create', code, { title });
    return NextResponse.json({ success: true, code });
  } catch (e: any) {
    console.error('Create gallery error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
