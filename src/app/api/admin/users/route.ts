import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const users = await queryDatabase('SELECT id, email, username, role, is_admin, email_verified, created_at FROM users ORDER BY created_at DESC');
  return NextResponse.json({ success: true, users });
}

export async function PATCH(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json() as { userId: string; role?: 'admin' | 'editor' | 'viewer'; is_active?: boolean };
  if (!body.userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const fields: string[] = [];
  const params: any[] = [];
  if (body.role) {
    fields.push('role = ?');
    params.push(body.role);
    // Only treat role === 'admin' as is_admin = 1; editor/viewer are non-admins
    fields.push('is_admin = ?');
    params.push(body.role === 'admin' ? 1 : 0);
  }
  if (typeof body.is_active === 'boolean') { fields.push('is_active = ?'); params.push(body.is_active ? 1 : 0); }
  if (fields.length === 0) return NextResponse.json({ error: 'No updates' }, { status: 400 });
  params.push(body.userId);
  await executeQuery(`UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
  return NextResponse.json({ success: true });
}


