import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req as any);
    console.log('[galleries/GET] Auth check:', { 
      hasUser: !!user, 
      isAdmin: isAdminUser(user),
      userId: user?.userId,
      email: user?.email 
    });
    
    if (!isAdminUser(user)) {
      console.error('[galleries] Admin check failed - returning 403');
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '20')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));

    const rl = await rateLimit({ key: `galleries:list:${user!.userId}`, limit: 120, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: { 'x-ratelimit-remaining': String(rl.remaining), 'x-ratelimit-reset': String(rl.resetAt) } });

    const rows = await queryDatabase(
      'SELECT id, code, title, description, starts_at, ends_at, created_by, created_at, updated_at, config FROM galleries ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    console.log('[galleries/GET] Success - returning', rows.length, 'galleries');
    await writeAuditLog(req, user, 'galleries.list', `count=${rows.length}`, { limit, offset });
    return NextResponse.json({ galleries: rows });
  } catch (e: any) {
    console.error('List galleries error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
