/**
 * POST   /api/admin/release/pieces/[id]/ship — flag one master as the one
 *                                              that goes out, and give the
 *                                              preview something to play.
 * DELETE /api/admin/release/pieces/[id]/ship — take the flag off.
 *
 * Shipping writes in two directions, and they are not the same thing:
 *
 *   DELIVERY — distribution_release_tracks.audio_r2_key points at the object
 *   the distributor will be given, with audio_url as `warehouse:<fileId>` so
 *   the row records which warehouse file it came from. Nothing plays this.
 *
 *   PREVIEW — tracks.audio_url points at /api/media/audio/<r2_key>, which is
 *   what AlbumPlayer ends up streaming. Root-relative on purpose: the domain
 *   has lapsed once already and canonical URLs must not be baked into rows.
 *
 * Those can legitimately disagree. An AIFF master is a perfectly good
 * deliverable that no browser will play, so it is accepted for delivery and
 * the preview is left alone, with a warning saying exactly that rather than
 * a track that renders as playable and then fails.
 *
 * One shipped master per song: the release-track row holds a single pointer,
 * so flagging a second file replaces the first rather than adding to it.
 * There is no is_ship column anywhere — the pointer IS the flag, and a
 * boolean beside it could only ever drift out of agreement with what
 * actually gets delivered.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import { MEDIA_PROXY_PREFIX, unplayableReason } from '@/lib/release/audioSource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve piece → track → release-track in one place, or explain why not. */
async function locate(pieceId: string) {
  const pieceRows = await queryDatabase(
    'SELECT id, project_id, track_id, kind FROM warehouse_pieces WHERE id = ?',
    [pieceId]
  );
  const piece = pieceRows?.[0];
  if (!piece) return { error: 'Piece not found', status: 404 as const };
  if (!piece.track_id) {
    return {
      error: 'Only a song piece can ship a master — this one is not pinned to a track.',
      status: 400 as const,
    };
  }

  const projectRows = await queryDatabase(
    'SELECT album_id FROM warehouse_projects WHERE id = ?',
    [piece.project_id]
  );
  const albumId = projectRows?.[0]?.album_id;
  if (!albumId) {
    return { error: 'This project has no album linked', status: 400 as const };
  }

  const releaseRows = await queryDatabase(
    'SELECT id FROM distribution_releases WHERE internal_album_id = ?',
    [albumId]
  );
  const releaseId = releaseRows?.[0]?.id;
  if (!releaseId) {
    return { error: 'No distribution release exists for this album yet', status: 400 as const };
  }

  const rtRows = await queryDatabase(
    'SELECT id, audio_r2_key FROM distribution_release_tracks WHERE release_id = ? AND internal_track_id = ?',
    [releaseId, piece.track_id]
  );
  const releaseTrack = rtRows?.[0];
  if (!releaseTrack) {
    return {
      error: 'This song has no row on the delivery sheet yet',
      status: 400 as const,
    };
  }

  return { piece, albumId, releaseId, releaseTrack };
}

/** Keep the album's totals honest after any track duration changes. */
async function recomputeAlbumTotals(albumId: string) {
  const rows = await queryDatabase(
    'SELECT COUNT(*) AS n, COALESCE(SUM(duration), 0) AS total FROM tracks WHERE album_id = ?',
    [albumId]
  );
  const n = Number(rows?.[0]?.n ?? 0);
  const total = Math.round(Number(rows?.[0]?.total ?? 0));
  await executeQuery(
    "UPDATE albums SET total_tracks = ?, total_duration = ?, updated_at = datetime('now') WHERE id = ?",
    [n, total, albumId]
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id: pieceId } = await params;
    const body = (await req.json()) as { fileId?: string; durationSeconds?: number };
    if (!body.fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    const found = await locate(pieceId);
    if ('error' in found) {
      return NextResponse.json({ error: found.error }, { status: found.status });
    }
    const { piece, albumId, releaseTrack } = found;

    const fileRows = await queryDatabase(
      'SELECT id, piece_id, r2_key, original_filename, status, category FROM warehouse_files WHERE id = ?',
      [body.fileId]
    );
    const file = fileRows?.[0];
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    if (file.piece_id !== pieceId) {
      return NextResponse.json(
        { error: 'That file belongs to a different piece' },
        { status: 400 }
      );
    }
    if (file.status !== 'ready') {
      return NextResponse.json(
        { error: `That file is still ${file.status}` },
        { status: 409 }
      );
    }

    // --- delivery: the distributor gets this object ---
    await executeQuery(
      `UPDATE distribution_release_tracks
          SET audio_r2_key = ?, audio_url = ?, updated_at = datetime('now')
        WHERE id = ?`,
      [file.r2_key, `warehouse:${file.id}`, releaseTrack.id]
    );

    // --- preview: only if a browser can actually play it ---
    const cannotPlay = unplayableReason(file.original_filename);
    let previewUpdated = false;

    if (!cannotPlay) {
      const duration =
        body.durationSeconds != null && Number.isFinite(body.durationSeconds)
          ? Math.round(Number(body.durationSeconds))
          : null;

      const sets = ["audio_url = ?", 'source_file_id = ?', "audio_status = 'ready'"];
      const values: unknown[] = [`${MEDIA_PROXY_PREFIX}${file.r2_key}`, file.id];
      if (duration && duration > 0) {
        sets.push('duration = ?');
        values.push(duration);
      }
      values.push(piece.track_id);

      await executeQuery(
        `UPDATE tracks SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
        values
      );
      previewUpdated = true;
      await recomputeAlbumTotals(albumId);
    }

    // Duration is worth recording on the delivery sheet either way — the
    // distributor asks for it, and the browser measured it before upload.
    if (body.durationSeconds != null && Number.isFinite(body.durationSeconds)) {
      await executeQuery(
        `UPDATE distribution_release_tracks SET duration_seconds = ? WHERE id = ?`,
        [Math.round(Number(body.durationSeconds)), releaseTrack.id]
      );
    }

    return NextResponse.json({
      success: true,
      shipped: file.r2_key,
      previewUpdated,
      warning: cannotPlay
        ? `Flagged for delivery, but the preview was left alone. ${cannotPlay}`
        : null,
    });
  } catch (error) {
    console.error('Ship failed:', error);
    return NextResponse.json({ error: 'Failed to flag that master' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id: pieceId } = await params;
    const found = await locate(pieceId);
    if ('error' in found) {
      return NextResponse.json({ error: found.error }, { status: found.status });
    }
    const { piece, albumId, releaseTrack } = found;

    await executeQuery(
      `UPDATE distribution_release_tracks
          SET audio_r2_key = NULL, audio_url = NULL, updated_at = datetime('now')
        WHERE id = ?`,
      [releaseTrack.id]
    );

    // Only clear the preview if it was pointing at the file we just unshipped
    // — a track transcoded to .web.m4a should keep playing.
    const trackRows = await queryDatabase(
      'SELECT audio_url, source_file_id FROM tracks WHERE id = ?',
      [piece.track_id]
    );
    const track = trackRows?.[0];
    const wasFromWarehouse =
      track?.audio_url && String(track.audio_url).startsWith(MEDIA_PROXY_PREFIX + 'warehouse/');

    if (wasFromWarehouse) {
      await executeQuery(
        `UPDATE tracks
            SET audio_url = NULL, source_file_id = NULL, audio_status = 'pending',
                updated_at = datetime('now')
          WHERE id = ?`,
        [piece.track_id]
      );
      await recomputeAlbumTotals(albumId);
    }

    return NextResponse.json({ success: true, previewCleared: !!wasFromWarehouse });
  } catch (error) {
    console.error('Unship failed:', error);
    return NextResponse.json({ error: 'Failed to clear that flag' }, { status: 500 });
  }
}
