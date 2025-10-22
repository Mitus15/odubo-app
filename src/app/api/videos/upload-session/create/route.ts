import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await rateLimit({ key: `upload-session:${ip}`, limit: 10, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = (await req.json()) as Record<string, any>;
    const uid = (body.uid || '').toString();
    if (!uid) return NextResponse.json({ error: 'uid is required' }, { status: 400 });

    const meta = body.meta ?? {};
    const created_by = (user as any)?.email || '';

    const res = await executeQuery(
      `INSERT INTO video_upload_sessions (uid, meta_json, status, created_by, created_at, updated_at)
       VALUES (?, ?, 'uploaded', ?, datetime('now'), datetime('now'))`,
      [uid, JSON.stringify(meta), created_by]
    ) as any;

    const sessionId = res?.result?.[0]?.meta?.last_row_id || null;
    return NextResponse.json({ success: true, sessionId, uid });
  } catch (error) {
    console.error('create upload session error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
