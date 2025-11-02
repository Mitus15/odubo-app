import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });

  try {
    const body = (await req.json()) as Record<string, any>;
    const sessionId = Number(body.sessionId);
    const chosenPct = typeof body.selectedTimestampPct === 'number' ? body.selectedTimestampPct : undefined;
    const publication_status: 'live' | 'archived' = body.publication_status === 'live' ? 'live' : 'archived';

    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const sessionRows = await queryDatabase('SELECT * FROM video_upload_sessions WHERE id = ? LIMIT 1', [sessionId]);
    if (!sessionRows.length) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const session = sessionRows[0];
    const meta = JSON.parse(session.meta_json || '{}');
    const uid = session.uid as string;

    const stream = new CloudflareStreamAPI();
    // If chosenPct provided, try to set thumbnailTimestampPct on Stream
    if (typeof chosenPct === 'number' && chosenPct >= 0 && chosenPct <= 1) {
      try {
        await stream.updateVideo(uid, { thumbnailTimestampPct: chosenPct });
      } catch (e) {
        console.warn('Failed to set Stream thumbnailTimestampPct:', e);
      }
    }

    const embedUrl = stream.getEmbedUrl(uid);
    const posterUrl = stream.getThumbnailUrl(uid);

    // Compute duration if needed (best-effort)
    let duration = '';
    try {
      const details = await stream.getVideo(uid);
      const seconds = Number(details?.result?.duration || 0);
      duration = seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '';
    } catch {}

    await executeQuery(
      `INSERT INTO videos (
        uid, title, artist_name, description, url, poster_url, thumbnail, duration,
        category, is_public, type, mood, credits, related_projects, status, stream_video_id,
        publication_status, thumbnail_timestamp_pct,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        uid,
        (meta.title || uid),
        (meta.artist_name || ''),
        (meta.description || ''),
        embedUrl,
        posterUrl,
        posterUrl,
        (meta.duration || duration || ''),
        (meta.category || ''),
        (meta.is_public ? 1 : 0),
        (meta.type || ''),
        (meta.mood || ''),
        typeof meta.credits === 'string' ? meta.credits : JSON.stringify(meta.credits || []),
        typeof meta.related_projects === 'string' ? meta.related_projects : JSON.stringify(meta.related_projects || []),
        uid,
        publication_status,
        typeof chosenPct === 'number' ? chosenPct : null,
      ]
    );

    // Prune candidates for this session after finalize
    try {
      await executeQuery(`DELETE FROM videos_thumbnail_candidates WHERE session_id = ?`, [sessionId]);
    } catch (e) {
      console.warn('Prune candidates failed (non-fatal):', e);
    }

    await executeQuery(`UPDATE video_upload_sessions SET status = 'done', updated_at = datetime('now') WHERE id = ?`, [sessionId]);

    try { await writeAuditLog(req, user, 'videos.finalize', String(sessionId), { uid, publication_status }); } catch {}
    return NextResponse.json({ success: true, uid, url: embedUrl });
  } catch (error) {
    console.error('finalize video error:', error);
    return NextResponse.json({ error: 'Failed to finalize video' }, { status: 500 });
  }
}
