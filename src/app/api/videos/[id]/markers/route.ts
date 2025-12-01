import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';

type Params = { params: { id: string } };

// Ensure this route is always treated as dynamic and runs on Node
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(req);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const videoId = Number(params.id);
    if (!videoId) return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });

    const markers = await queryDatabase(
      `SELECT id, video_id as videoId, timestamp, label, created_at as createdAt, updated_at as updatedAt
       FROM video_markers WHERE video_id = ? ORDER BY timestamp ASC`,
      [videoId]
    );
    return NextResponse.json({ markers });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(req);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const videoId = Number(params.id);
    if (!videoId) return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { markers, replace, timestamp, label } = body || {};

    // Support single marker payload
    const incoming = Array.isArray(markers)
      ? markers
      : (timestamp !== undefined ? [{ timestamp, label }] : []);

    if (!incoming.length && !replace) {
      return NextResponse.json({ error: 'No markers provided' }, { status: 400 });
    }

    if (replace) {
      await executeQuery(`DELETE FROM video_markers WHERE video_id = ?`, [videoId]);
    }

    for (const m of incoming) {
      const ts = Number(m.timestamp);
      if (Number.isNaN(ts) || ts < 0) continue;
      await executeQuery(
        `INSERT INTO video_markers (video_id, timestamp, label, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [videoId, ts, m.label || null]
      );
    }

    const out = await queryDatabase(
      `SELECT id, video_id as videoId, timestamp, label, created_at as createdAt, updated_at as updatedAt
       FROM video_markers WHERE video_id = ? ORDER BY timestamp ASC`,
      [videoId]
    );
    return NextResponse.json({ ok: true, markers: out });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(req);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const videoId = Number(params.id);
    if (!videoId) return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const { markerId, all } = body || {};
    if (all) {
      await executeQuery(`DELETE FROM video_markers WHERE video_id = ?`, [videoId]);
      return NextResponse.json({ ok: true });
    }
    if (!markerId) return NextResponse.json({ error: 'markerId required' }, { status: 400 });
    await executeQuery(`DELETE FROM video_markers WHERE id = ? AND video_id = ?`, [Number(markerId), videoId]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(req);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const videoId = Number(params.id);
    if (!videoId) return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { markerId, timestamp, label } = body || {};
    const idNum = Number(markerId);
    if (!idNum) return NextResponse.json({ error: 'markerId required' }, { status: 400 });

    const fields: string[] = [];
    const values: any[] = [];
    if (timestamp !== undefined) {
      const ts = Number(timestamp);
      if (!Number.isFinite(ts) || ts < 0) return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
      fields.push('timestamp = ?');
      values.push(ts);
    }
    if (label !== undefined) {
      fields.push('label = ?');
      values.push(label ?? null);
    }
    if (fields.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 });

    const sql = `UPDATE video_markers SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ? AND video_id = ?`;
    values.push(idNum, videoId);
    await executeQuery(sql, values);

    const out = await queryDatabase(
      `SELECT id, video_id as videoId, timestamp, label, created_at as createdAt, updated_at as updatedAt
       FROM video_markers WHERE video_id = ? ORDER BY timestamp ASC`,
      [videoId]
    );
    return NextResponse.json({ ok: true, markers: out });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
