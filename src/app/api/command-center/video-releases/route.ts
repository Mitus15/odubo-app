import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

// GET /api/command-center/video-releases - List all video releases
export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const videoType = searchParams.get('videoType');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    let query = `
      SELECT
        id,
        title,
        artist_name as artistName,
        video_type as videoType,
        description,
        linked_track_id as linkedTrackId,
        linked_release_id as linkedReleaseId,
        isrc,
        thumbnail_url as thumbnailUrl,
        premiere_enabled as premiereEnabled,
        premiere_date as premiereDate,
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
        internal_video_id as internalVideoId,
        created_at as createdAt,
        updated_at as updatedAt,
        scheduled_at as scheduledAt,
        published_at as publishedAt
      FROM video_releases
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (videoType && videoType !== 'all') {
      conditions.push('video_type = ?');
      params.push(videoType);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const result = await db.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM video_releases';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET
    const countResult = await db
      .prepare(countQuery)
      .bind(...countParams)
      .first<{ total: number }>();

    const releases = (result.results || []).map((row: any) => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      premiereEnabled: Boolean(row.premiereEnabled),
      contentIdEnabled: Boolean(row.contentIdEnabled),
      madeForKids: Boolean(row.madeForKids),
      ageRestricted: Boolean(row.ageRestricted),
    }));

    return NextResponse.json({
      releases,
      total: countResult?.total || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Video Releases API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch video releases' }, { status: 500 });
  }
}

// POST /api/command-center/video-releases - Create a new video release
export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const body = await request.json();

    const {
      title,
      artistName,
      videoType,
      description,
      linkedTrackId,
      linkedReleaseId,
      isrc,
      thumbnailUrl,
      premiereEnabled = false,
      premiereDate,
      premiereCountdownTheme,
      contentIdEnabled = true,
      contentIdPolicy = 'monetize',
      genre,
      tags = [],
      language = 'en',
      madeForKids = false,
      ageRestricted = false,
      director,
      producer,
      cinematographer,
      editor,
      internalVideoId,
    } = body;

    if (!title || !artistName || !videoType) {
      return NextResponse.json(
        { error: 'title, artistName, and videoType are required' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    await db
      .prepare(
        `
        INSERT INTO video_releases (
          id, title, artist_name, video_type, description,
          linked_track_id, linked_release_id, isrc,
          thumbnail_url, premiere_enabled, premiere_date, premiere_countdown_theme,
          content_id_enabled, content_id_policy,
          status, genre, tags, language,
          made_for_kids, age_restricted,
          director, producer, cinematographer, editor,
          internal_video_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        id,
        title,
        artistName,
        videoType,
        description || null,
        linkedTrackId || null,
        linkedReleaseId || null,
        isrc || null,
        thumbnailUrl || null,
        premiereEnabled ? 1 : 0,
        premiereDate || null,
        premiereCountdownTheme || null,
        contentIdEnabled ? 1 : 0,
        contentIdPolicy,
        genre || null,
        JSON.stringify(tags),
        language,
        madeForKids ? 1 : 0,
        ageRestricted ? 1 : 0,
        director || null,
        producer || null,
        cinematographer || null,
        editor || null,
        internalVideoId || null,
        now,
        now
      )
      .run();

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error('[Video Releases API] POST error:', error);
    return NextResponse.json({ error: 'Failed to create video release' }, { status: 500 });
  }
}

export const runtime = 'edge';
