import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
export const runtime = 'nodejs';

// GET /api/videos/[id]/analysis?uid= optional: returns latest videos_analysis row enriched
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const uidParam = url.searchParams.get('uid');
    let video;
    if (uidParam) {
      const vRows = await queryDatabase('SELECT id, uid FROM videos WHERE uid = ? LIMIT 1', [uidParam]);
      video = vRows[0];
    } else if (id) {
      const vRows = await queryDatabase('SELECT id, uid FROM videos WHERE id = ? LIMIT 1', [id]);
      video = vRows[0];
    }
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    const rows = await queryDatabase('SELECT * FROM videos_analysis WHERE uid = ? ORDER BY created_at DESC LIMIT 1', [video.uid]);
    const row = rows[0];
    if (!row) return NextResponse.json({ success: true, analysis: null });

    let diagnostics: any = {};
    try { diagnostics = row.diagnostics_json ? JSON.parse(String(row.diagnostics_json)) : {}; } catch {}
    let themes: string[] = [];
    try { themes = row.themes_json ? JSON.parse(String(row.themes_json)) : []; } catch {}
    const enriched = {
      id: row.id,
      uid: row.uid,
      provider: row.provider,
      model: row.model,
      created_at: row.created_at,
      transcript_json: row.transcript_json ? (() => { try { return JSON.parse(String(row.transcript_json)); } catch { return null; } })() : null,
      mood: row.mood,
      genre: row.genre,
      themes,
      style_palette: diagnostics.style_palette || null,
      shots_signature: diagnostics.shots_signature || null,
    };
    return NextResponse.json({ success: true, analysis: enriched });
  } catch (e) {
    console.error('analysis get error', e);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}
