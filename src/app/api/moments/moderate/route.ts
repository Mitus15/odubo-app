import { NextResponse } from 'next/server';
import { verifyUserFromRequest } from '@/lib/auth';
import { executeQuery } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: Request) {
  try {
  const user = await verifyUserFromRequest(req as any);
    if (!user || !user.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const rl = await rateLimit({ key: `moments:moderate:${user.userId}`, limit: 120, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const body = await req.json() as any;
    const id = body.id;
    const action = body.action; // 'approve' | 'reject'
    if (!id || !action) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    let moderatedValue = 0;
    if (action === 'approve') moderatedValue = 1;
    else if (action === 'reject') moderatedValue = 2;
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const moderatedAt = new Date().toISOString();
  await executeQuery('UPDATE gallery_photos SET moderated = ?, moderated_at = ?, moderated_by = ? WHERE id = ?', [moderatedValue, moderatedAt, user.email || null, id]);
  await writeAuditLog(req, user, 'moments.moderate', String(id), { action });

    return NextResponse.json({ success: true, id, moderated: moderatedValue, moderated_at: moderatedAt });
  } catch (e: any) {
    console.error('Moderate error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
