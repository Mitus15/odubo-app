import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

// GET: List available clips for import into Social CMS
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

    // Build WHERE clauses
    const conditions: string[] = [
      "v.type = 'clip'",
      "(v.is_public = 1 OR v.is_public IS NULL)",
      "COALESCE(v.status, 'published') != 'archived'",
    ];
    const params: any[] = [];

    // Optional search filter
    if (search) {
      conditions.push("(v.title LIKE ? OR v.description LIKE ? OR v.artist_name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Exclude clips already imported to Social CMS
    if (excludeImported) {
      conditions.push("NOT EXISTS (SELECT 1 FROM social_content sc WHERE sc.video_id = v.id AND sc.source_type = 'clip')");
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await queryDatabase(
      `SELECT COUNT(*) as total FROM videos v WHERE ${whereClause}`,
      params
    );
    const total = countResult?.[0]?.total || 0;

    // Get clips
    const clips = await queryDatabase(
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
        v.shopify_product_handle,
        v.created_at,
        CASE WHEN sc.id IS NOT NULL THEN 1 ELSE 0 END as already_imported
      FROM videos v
      LEFT JOIN social_content sc ON sc.video_id = v.id AND sc.source_type = 'clip'
      WHERE ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      clips: clips || [],
      total,
      limit,
      offset,
      hasMore: offset + (clips?.length || 0) < total,
    });
  } catch (e: any) {
    console.error('Error listing clips:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to list clips') },
      { status: 500 }
    );
  }
}

// POST: Import a clip into Social CMS
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { video_id, folder_id, title } = body;

    if (!video_id) {
      return NextResponse.json({ error: 'video_id required' }, { status: 400 });
    }

    // Get the clip details
    const clips = await queryDatabase(
      `SELECT id, title, uid, duration_seconds, poster_url, thumbnail
       FROM videos
       WHERE id = ? AND type = 'clip'`,
      [video_id]
    );

    if (!clips || clips.length === 0) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    const clip = clips[0];

    // Check if already imported
    const existing = await queryDatabase(
      `SELECT id FROM social_content WHERE video_id = ? AND source_type = 'clip'`,
      [video_id]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Clip already imported' }, { status: 409 });
    }

    // Create social content entry
    const thumbnailUrl = clip.poster_url || clip.thumbnail ||
      (clip.uid ? `https://videodelivery.net/${clip.uid}/thumbnails/thumbnail.jpg` : null);

    await queryDatabase(
      `INSERT INTO social_content (
        folder_id,
        source_type,
        video_id,
        upload_uid,
        thumbnail_url,
        duration,
        title,
        status,
        created_at,
        updated_at
      ) VALUES (?, 'clip', ?, ?, ?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        folder_id || null,
        video_id,
        clip.uid,
        thumbnailUrl,
        clip.duration_seconds || null,
        title || clip.title || 'Imported Clip',
      ]
    );

    // Get the created entry
    const created = await queryDatabase(
      `SELECT * FROM social_content WHERE video_id = ? AND source_type = 'clip' ORDER BY id DESC LIMIT 1`,
      [video_id]
    );

    return NextResponse.json({
      success: true,
      content: created?.[0] || null,
    });
  } catch (e: any) {
    console.error('Error importing clip:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to import clip') },
      { status: 500 }
    );
  }
}
