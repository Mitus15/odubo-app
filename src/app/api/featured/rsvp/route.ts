import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { writeAuditLog } from '@/lib/audit';
import { getUserFromRequest } from '@/lib/auth';

function normalizeHandle(raw: string): string | null {
  if (!raw) return null;
  let h = raw.trim();
  if (h.startsWith('@')) h = h.slice(1);
  // Instagram handles: letters, numbers, periods and underscores; 1-30 chars
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(h)) return null;
  return h.toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
  const body: any = await req.json().catch(() => ({}));
  const slug = String(body?.slug || '').trim();
  const handle = normalizeHandle(String(body?.instagram || ''));
    if (!slug || !handle) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Record RSVP via audit log (no extra schema needed now)
    try { await writeAuditLog(req, getUserFromRequest(req) || null, 'featured.rsvp', slug, { instagram: handle }); } catch {}

    // Optionally, issue a simple token or echo back success
    return NextResponse.json({ success: true, handle });
  } catch (e) {
    console.error('RSVP error:', e);
    return NextResponse.json({ error: 'Failed to RSVP' }, { status: 500 });
  }
}
