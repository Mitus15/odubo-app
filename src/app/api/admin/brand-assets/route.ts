import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// GET: List assets with filtering
export async function GET(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const albumId = searchParams.get('album_id');
  const categoryId = searchParams.get('category_id');
  const assetType = searchParams.get('type');
  const search = searchParams.get('search');
  const tag = searchParams.get('tag');
  const featured = searchParams.get('featured');
  const productHandle = searchParams.get('product_handle');

  let query = `
    SELECT
      a.*,
      al.name as album_name,
      al.slug as album_slug,
      c.name as category_name,
      c.slug as category_slug
    FROM assets a
    LEFT JOIN asset_albums al ON a.album_id = al.id
    LEFT JOIN asset_categories c ON al.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (albumId) {
    query += ' AND a.album_id = ?';
    params.push(parseInt(albumId));
  }

  if (categoryId) {
    query += ' AND al.category_id = ?';
    params.push(parseInt(categoryId));
  }

  if (assetType && assetType !== 'all') {
    query += ' AND a.asset_type = ?';
    params.push(assetType);
  }

  if (search) {
    query += ' AND (a.title LIKE ? OR a.description LIKE ? OR a.alt_text LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (tag) {
    query += ' AND a.tags LIKE ?';
    params.push(`%"${tag}"%`);
  }

  if (featured === 'true') {
    query += ' AND a.is_featured = 1';
  }

  if (productHandle) {
    query += ' AND a.product_handle = ?';
    params.push(productHandle);
  }

  query += ' ORDER BY a.sort_order ASC, a.created_at DESC';

  try {
    const assets = await queryDatabase(query, params);

    // Parse tags JSON for each asset
    assets.forEach((asset: any) => {
      if (asset.tags) {
        try {
          asset.tags = JSON.parse(asset.tags);
        } catch {
          asset.tags = [];
        }
      } else {
        asset.tags = [];
      }
    });

    return NextResponse.json({ success: true, assets });
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    if (error?.message?.includes('no such table') || error?.message?.includes('no such column')) {
      return NextResponse.json({ success: true, assets: [], tableError: true });
    }
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

// POST: Create new asset
export async function POST(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      album_id,
      asset_type,
      r2_key,
      r2_key_thumb,
      r2_key_web,
      stream_uid,
      original_filename,
      mime_type,
      file_size,
      width,
      height,
      duration,
      title,
      description,
      alt_text,
      photographer,
      model_name,
      location,
      shoot_date,
      tags,
      is_featured,
      product_handle,
      moments_photo_id,
    } = body;

    if (!album_id) {
      return NextResponse.json({ error: 'Album is required' }, { status: 400 });
    }

    if (!asset_type || !['image', 'video'].includes(asset_type)) {
      return NextResponse.json({ error: 'Valid asset type (image/video) is required' }, { status: 400 });
    }

    // Get max sort order for this album
    const maxOrder = await queryDatabase(
      'SELECT MAX(sort_order) as max_order FROM assets WHERE album_id = ?',
      [album_id]
    );
    const nextOrder = (maxOrder[0]?.max_order || 0) + 1;

    const result = await executeQuery(
      `INSERT INTO assets (
        album_id, asset_type, r2_key, r2_key_thumb, r2_key_web, stream_uid,
        original_filename, mime_type, file_size, width, height, duration,
        title, description, alt_text, photographer, model_name, location, shoot_date,
        tags, is_featured, sort_order, product_handle, moments_photo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        album_id,
        asset_type,
        r2_key || null,
        r2_key_thumb || null,
        r2_key_web || null,
        stream_uid || null,
        original_filename || null,
        mime_type || null,
        file_size || null,
        width || null,
        height || null,
        duration || null,
        title || original_filename || null,
        description || null,
        alt_text || null,
        photographer || null,
        model_name || null,
        location || null,
        shoot_date || null,
        tags ? JSON.stringify(tags) : null,
        is_featured ? 1 : 0,
        nextOrder,
        product_handle || null,
        moments_photo_id || null,
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.lastRowId,
      message: 'Asset created successfully',
    });
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
  }
}
