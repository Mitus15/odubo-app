/**
 * GET /api/admin/release/projects/[projectId] — everything the project floor
 * renders, in one round trip.
 *
 * The floor needs seven things at once (project, album, tracks, delivery
 * release, pieces, files, docs) and they are useless apart: the piece grid
 * cannot badge a shipped master without both the files and the release rows.
 * Seven client fetches would also mean seven auth checks and seven waterfalls,
 * so this route fans out in parallel and answers once.
 *
 * `shipped` is DERIVED, never stored. A file ships iff a release-track row
 * points at its r2_key — the pointer IS the flag, so there is no boolean that
 * can disagree with what actually gets delivered.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { projectId } = await params;

    const projectRows = await queryDatabase(
      'SELECT * FROM warehouse_projects WHERE id = ?',
      [projectId]
    );
    const project = projectRows?.[0];
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const albumId: string | null = project.album_id ?? null;

    const [pieces, files, docs, albumRows] = await Promise.all([
      queryDatabase(
        `SELECT * FROM warehouse_pieces WHERE project_id = ?
          ORDER BY sort_order ASC, created_at ASC`,
        [projectId]
      ),
      queryDatabase(
        `SELECT * FROM warehouse_files WHERE project_id = ?
          ORDER BY uploaded_at DESC`,
        [projectId]
      ),
      queryDatabase(
        `SELECT * FROM warehouse_docs WHERE project_id = ?
          ORDER BY updated_at DESC`,
        [projectId]
      ),
      albumId
        ? queryDatabase(
            `SELECT id, title, artist_name, status, release_date, cover_art_url,
                    total_tracks, total_duration
               FROM albums WHERE id = ?`,
            [albumId]
          )
        : Promise.resolve([]),
    ]);

    const album = albumRows?.[0] ?? null;

    // Tracks and the delivery release both hang off the album, so they only
    // make sense once we know there is one.
    const [tracks, releaseRows] = albumId
      ? await Promise.all([
          queryDatabase(
            `SELECT id, title, track_number, duration, audio_url, audio_status,
                    isrc, status, source_file_id
               FROM tracks WHERE album_id = ?
              ORDER BY track_number ASC`,
            [albumId]
          ),
          queryDatabase(
            `SELECT id, status, distributor, upc, distribution_release_date
               FROM distribution_releases
              WHERE internal_album_id = ?
              ORDER BY created_at DESC LIMIT 1`,
            [albumId]
          ),
        ])
      : [[], []];

    const release = releaseRows?.[0] ?? null;

    // track_id → r2_key currently flagged to ship.
    const shipped: Record<string, string> = {};
    if (release?.id) {
      const shippedRows = await queryDatabase(
        `SELECT internal_track_id, audio_r2_key
           FROM distribution_release_tracks
          WHERE release_id = ?
            AND audio_r2_key IS NOT NULL
            AND internal_track_id IS NOT NULL`,
        [release.id]
      );
      for (const row of shippedRows ?? []) {
        shipped[row.internal_track_id] = row.audio_r2_key;
      }
    }

    return NextResponse.json({
      project,
      album,
      tracks: tracks ?? [],
      release,
      pieces: pieces ?? [],
      files: files ?? [],
      docs: docs ?? [],
      shipped,
    });
  } catch (error) {
    console.error('Load release project failed:', error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}
