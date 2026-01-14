import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

// GET: List available brand assets for import
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const type = searchParams.get('type') || ''; // image, video
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 50);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const excludeImported = searchParams.get('excludeImported') !== 'false';

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: any[] = [];

    // Search filter
    if (search) {
      conditions.push('(a.title LIKE ? OR a.description LIKE ? OR a.tags LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Category filter
    if (category) {
      conditions.push('ac.slug = ?');
      params.push(category);
    }

    // Type filter
    if (type) {
      conditions.push('a.asset_type = ?');
      params.push(type);
    }

    // Exclude assets already imported to Social CMS
    if (excludeImported) {
      conditions.push("NOT EXISTS (SELECT 1 FROM social_content sc WHERE sc.asset_id = a.id AND sc.import_source = 'brand_assets')");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await queryDatabase(
      `SELECT COUNT(*) as total
       FROM assets a
       LEFT JOIN asset_albums aa ON a.album_id = aa.id
       LEFT JOIN asset_categories ac ON aa.category_id = ac.id
       ${whereClause}`,
      params
    );
    const total = countResult?.[0]?.total || 0;

    // Get assets
    const assets = await queryDatabase(
      `SELECT
        a.id,
        a.asset_type,
        a.r2_key,
        a.r2_key_thumb,
        a.r2_key_web,
        a.stream_uid,
        a.original_filename,
        a.mime_type,
        a.file_size,
        a.width,
        a.height,
        a.duration,
        a.title,
        a.description,
        a.alt_text,
        a.photographer,
        a.tags,
        a.product_handle,
        a.created_at,
        aa.name as album_name,
        ac.name as category_name,
        ac.slug as category_slug,
        CASE WHEN sc.id IS NOT NULL THEN 1 ELSE 0 END as already_imported
      FROM assets a
      LEFT JOIN asset_albums aa ON a.album_id = aa.id
      LEFT JOIN asset_categories ac ON aa.category_id = ac.id
      LEFT JOIN social_content sc ON sc.asset_id = a.id AND sc.import_source = 'brand_assets'
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get categories for filter
    const categories = await queryDatabase(
      `SELECT slug, name FROM asset_categories ORDER BY sort_order`,
      []
    );

    return NextResponse.json({
      assets: assets || [],
      categories: categories || [],
      total,
      limit,
      offset,
      hasMore: offset + (assets?.length || 0) < total,
    });
  } catch (e: any) {
    console.error('Error listing brand assets:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to list brand assets') },
      { status: 500 }
    );
  }
}

// POST: Import a brand asset into Social CMS
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { asset_id, folder_id, title, scheduled_for } = body;

    if (!asset_id) {
      return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
    }

    // Get the asset details
    const assets = await queryDatabase(
      `SELECT
        a.id, a.asset_type, a.r2_key, a.r2_key_thumb, a.r2_key_web,
        a.stream_uid, a.title, a.description, a.duration
       FROM assets a
       WHERE a.id = ?`,
      [asset_id]
    );

    if (!assets || assets.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const asset = assets[0];

    // Check if already imported
    const existing = await queryDatabase(
      `SELECT id FROM social_content WHERE asset_id = ? AND import_source = 'brand_assets'`,
      [asset_id]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Asset already imported' }, { status: 409 });
    }

    // Determine thumbnail URL
    let thumbnailUrl: string | null = null;
    if (asset.asset_type === 'video' && asset.stream_uid) {
      thumbnailUrl = `https://videodelivery.net/${asset.stream_uid}/thumbnails/thumbnail.jpg`;
    } else if (asset.r2_key_thumb) {
      thumbnailUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${asset.r2_key_thumb}`;
    } else if (asset.r2_key_web) {
      thumbnailUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${asset.r2_key_web}`;
    } else if (asset.r2_key) {
      thumbnailUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${asset.r2_key}`;
    }

    // Create social content entry
    await queryDatabase(
      `INSERT INTO social_content (
        folder_id,
        source_type,
        import_source,
        asset_id,
        upload_uid,
        thumbnail_url,
        duration,
        title,
        status,
        scheduled_for,
        created_at,
        updated_at
      ) VALUES (?, 'upload', 'brand_assets', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        folder_id || null,
        asset_id,
        asset.stream_uid || null,
        thumbnailUrl,
        asset.duration || null,
        title || asset.title || 'Imported Asset',
        scheduled_for ? 'scheduled' : 'draft',
        scheduled_for || null,
      ]
    );

    // Get the created entry
    const created = await queryDatabase(
      `SELECT * FROM social_content WHERE asset_id = ? AND import_source = 'brand_assets' ORDER BY id DESC LIMIT 1`,
      [asset_id]
    );

    return NextResponse.json({
      success: true,
      content: created?.[0] || null,
    });
  } catch (e: any) {
    console.error('Error importing brand asset:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to import brand asset') },
      { status: 500 }
    );
  }
}
