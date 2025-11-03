import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser, userHasAnyRole } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body: any = await req.json().catch(() => ({}));
    const sqlRaw = String(body?.sql || '').trim();
    const params = Array.isArray(body?.params) ? body.params : [];
    if (!sqlRaw) return NextResponse.json({ error: 'sql required' }, { status: 400 });

    const isRead = /^(select|pragma)\b/i.test(sqlRaw);
    if (isRead) {
      const rows = await queryDatabase(sqlRaw, params);
      return NextResponse.json({ success: true, kind: 'rows', rows });
    }
    const data = await executeQuery(sqlRaw, params);
    return NextResponse.json({ success: true, kind: 'result', data });
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
