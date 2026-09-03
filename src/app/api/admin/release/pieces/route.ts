/**
 * GET  /api/admin/release/pieces?projectId= — pieces for a project.
 * POST /api/admin/release/pieces               — create one piece.
 * PUT  /api/admin/release/pieces               — create a piece per song.
 *
 * The PUT is the "create a piece per song" action, and it is idempotent: it
 * only inserts track-master pieces for tracks that do not already have one,
 * so the owner can press it again after adding a fourteenth song without
 * getting thirteen duplicates.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import { PIECE_KINDS, type PieceKind } from '@/lib/release/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const pieces = await queryDatabase(
      `SELECT * FROM warehouse_pieces WHERE project_id = ?
        ORDER BY sort_order ASC, created_at ASC`,
      [projectId]
    );
    return NextResponse.json({ pieces: pieces ?? [] });
  } catch (error) {
    console.error('List pieces failed:', error);
    return NextResponse.json({ error: 'Failed to list pieces' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const body = (await req.json()) as {
      projectId?: string;
      kind?: string;
      title?: string;
      description?: string | null;
      trackId?: string | null;
      sortOrder?: number;
    };

    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const kind = body.kind as PieceKind;
    if (!(PIECE_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json(
        { error: `kind must be one of ${PIECE_KINDS.join(', ')}` },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await executeQuery(
      `INSERT INTO warehouse_pieces
         (id, project_id, kind, title, description, track_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.projectId,
        kind,
        title,
        body.description ?? null,
        body.trackId ?? null,
        body.sortOrder ?? 0,
      ]
    );

    const rows = await queryDatabase('SELECT * FROM warehouse_pieces WHERE id = ?', [id]);
    return NextResponse.json({ piece: rows?.[0] ?? null }, { status: 201 });
  } catch (error) {
    console.error('Create piece failed:', error);
    return NextResponse.json({ error: 'Failed to create piece' }, { status: 500 });
  }
}

/** Create one track-master piece per song. Idempotent. */
export async function PUT(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { projectId } = (await req.json()) as { projectId?: string };
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const projectRows = await queryDatabase(
      'SELECT id, album_id FROM warehouse_projects WHERE id = ?',
      [projectId]
    );
    const project = projectRows?.[0];
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!project.album_id) {
      return NextResponse.json(
        { error: 'This project has no album linked, so it has no songs' },
        { status: 400 }
      );
    }

    const [tracks, existing] = await Promise.all([
      queryDatabase(
        'SELECT id, title, track_number FROM tracks WHERE album_id = ? ORDER BY track_number ASC',
        [project.album_id]
      ),
      queryDatabase(
        `SELECT track_id FROM warehouse_pieces
          WHERE project_id = ? AND kind = 'track-master' AND track_id IS NOT NULL`,
        [projectId]
      ),
    ]);

    const already = new Set((existing ?? []).map((r: { track_id: string }) => r.track_id));
    const missing = (tracks ?? []).filter(
      (t: { id: string }) => !already.has(t.id)
    ) as Array<{ id: string; title: string; track_number: number }>;

    for (const track of missing) {
      await executeQuery(
        `INSERT INTO warehouse_pieces
           (id, project_id, kind, title, track_id, sort_order)
         VALUES (?, ?, 'track-master', ?, ?, ?)`,
        [crypto.randomUUID(), projectId, track.title, track.id, track.track_number ?? 0]
      );
    }

    return NextResponse.json({
      created: missing.length,
      alreadyPresent: already.size,
      totalTracks: tracks?.length ?? 0,
    });
  } catch (error) {
    console.error('Create track pieces failed:', error);
    return NextResponse.json({ error: 'Failed to create track pieces' }, { status: 500 });
  }
}
