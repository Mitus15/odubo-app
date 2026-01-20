import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

// GET /api/command-center/releases/[id] - Get a single release
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const releases = await queryDatabase(
      `
      SELECT
        id,
        title,
        release_type as releaseType,
        artist_name as artistName,
        label_name as labelName,
        upc,
        catalog_number as catalogNumber,
        cover_art_url as coverArtUrl,
        original_release_date as originalReleaseDate,
        distribution_release_date as distributionReleaseDate,
        distributor,
        distributor_release_id as distributorReleaseId,
        status,
        price_tier as priceTier,
        territories,
        explicit_content as explicitContent,
        genre,
        subgenre,
        language,
        copyright_line as copyrightLine,
        phonographic_line as phonographicLine,
        internal_album_id as internalAlbumId,
        created_at as createdAt,
        updated_at as updatedAt,
        submitted_at as submittedAt,
        live_at as liveAt
      FROM distribution_releases
      WHERE id = ?
    `,
      [id]
    );
    const release = releases?.[0];

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    // Get tracks
    const tracks = await queryDatabase(
      `
      SELECT
        id,
        release_id as releaseId,
        disc_number as discNumber,
        track_number as trackNumber,
        title,
        version,
        artist_name as artistName,
        featuring_artists as featuringArtists,
        isrc,
        audio_url as audioUrl,
        duration_seconds as durationSeconds,
        composers,
        producers,
        performers,
        royalty_splits as royaltySplits,
        explicit,
        instrumental,
        lyrics,
        lyrics_language as lyricsLanguage,
        internal_track_id as internalTrackId,
        status,
        rejection_reason as rejectionReason,
        created_at as createdAt,
        updated_at as updatedAt
      FROM distribution_release_tracks
      WHERE release_id = ?
      ORDER BY disc_number, track_number
    `,
      [id]
    ) || [];

    // Get DSP targets
    const dspTargets = await queryDatabase(
      `
      SELECT
        id,
        release_id as releaseId,
        dsp,
        enabled,
        external_id as externalId,
        external_url as externalUrl,
        status,
        live_at as liveAt,
        created_at as createdAt
      FROM distribution_release_dsps
      WHERE release_id = ?
    `,
      [id]
    ) || [];

    return NextResponse.json({
      release: {
        ...(release as any),
        territories: (release as any).territories
          ? JSON.parse((release as any).territories)
          : ['worldwide'],
        explicitContent: Boolean((release as any).explicitContent),
        tracks: tracks.map((t: any) => ({
          ...t,
          featuringArtists: t.featuringArtists ? JSON.parse(t.featuringArtists) : [],
          composers: t.composers ? JSON.parse(t.composers) : [],
          producers: t.producers ? JSON.parse(t.producers) : [],
          performers: t.performers ? JSON.parse(t.performers) : [],
          royaltySplits: t.royaltySplits ? JSON.parse(t.royaltySplits) : [],
          explicit: Boolean(t.explicit),
          instrumental: Boolean(t.instrumental),
        })),
        dspTargets: dspTargets.map((d: any) => ({
          ...d,
          enabled: Boolean(d.enabled),
        })),
      },
    });
  } catch (error) {
    console.error('[Releases API] GET [id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch release' }, { status: 500 });
  }
}

// PATCH /api/command-center/releases/[id] - Update a release
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json();

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      title: 'title',
      releaseType: 'release_type',
      artistName: 'artist_name',
      labelName: 'label_name',
      upc: 'upc',
      catalogNumber: 'catalog_number',
      coverArtUrl: 'cover_art_url',
      originalReleaseDate: 'original_release_date',
      distributionReleaseDate: 'distribution_release_date',
      distributor: 'distributor',
      distributorReleaseId: 'distributor_release_id',
      status: 'status',
      priceTier: 'price_tier',
      explicitContent: 'explicit_content',
      genre: 'genre',
      subgenre: 'subgenre',
      language: 'language',
      copyrightLine: 'copyright_line',
      phonographicLine: 'phonographic_line',
      internalAlbumId: 'internal_album_id',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`);
        if (key === 'explicitContent') {
          values.push(body[key] ? 1 : 0);
        } else {
          values.push(body[key] || null);
        }
      }
    }

    // Handle territories separately (needs JSON)
    if (body.territories !== undefined) {
      updates.push('territories = ?');
      values.push(JSON.stringify(body.territories));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await executeQuery(
      `UPDATE distribution_releases SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Releases API] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update release' }, { status: 500 });
  }
}

// DELETE /api/command-center/releases/[id] - Delete a release
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if release exists and is a draft
    const releases = await queryDatabase(
      'SELECT status FROM distribution_releases WHERE id = ?',
      [id]
    );
    const release = releases?.[0] as { status: string } | undefined;

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    if (release.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft releases can be deleted' },
        { status: 400 }
      );
    }

    // Delete tracks first (cascade should handle this, but being explicit)
    await executeQuery('DELETE FROM distribution_release_tracks WHERE release_id = ?', [id]);
    await executeQuery('DELETE FROM distribution_release_dsps WHERE release_id = ?', [id]);
    await executeQuery('DELETE FROM distribution_releases WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Releases API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete release' }, { status: 500 });
  }
}

export const runtime = 'edge';
