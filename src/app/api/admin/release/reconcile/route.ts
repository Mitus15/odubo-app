/**
 * POST /api/admin/release/reconcile — apply a reviewed reconcile plan.
 *
 * The matching itself happens in the browser: `reconcile()` is pure, the file
 * list comes from a folder picker, and nothing needs uploading to work out
 * what a folder contains. Only the DECISIONS come here.
 *
 * Every retitle names what it is changing FROM as well as to. A plan is built
 * against a snapshot of the tracklist, and the owner may sit on it while
 * editing titles elsewhere; applying it blind would silently undo that edit.
 * So a retitle is refused if the row no longer says what the plan saw — the
 * same reasoning that makes the delivery route diff instead of replace.
 *
 * A title lives in three places (the album track, the delivery row, and the
 * warehouse piece pinned to that song) and they move together, or the
 * distributor's sheet and the platform disagree about what a song is called.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RetitleAction {
  kind: 'retitle';
  trackId: string;
  fromTitle: string;
  toTitle: string;
}

interface CreateAction {
  kind: 'create';
  title: string;
}

type Action = RetitleAction | CreateAction;

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const body = (await req.json()) as { projectId?: string; actions?: Action[] };
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const actions = body.actions ?? [];
    if (actions.length === 0) {
      return NextResponse.json({ error: 'Nothing to apply' }, { status: 400 });
    }

    const projectRows = await queryDatabase(
      'SELECT id, album_id FROM warehouse_projects WHERE id = ?',
      [body.projectId]
    );
    const albumId: string | undefined = projectRows?.[0]?.album_id;
    if (!albumId) {
      return NextResponse.json({ error: 'This project has no album linked' }, { status: 400 });
    }

    const releaseRows = await queryDatabase(
      `SELECT id, artist_name FROM distribution_releases WHERE internal_album_id = ?
        ORDER BY created_at DESC LIMIT 1`,
      [albumId]
    );
    const release = releaseRows?.[0] ?? null;

    const renamed: string[] = [];
    const created: string[] = [];
    const refused: Array<{ title: string; reason: string }> = [];

    for (const action of actions) {
      if (action.kind === 'retitle') {
        const rows = await queryDatabase(
          'SELECT id, title FROM tracks WHERE id = ? AND album_id = ?',
          [action.trackId, albumId]
        );
        const track = rows?.[0];
        if (!track) {
          refused.push({ title: action.toTitle, reason: 'that track is no longer on this album' });
          continue;
        }
        if (track.title !== action.fromTitle) {
          refused.push({
            title: action.toTitle,
            reason: `it now reads "${track.title}", not "${action.fromTitle}" — re-scan and review again`,
          });
          continue;
        }

        await executeQuery(
          "UPDATE tracks SET title = ?, updated_at = datetime('now') WHERE id = ?",
          [action.toTitle, action.trackId]
        );
        if (release) {
          await executeQuery(
            `UPDATE distribution_release_tracks SET title = ?, updated_at = datetime('now')
              WHERE release_id = ? AND internal_track_id = ?`,
            [action.toTitle, release.id, action.trackId]
          );
        }
        await executeQuery(
          `UPDATE warehouse_pieces SET title = ?, updated_at = datetime('now')
            WHERE project_id = ? AND track_id = ?`,
          [action.toTitle, body.projectId, action.trackId]
        );
        renamed.push(`${action.fromTitle} → ${action.toTitle}`);
        continue;
      }

      const title = action.title?.trim();
      if (!title) {
        refused.push({ title: '(untitled)', reason: 'a new track needs a title' });
        continue;
      }
      const existing = await queryDatabase(
        'SELECT id FROM tracks WHERE album_id = ? AND title = ?',
        [albumId, title]
      );
      if (existing && existing.length > 0) {
        refused.push({ title, reason: 'the album already has a song with that title' });
        continue;
      }

      // Append. Position is the owner's call, and the delivery grid is where
      // the running order gets set.
      const maxRows = await queryDatabase(
        'SELECT COALESCE(MAX(track_number), 0) AS n FROM tracks WHERE album_id = ?',
        [albumId]
      );
      const next = Number(maxRows?.[0]?.n ?? 0) + 1;

      const trackId = crypto.randomUUID();
      await executeQuery(
        `INSERT INTO tracks (id, album_id, title, track_number, duration, audio_status, status)
         VALUES (?, ?, ?, ?, 0, 'pending', 'draft')`,
        [trackId, albumId, title, next]
      );
      if (release) {
        await executeQuery(
          `INSERT INTO distribution_release_tracks
             (id, release_id, track_number, title, artist_name, internal_track_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), release.id, next, title, release.artist_name ?? 'Unknown', trackId]
        );
      }
      created.push(title);
    }

    // total_tracks drives the album header; leaving it stale is how a record
    // says "13 songs" above a list of fourteen.
    const totals = await queryDatabase('SELECT COUNT(*) AS c FROM tracks WHERE album_id = ?', [
      albumId,
    ]);
    await executeQuery(
      "UPDATE albums SET total_tracks = ?, updated_at = datetime('now') WHERE id = ?",
      [Number(totals?.[0]?.c ?? 0), albumId]
    );

    return NextResponse.json({ renamed, created, refused });
  } catch (error) {
    console.error('Reconcile failed:', error);
    return NextResponse.json({ error: 'Failed to apply the plan' }, { status: 500 });
  }
}
