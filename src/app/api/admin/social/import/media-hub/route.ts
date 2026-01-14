import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

// GET: List available media hub videos for import
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 50);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const excludeImported = searchParams.get('excludeImported') !== 'false';

    // Build WHERE clauses - get non-clip videos (longer content)
    const conditions: string[] = [
      "(v.type IS NULL OR v.type != 'clip')", // Non-clips
      "v.uid IS NOT NULL", // Must have video UID
    ];
    const params: any[] = [];

    // Search filter
    if (search) {
      conditions.push('(v.title LIKE ? OR v.description LIKE ? OR v.artist_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Exclude videos already imported to Social CMS
    if (excludeImported) {
      conditions.push("NOT EXISTS (SELECT 1 FROM social_content sc WHERE sc.hub_video_id = v.id AND sc.import_source = 'media_hub')");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await queryDatabase(
      `SELECT COUNT(*) as total FROM videos v ${whereClause}`,
      params
    );
    const total = countResult?.[0]?.total || 0;

    // Get videos
    const videos = await queryDatabase(
      `SELECT
        v.id,
        v.title,
        v.artist_name,
        v.description,
        v.uid,
        v.url,
        v.mp4_url,
        v.duration,
        v.duration_seconds,
        v.poster_url,
        v.thumbnail,
        v.type,
        v.status,
        v.created_at,
        CASE WHEN sc.id IS NOT NULL THEN 1 ELSE 0 END as already_imported
      FROM videos v
      LEFT JOIN social_content sc ON sc.hub_video_id = v.id AND sc.import_source = 'media_hub'
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      videos: videos || [],
      total,
      limit,
      offset,
      hasMore: offset + (videos?.length || 0) < total,
    });
  } catch (e: any) {
    console.error('Error listing media hub videos:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to list media hub videos') },
      { status: 500 }
    );
  }
}

// POST: Import a media hub video into Social CMS
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { video_id, folder_id, title, scheduled_for } = body;

    if (!video_id) {
      return NextResponse.json({ error: 'video_id required' }, { status: 400 });
    }

    // Get the video details
    const videos = await queryDatabase(
      `SELECT id, title, uid, duration_seconds, poster_url, thumbnail, type
       FROM videos
       WHERE id = ? AND (type IS NULL OR type != 'clip')`,
      [video_id]
    );

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const video = videos[0];

    // Check if already imported
    const existing = await queryDatabase(
      `SELECT id FROM social_content WHERE hub_video_id = ? AND import_source = 'media_hub'`,
      [video_id]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Video already imported' }, { status: 409 });
    }

    // Determine thumbnail URL
    const thumbnailUrl = video.poster_url || video.thumbnail ||
      (video.uid ? `https://videodelivery.net/${video.uid}/thumbnails/thumbnail.jpg` : null);

    // Create social content entry
    await queryDatabase(
      `INSERT INTO social_content (
        folder_id,
        source_type,
        import_source,
        hub_video_id,
        upload_uid,
        thumbnail_url,
        duration,
        title,
        status,
        scheduled_for,
        created_at,
        updated_at
      ) VALUES (?, 'upload', 'media_hub', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        folder_id || null,
        video_id,
        video.uid,
        thumbnailUrl,
        video.duration_seconds || null,
        title || video.title || 'Imported Video',
        scheduled_for ? 'scheduled' : 'draft',
        scheduled_for || null,
      ]
    );

    // Get the created entry
    const created = await queryDatabase(
      `SELECT * FROM social_content WHERE hub_video_id = ? AND import_source = 'media_hub' ORDER BY id DESC LIMIT 1`,
      [video_id]
    );

    return NextResponse.json({
      success: true,
      content: created?.[0] || null,
    });
  } catch (e: any) {
    console.error('Error importing media hub video:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to import media hub video') },
      { status: 500 }
    );
  }
}
