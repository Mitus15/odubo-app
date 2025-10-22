import { NextResponse } from 'next/server';
import { verifyUserFromRequest, getUserRoleFromRequest } from '@/lib/auth';
import { executeQuery } from '@/lib/db';

export async function POST(req: Request) {
  const user = await verifyUserFromRequest(req as any);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getUserRoleFromRequest(req as any);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as any;
    const title = body.title || 'Moments';
    const description = body.description || null;
    const starts_at = body.starts_at || null;
    const ends_at = body.ends_at || null;
    const code = body.code || Math.random().toString(36).slice(2, 8).toUpperCase();
    const config = body.config ? JSON.stringify(body.config) : null;

    const sql = `INSERT INTO galleries (code, title, description, created_by, starts_at, ends_at, config) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await executeQuery(sql, [code, title, description, user.userId, starts_at, ends_at, config]);

    return NextResponse.json({ success: true, code });
  } catch (e: any) {
    console.error('Create gallery error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
