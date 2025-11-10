import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
export const runtime = 'nodejs';

// POST /api/videos/[id]/analysis/transcript  { transcript: object|string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json() as { transcript: any };
    if (!body || typeof body !== 'object' || body.transcript === undefined) {
      return NextResponse.json({ error: 'transcript required' }, { status: 400 });
    }
    const vRows = await queryDatabase('SELECT id, uid FROM videos WHERE id = ? LIMIT 1', [params.id]);
    const v = vRows[0];
    if (!v) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    const transcriptJson = typeof body.transcript === 'string' ? body.transcript : JSON.stringify(body.transcript);
    await executeQuery(
      `INSERT INTO videos_analysis(uid, transcript_json, provider, model, diagnostics_json) VALUES (?, ?, ?, ?, ?)`,
      [v.uid, transcriptJson, 'manual', 'transcript-v1', null]
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('transcript save error', e);
    return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
  }
}
