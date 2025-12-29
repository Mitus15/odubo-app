import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

// GET /api/command-center/video-releases/[id]/assets - List assets for a release
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;
    const { id } = await params;

    const assets = await db
      .prepare(
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
      `
      )
      .bind(id)
      .all();

    return NextResponse.json({
      assets: (assets.results || []).map((a: any) => ({
        ...a,
        isPrimary: Boolean(a.isPrimary),
      })),
    });
  } catch (error) {
    console.error('[Video Assets API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch video assets' }, { status: 500 });
  }
}

// POST /api/command-center/video-releases/[id]/assets - Add an asset to a release
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;
    const { id: releaseId } = await params;

    const body = (await request.json()) as {
      label?: string;
      versionType?: string;
      fileUrl?: string;
      r2Key?: string;
      cloudflareUid?: string;
      durationSeconds?: number;
      width?: number;
      height?: number;
      aspectRatio?: string;
      framerate?: number;
      codec?: string;
      bitrateKbps?: number;
      fileSizeBytes?: number;
      audioCodec?: string;
      audioBitrateKbps?: number;
      audioChannels?: number;
      isPrimary?: boolean;
    };

    const {
      label,
      versionType,
      fileUrl,
      r2Key,
      cloudflareUid,
      durationSeconds,
      width,
      height,
      aspectRatio,
      framerate,
      codec,
      bitrateKbps,
      fileSizeBytes,
      audioCodec,
      audioBitrateKbps,
      audioChannels,
      isPrimary = false,
    } = body;

    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const assetId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    // If this is primary, unset any existing primary
    if (isPrimary) {
      await db
        .prepare('UPDATE video_assets SET is_primary = 0 WHERE release_id = ?')
        .bind(releaseId)
        .run();
    }

    await db
      .prepare(
        `
        INSERT INTO video_assets (
          id, release_id, label, version_type, file_url, r2_key, cloudflare_uid,
          duration_seconds, width, height, aspect_ratio, framerate, codec, bitrate_kbps,
          file_size_bytes, audio_codec, audio_bitrate_kbps, audio_channels,
          status, is_primary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)
      `
      )
      .bind(
        assetId,
        releaseId,
        label,
        versionType || 'master',
        fileUrl || null,
        r2Key || null,
        cloudflareUid || null,
        durationSeconds || null,
        width || null,
        height || null,
        aspectRatio || null,
        framerate || null,
        codec || null,
        bitrateKbps || null,
        fileSizeBytes || null,
        audioCodec || null,
        audioBitrateKbps || null,
        audioChannels || null,
        isPrimary ? 1 : 0,
        now,
        now
      )
      .run();

    // Update release's primary asset if this is primary
    if (isPrimary) {
      await db
        .prepare('UPDATE video_releases SET primary_asset_id = ?, updated_at = ? WHERE id = ?')
        .bind(assetId, now, releaseId)
        .run();

      // Also set thumbnail from Cloudflare Stream if available
      if (cloudflareUid) {
        const thumbnailUrl = `https://videodelivery.net/${cloudflareUid}/thumbnails/thumbnail.jpg`;
        await db
          .prepare('UPDATE video_releases SET thumbnail_url = ? WHERE id = ? AND thumbnail_url IS NULL')
          .bind(thumbnailUrl, releaseId)
          .run();
      }
    }

    return NextResponse.json({ id: assetId, success: true });
  } catch (error) {
    console.error('[Video Assets API] POST error:', error);
    return NextResponse.json({ error: 'Failed to create video asset' }, { status: 500 });
  }
}

export const runtime = 'edge';
