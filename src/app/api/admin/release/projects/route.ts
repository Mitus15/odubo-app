/**
 * GET /api/admin/release/projects — every project on the release floor.
 *
 * One row per project with the counts the list page shows, plus the linked
 * album's headline fields. The album join is a LEFT JOIN on a soft reference:
 * `warehouse_projects.album_id` has no foreign key, so a project whose album
 * was deleted still lists — it just shows no release date.
 *
 * NOTE: this directory was silently untracked for a while — `.gitignore` had a
 * bare `projects/` pattern, which git applies at ANY depth, so these routes
 * were never committed and the whole surface 404'd. The pattern is now
 * anchored (`/projects/`). Don't un-anchor it.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import { PROJECT_TYPES, type ProjectType } from '@/lib/release/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const projects = await queryDatabase(
      `SELECT
         p.id, p.type, p.title, p.status, p.album_id,
         a.title            AS album_title,
         a.status           AS album_status,
         a.release_date     AS album_release_date,
         a.cover_art_url    AS album_cover_art_url,
         (SELECT COUNT(*) FROM warehouse_pieces WHERE project_id = p.id) AS piece_count,
         (SELECT COUNT(*) FROM warehouse_files  WHERE project_id = p.id) AS file_count
       FROM warehouse_projects p
       LEFT JOIN albums a ON a.id = p.album_id
       WHERE p.status != 'archived'
       ORDER BY
         CASE WHEN a.release_date IS NULL THEN 1 ELSE 0 END,
         a.release_date ASC,
         p.created_at DESC`,
      []
    );

    return NextResponse.json({ projects: projects ?? [] });
  } catch (error) {
    console.error('List release projects failed:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const body = (await req.json()) as {
      title?: string;
      type?: string;
      albumId?: string | null;
    };

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const type = (body.type ?? 'album') as ProjectType;
    if (!(PROJECT_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json(
        { error: `type must be one of ${PROJECT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await executeQuery(
      `INSERT INTO warehouse_projects (id, type, title, status, album_id)
       VALUES (?, ?, ?, 'active', ?)`,
      [id, type, title, body.albumId ?? null]
    );

    const rows = await queryDatabase('SELECT * FROM warehouse_projects WHERE id = ?', [id]);
    return NextResponse.json({ project: rows?.[0] ?? null }, { status: 201 });
  } catch (error) {
    console.error('Create release project failed:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
