import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

// GET /api/command-center/video-releases/[id] - Get a single video release
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
        artist_name as artistName,
        video_type as videoType,
        description,
        description_template as descriptionTemplate,
        linked_track_id as linkedTrackId,
        linked_release_id as linkedReleaseId,
        isrc,
        primary_asset_id as primaryAssetId,
        thumbnail_url as thumbnailUrl,
        thumbnail_r2_key as thumbnailR2Key,
        custom_thumbnails as customThumbnails,
        premiere_enabled as premiereEnabled,
        premiere_date as premiereDate,
        premiere_countdown_theme as premiereCountdownTheme,
        content_id_enabled as contentIdEnabled,
        content_id_policy as contentIdPolicy,
        status,
        genre,
        tags,
        language,
        made_for_kids as madeForKids,
        age_restricted as ageRestricted,
        director,
        producer,
        cinematographer,
        editor,
        credits_json as creditsJson,
        internal_video_id as internalVideoId,
        created_at as createdAt,
        updated_at as updatedAt,
        scheduled_at as scheduledAt,
        published_at as publishedAt
      FROM video_releases
      WHERE id = ?
    `,
      [id]
    );
    const release = releases?.[0];

    if (!release) {
      return NextResponse.json({ error: 'Video release not found' }, { status: 404 });
    }

    // Get assets
    const assets = await queryDatabase(
      `
      SELECT
        id,
        release_id as releaseId,
        label,
        version_type as versionType,
        file_url as fileUrl,
        r2_key as r2Key,
        cloudflare_uid as cloudflareUid,
        duration_seconds as durationSeconds,
        width,
        height,
        aspect_ratio as aspectRatio,
        framerate,
        codec,
        bitrate_kbps as bitrateKbps,
        file_size_bytes as fileSizeBytes,
        audio_codec as audioCodec,
        audio_bitrate_kbps as audioBitrateKbps,
        audio_channels as audioChannels,
        status,
        processing_error as processingError,
        is_primary as isPrimary,
        created_at as createdAt,
        updated_at as updatedAt
      FROM video_assets
      WHERE release_id = ?
      ORDER BY is_primary DESC, created_at ASC
    `,
      [id]
    ) || [];

    // Get platform targets
    const platforms = await queryDatabase(
      `
      SELECT
        id,
        release_id as releaseId,
        platform,
        enabled,
        asset_id as assetId,
        title_override as titleOverride,
        description_override as descriptionOverride,
        tags_override as tagsOverride,
        youtube_category as youtubeCategory,
        youtube_playlist_id as youtubePlaylistId,
        youtube_end_screen as youtubeEndScreen,
        youtube_cards as youtubeCards,
        external_id as externalId,
        external_url as externalUrl,
        status,
        status_message as statusMessage,
        views,
        likes,
        comments,
        metrics_updated_at as metricsUpdatedAt,
        scheduled_at as scheduledAt,
        published_at as publishedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM video_platforms
      WHERE release_id = ?
    `,
      [id]
    ) || [];

    return NextResponse.json({
      release: {
        ...(release as any),
        tags: (release as any).tags ? JSON.parse((release as any).tags) : [],
        customThumbnails: (release as any).customThumbnails
          ? JSON.parse((release as any).customThumbnails)
          : [],
        creditsJson: (release as any).creditsJson
          ? JSON.parse((release as any).creditsJson)
          : {},
        premiereEnabled: Boolean((release as any).premiereEnabled),
        contentIdEnabled: Boolean((release as any).contentIdEnabled),
        madeForKids: Boolean((release as any).madeForKids),
        ageRestricted: Boolean((release as any).ageRestricted),
        assets: assets.map((a: any) => ({
          ...a,
          isPrimary: Boolean(a.isPrimary),
        })),
        platforms: platforms.map((p: any) => ({
          ...p,
          enabled: Boolean(p.enabled),
          tagsOverride: p.tagsOverride ? JSON.parse(p.tagsOverride) : [],
          youtubeEndScreen: p.youtubeEndScreen ? JSON.parse(p.youtubeEndScreen) : null,
          youtubeCards: p.youtubeCards ? JSON.parse(p.youtubeCards) : null,
        })),
      },
    });
  } catch (error) {
    console.error('[Video Releases API] GET [id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch video release' }, { status: 500 });
  }
}

// PATCH /api/command-center/video-releases/[id] - Update a video release
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
      artistName: 'artist_name',
      videoType: 'video_type',
      description: 'description',
      descriptionTemplate: 'description_template',
      linkedTrackId: 'linked_track_id',
      linkedReleaseId: 'linked_release_id',
      isrc: 'isrc',
      primaryAssetId: 'primary_asset_id',
      thumbnailUrl: 'thumbnail_url',
      thumbnailR2Key: 'thumbnail_r2_key',
      premiereDate: 'premiere_date',
      premiereCountdownTheme: 'premiere_countdown_theme',
      contentIdPolicy: 'content_id_policy',
      status: 'status',
      genre: 'genre',
      language: 'language',
      director: 'director',
      producer: 'producer',
      cinematographer: 'cinematographer',
      editor: 'editor',
      internalVideoId: 'internal_video_id',
      scheduledAt: 'scheduled_at',
      publishedAt: 'published_at',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`);
        values.push(body[key] || null);
      }
    }

    // Handle boolean fields
    const boolFields: Record<string, string> = {
      premiereEnabled: 'premiere_enabled',
      contentIdEnabled: 'content_id_enabled',
      madeForKids: 'made_for_kids',
      ageRestricted: 'age_restricted',
    };

    for (const [key, dbField] of Object.entries(boolFields)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`);
        values.push(body[key] ? 1 : 0);
      }
    }

    // Handle JSON fields
    if (body.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(body.tags));
    }

    if (body.customThumbnails !== undefined) {
      updates.push('custom_thumbnails = ?');
      values.push(JSON.stringify(body.customThumbnails));
    }

    if (body.creditsJson !== undefined) {
      updates.push('credits_json = ?');
      values.push(JSON.stringify(body.creditsJson));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await executeQuery(
      `UPDATE video_releases SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Video Releases API] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update video release' }, { status: 500 });
  }
}

// DELETE /api/command-center/video-releases/[id] - Delete a video release
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if release exists and is a draft
    const releases = await queryDatabase(
      'SELECT status FROM video_releases WHERE id = ?',
      [id]
    );
    const release = releases?.[0] as { status: string } | undefined;

    if (!release) {
      return NextResponse.json({ error: 'Video release not found' }, { status: 404 });
    }

    if (release.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft video releases can be deleted' },
        { status: 400 }
      );
    }

    // Delete related records first
    await executeQuery('DELETE FROM video_platforms WHERE release_id = ?', [id]);
    await executeQuery('DELETE FROM video_assets WHERE release_id = ?', [id]);
    await executeQuery('DELETE FROM video_releases WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Video Releases API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete video release' }, { status: 500 });
  }
}

export const runtime = 'edge';
