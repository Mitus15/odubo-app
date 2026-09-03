/**
 * GET   /api/admin/release/delivery?projectId= — the delivery sheet.
 * PATCH /api/admin/release/delivery            — save edited metadata.
 *
 * ── Why this is a diff and not a full replace ────────────────────────────
 * The code this replaces did DELETE-then-INSERT on distribution_release_tracks
 * for every save. D1 over REST has NO transactions, so a failure between the
 * two statements permanently loses every ISRC on the record — identifiers a
 * distributor issues once. It also silently wiped `audio_r2_key`, because the
 * metadata grid does not know that column exists, which un-shipped every
 * master on an unrelated save.
 *
 * So: update rows by id with only the fields actually present in the payload,
 * insert what is new, delete what is gone. Nothing is destroyed to write one
 * cell.
 *
 * ── The second defence ──────────────────────────────────────────────────
 * `audio_r2_key` and `audio_url` are NOT in EDITABLE_FIELDS and cannot be
 * reached through this route at any payload. Shipping is owned solely by
 * /pieces/[id]/ship. Two independent guards, because this regression has
 * already been paid for once.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Track columns this route is allowed to write. `audio_*` is absent by design. */
export const EDITABLE_TRACK_FIELDS = [
  'track_number',
  'title',
  'version',
  'artist_name',
  'featuring_artists',
  'isrc',
  'duration_seconds',
  'composers',
  'producers',
  'performers',
  'royalty_splits',
  'explicit',
  'instrumental',
  'lyrics',
  'lyrics_language',
] as const;

/** Release columns this route is allowed to write. */
export const EDITABLE_RELEASE_FIELDS = [
  'title',
  'artist_name',
  'label_name',
  'upc',
  'catalog_number',
  'distribution_release_date',
  'distributor',
  'genre',
  'subgenre',
  'language',
  'copyright_line',
  'phonographic_line',
  'explicit_content',
] as const;

type TrackField = (typeof EDITABLE_TRACK_FIELDS)[number];
type ReleaseField = (typeof EDITABLE_RELEASE_FIELDS)[number];

async function resolveRelease(projectId: string) {
  const projectRows = await queryDatabase(
    'SELECT id, album_id FROM warehouse_projects WHERE id = ?',
    [projectId]
  );
  const project = projectRows?.[0];
  if (!project) return { error: 'Project not found' as const, release: null, albumId: null };
  if (!project.album_id) {
    return { error: 'This project has no album linked' as const, release: null, albumId: null };
  }
  const releaseRows = await queryDatabase(
    `SELECT * FROM distribution_releases WHERE internal_album_id = ?
      ORDER BY created_at DESC LIMIT 1`,
    [project.album_id]
  );
  return { error: null, release: releaseRows?.[0] ?? null, albumId: project.album_id as string };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const { error, release } = await resolveRelease(projectId);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (!release) {
      return NextResponse.json({ release: null, tracks: [] });
    }

    const tracks = await queryDatabase(
      `SELECT * FROM distribution_release_tracks WHERE release_id = ?
        ORDER BY disc_number ASC, track_number ASC`,
      [release.id]
    );

    return NextResponse.json({ release, tracks: tracks ?? [] });
  } catch (error) {
    console.error('Load delivery sheet failed:', error);
    return NextResponse.json({ error: 'Failed to load the delivery sheet' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const body = (await req.json()) as {
      projectId?: string;
      release?: Record<string, unknown>;
      tracks?: Array<Record<string, unknown>>;
      /** Rows the owner removed. Explicit — absence never deletes. */
      deleteTrackIds?: string[];
    };

    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const { error, release } = await resolveRelease(body.projectId);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (!release) {
      return NextResponse.json({ error: 'No delivery release for this project' }, { status: 404 });
    }

    let releaseUpdated = 0;
    let tracksUpdated = 0;
    let tracksInserted = 0;
    let tracksDeleted = 0;

    // ---- release ---------------------------------------------------------
    if (body.release) {
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const field of EDITABLE_RELEASE_FIELDS) {
        if (Object.hasOwn(body.release, field)) {
          sets.push(`${field} = ?`);
          values.push(normalize(field, body.release[field]));
        }
      }
      if (sets.length > 0) {
        sets.push("updated_at = datetime('now')");
        values.push(release.id);
        await executeQuery(
          `UPDATE distribution_releases SET ${sets.join(', ')} WHERE id = ?`,
          values
        );
        releaseUpdated = 1;
      }
    }

    // ---- tracks ----------------------------------------------------------
    const existing = await queryDatabase(
      'SELECT id FROM distribution_release_tracks WHERE release_id = ?',
      [release.id]
    );
    const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id));

    for (const row of body.tracks ?? []) {
      const id = typeof row.id === 'string' ? row.id : null;

      if (id && existingIds.has(id)) {
        const sets: string[] = [];
        const values: unknown[] = [];
        for (const field of EDITABLE_TRACK_FIELDS) {
          if (Object.hasOwn(row, field)) {
            sets.push(`${field} = ?`);
            values.push(normalize(field, row[field]));
          }
        }
        if (sets.length === 0) continue;
        sets.push("updated_at = datetime('now')");
        values.push(id, release.id);
        await executeQuery(
          `UPDATE distribution_release_tracks SET ${sets.join(', ')}
            WHERE id = ? AND release_id = ?`,
          values
        );
        tracksUpdated++;
      } else {
        // A new row still needs the NOT NULL columns.
        const title = String(row.title ?? '').trim();
        if (!title) {
          return NextResponse.json({ error: 'A new track needs a title' }, { status: 400 });
        }
        const columns: string[] = ['id', 'release_id'];
        const placeholders: string[] = ['?', '?'];
        const values: unknown[] = [id ?? crypto.randomUUID(), release.id];
        for (const field of EDITABLE_TRACK_FIELDS) {
          if (Object.hasOwn(row, field)) {
            columns.push(field);
            placeholders.push('?');
            values.push(normalize(field, row[field]));
          }
        }
        if (!columns.includes('artist_name')) {
          columns.push('artist_name');
          placeholders.push('?');
          values.push(release.artist_name ?? 'Unknown');
        }
        await executeQuery(
          `INSERT INTO distribution_release_tracks (${columns.join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values
        );
        tracksInserted++;
      }
    }

    // ---- keep the album's running order in step ------------------------
    // Delivery and preview are allowed to disagree about the AUDIO (an AIFF
    // ships fine and no browser plays it) but never about the ORDER: a record
    // that streams in a different sequence than it ships is simply wrong.
    // Propagated through internal_track_id, which this route cannot itself
    // write — so it can only ever follow a link the ship endpoint made.
    let previewReordered = 0;
    for (const row of body.tracks ?? []) {
      if (!Object.hasOwn(row, 'track_number')) continue;
      const id = typeof row.id === 'string' ? row.id : null;
      if (!id || !existingIds.has(id)) continue;
      const number = normalize('track_number', row.track_number);
      if (number === null) continue;
      await executeQuery(
        `UPDATE tracks SET track_number = ?, updated_at = datetime('now')
          WHERE id = (SELECT internal_track_id FROM distribution_release_tracks
                       WHERE id = ? AND internal_track_id IS NOT NULL)`,
        [number, id]
      );
      previewReordered++;
    }

    for (const id of body.deleteTrackIds ?? []) {
      if (!existingIds.has(id)) continue;
      await executeQuery(
        'DELETE FROM distribution_release_tracks WHERE id = ? AND release_id = ?',
        [id, release.id]
      );
      tracksDeleted++;
    }

    const [releaseRows, trackRows] = await Promise.all([
      queryDatabase('SELECT * FROM distribution_releases WHERE id = ?', [release.id]),
      queryDatabase(
        `SELECT * FROM distribution_release_tracks WHERE release_id = ?
          ORDER BY disc_number ASC, track_number ASC`,
        [release.id]
      ),
    ]);

    return NextResponse.json({
      release: releaseRows?.[0] ?? null,
      tracks: trackRows ?? [],
      changed: { releaseUpdated, tracksUpdated, tracksInserted, tracksDeleted, previewReordered },
    });
  } catch (error) {
    console.error('Save delivery sheet failed:', error);
    return NextResponse.json({ error: 'Failed to save the delivery sheet' }, { status: 500 });
  }
}

/**
 * D1 takes no booleans and no objects.
 *
 * An empty string becomes NULL rather than "": a blank ISRC cell means "not
 * issued yet", and validation treats NULL as a warning but "" would read as a
 * present-but-malformed value — an error. Clearing a cell must not create one.
 */
function normalize(field: TrackField | ReleaseField, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (field === 'isrc') return trimmed.toUpperCase().replace(/[\s-]/g, '');
    if (field === 'upc') return trimmed.replace(/[\s-]/g, '');
    return trimmed;
  }
  return value;
}
