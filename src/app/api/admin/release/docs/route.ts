/**
 * GET  /api/admin/release/docs?projectId=&trackId= — the writing.
 * POST /api/admin/release/docs                     — new doc.
 *
 * Notes, lore, characters, story drafts. Album-level when trackId is absent,
 * pinned to one song when it is present. `trackId=__album__` asks for only
 * the album-level docs; omitting it returns everything for the project.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import { DOC_KINDS, type DocKind } from '@/lib/release/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const projectId = req.nextUrl.searchParams.get('projectId');
    const trackId = req.nextUrl.searchParams.get('trackId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    let sql = 'SELECT * FROM warehouse_docs WHERE project_id = ?';
    const values: unknown[] = [projectId];
    if (trackId === '__album__') {
      sql += ' AND track_id IS NULL';
    } else if (trackId) {
      sql += ' AND track_id = ?';
      values.push(trackId);
    }
    sql += ' ORDER BY updated_at DESC';

    const docs = await queryDatabase(sql, values);
    return NextResponse.json({ docs: docs ?? [] });
  } catch (error) {
    console.error('List docs failed:', error);
    return NextResponse.json({ error: 'Failed to list docs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const body = (await req.json()) as {
      projectId?: string;
      trackId?: string | null;
      kind?: string;
      title?: string;
      body?: string;
    };

    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const kind = (body.kind ?? 'note') as DocKind;
    if (!(DOC_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json(
        { error: `kind must be one of ${DOC_KINDS.join(', ')}` },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await executeQuery(
      `INSERT INTO warehouse_docs (id, project_id, track_id, kind, title, body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, body.projectId, body.trackId ?? null, kind, title, body.body ?? '']
    );

    const rows = await queryDatabase('SELECT * FROM warehouse_docs WHERE id = ?', [id]);
    return NextResponse.json({ doc: rows?.[0] ?? null }, { status: 201 });
  } catch (error) {
    console.error('Create doc failed:', error);
    return NextResponse.json({ error: 'Failed to create doc' }, { status: 500 });
  }
}
