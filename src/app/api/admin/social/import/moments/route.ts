import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

// GET: List available moments photos for import
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const gallery_id = searchParams.get('gallery_id') || '';
    const moderated = searchParams.get('moderated'); // 'true', 'false', or null for all
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 50);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const excludeImported = searchParams.get('excludeImported') !== 'false';

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: any[] = [];

    // Gallery filter
    if (gallery_id) {
      conditions.push('gp.gallery_id = ?');
      params.push(gallery_id);
    }

    // Moderated filter
    if (moderated === 'true') {
      conditions.push('gp.moderated = 1');
    } else if (moderated === 'false') {
      conditions.push('gp.moderated = 0');
    }

    // Exclude photos already imported to Social CMS
    if (excludeImported) {
      conditions.push("NOT EXISTS (SELECT 1 FROM social_content sc WHERE sc.moments_photo_id = gp.id AND sc.import_source = 'moments')");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await queryDatabase(
      `SELECT COUNT(*) as total
       FROM gallery_photos gp
       LEFT JOIN galleries g ON gp.gallery_id = g.id
       ${whereClause}`,
      params
    );
    const total = countResult?.[0]?.total || 0;

    // Get photos
    const photos = await queryDatabase(
      `SELECT
        gp.id,
        gp.gallery_id,
        gp.uid,
        gp.r2_key,
        gp.thumbnail_key,
        gp.original_filename,
        gp.user_name,
        gp.moderated,
        gp.created_at,
        g.title as gallery_title,
        g.code as gallery_code,
        CASE WHEN sc.id IS NOT NULL THEN 1 ELSE 0 END as already_imported
      FROM gallery_photos gp
      LEFT JOIN galleries g ON gp.gallery_id = g.id
      LEFT JOIN social_content sc ON sc.moments_photo_id = gp.id AND sc.import_source = 'moments'
      ${whereClause}
      ORDER BY gp.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get galleries for filter
    const galleries = await queryDatabase(
      `SELECT id, code, title FROM galleries ORDER BY created_at DESC`,
      []
    );

    return NextResponse.json({
      photos: photos || [],
      galleries: galleries || [],
      total,
      limit,
      offset,
      hasMore: offset + (photos?.length || 0) < total,
    });
  } catch (e: any) {
    console.error('Error listing moments:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to list moments') },
      { status: 500 }
    );
  }
}

// POST: Import a moments photo into Social CMS
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { photo_id, folder_id, title, scheduled_for } = body;

    if (!photo_id) {
      return NextResponse.json({ error: 'photo_id required' }, { status: 400 });
    }

    // Get the photo details
    const photos = await queryDatabase(
      `SELECT
        gp.id, gp.uid, gp.r2_key, gp.thumbnail_key,
        gp.original_filename, gp.user_name,
        g.title as gallery_title
       FROM gallery_photos gp
       LEFT JOIN galleries g ON gp.gallery_id = g.id
       WHERE gp.id = ?`,
      [photo_id]
    );

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const photo = photos[0];

    // Check if already imported
    const existing = await queryDatabase(
      `SELECT id FROM social_content WHERE moments_photo_id = ? AND import_source = 'moments'`,
      [photo_id]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Photo already imported' }, { status: 409 });
    }

    // Determine thumbnail URL
    const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';
    const thumbnailUrl = photo.thumbnail_key
      ? `${r2BaseUrl}/${photo.thumbnail_key}`
      : `${r2BaseUrl}/${photo.r2_key}`;

    // Generate a default title
    const defaultTitle = photo.user_name
      ? `Moment by ${photo.user_name}`
      : photo.gallery_title
        ? `Moment from ${photo.gallery_title}`
        : 'Moments Photo';

    // Create social content entry
    await queryDatabase(
      `INSERT INTO social_content (
        folder_id,
        source_type,
        import_source,
        moments_photo_id,
        thumbnail_url,
        title,
        status,
        scheduled_for,
        created_at,
        updated_at
      ) VALUES (?, 'upload', 'moments', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        folder_id || null,
        photo_id,
        thumbnailUrl,
        title || defaultTitle,
        scheduled_for ? 'scheduled' : 'draft',
        scheduled_for || null,
      ]
    );

    // Get the created entry
    const created = await queryDatabase(
      `SELECT * FROM social_content WHERE moments_photo_id = ? AND import_source = 'moments' ORDER BY id DESC LIMIT 1`,
      [photo_id]
    );

    return NextResponse.json({
      success: true,
      content: created?.[0] || null,
    });
  } catch (e: any) {
    console.error('Error importing moments photo:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to import moments photo') },
      { status: 500 }
    );
  }
}
