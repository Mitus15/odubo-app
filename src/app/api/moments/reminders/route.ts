import { NextRequest, NextResponse } from 'next/server';
import { dispatchDueReminders } from '@/lib/momentsReminderDispatcher';
import { isAdminUser, getUserFromRequest, userHasAnyRole } from '@/lib/auth';

export const runtime = 'nodejs';

// POST /api/moments/reminders -> run dispatcher manually (admin/editor only)
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  const allowed = isAdminUser(user) || await userHasAnyRole(req, ['editor']);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const result = await dispatchDueReminders(new Date());
    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error('reminders dispatch error:', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
