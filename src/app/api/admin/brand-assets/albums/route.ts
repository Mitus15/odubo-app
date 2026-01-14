import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// GET: List albums with optional category filter
export async function GET(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('category_id');
  const status = searchParams.get('status');

  let query = `
    SELECT
      a.*,
      c.name as category_name,
      c.slug as category_slug,
      (SELECT COUNT(*) FROM assets WHERE album_id = a.id) as asset_count
    FROM asset_albums a
    LEFT JOIN asset_categories c ON a.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (categoryId) {
    query += ' AND a.category_id = ?';
    params.push(parseInt(categoryId));
  }

  if (status && status !== 'all') {
    query += ' AND a.status = ?';
    params.push(status);
  }

  query += ' ORDER BY a.sort_order ASC, a.name ASC';

  try {
    const albums = await queryDatabase(query, params);
    return NextResponse.json({ success: true, albums });
  } catch (error: any) {
    console.error('Error fetching albums:', error);
    if (error?.message?.includes('no such table')) {
      return NextResponse.json({ success: true, albums: [], tableError: true });
    }
    return NextResponse.json({ error: 'Failed to fetch albums' }, { status: 500 });
  }
}

// POST: Create new album
export async function POST(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { category_id, name, description, status = 'draft' } = body;

    if (!category_id) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Album name is required' }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for duplicate slug within same category
    const existing = await queryDatabase(
      'SELECT id FROM asset_albums WHERE category_id = ? AND slug = ?',
      [category_id, slug]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'An album with this name already exists in this category' }, { status: 400 });
    }

    const maxOrder = await queryDatabase(
      'SELECT MAX(sort_order) as max_order FROM asset_albums WHERE category_id = ?',
      [category_id]
    );
    const nextOrder = (maxOrder[0]?.max_order || 0) + 1;

    const result = await executeQuery(
      'INSERT INTO asset_albums (category_id, name, slug, description, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [category_id, name.trim(), slug, description || null, status, nextOrder]
    );

    return NextResponse.json({
      success: true,
      album: {
        id: result.lastRowId,
        category_id,
        name: name.trim(),
        slug,
        description: description || null,
        status,
        sort_order: nextOrder,
      },
    });
  } catch (error) {
    console.error('Error creating album:', error);
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
  }
}

// PATCH: Update album
export async function PATCH(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, description, status, cover_asset_id, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());

      const newSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      updates.push('slug = ?');
      values.push(newSlug);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (cover_asset_id !== undefined) {
      updates.push('cover_asset_id = ?');
      values.push(cover_asset_id || null);
    }

    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await executeQuery(
      `UPDATE asset_albums SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: 'Album updated successfully' });
  } catch (error) {
    console.error('Error updating album:', error);
    return NextResponse.json({ error: 'Failed to update album' }, { status: 500 });
  }
}

// DELETE: Delete album
export async function DELETE(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
    }

    // Assets will be cascade deleted due to FK constraint
    await executeQuery('DELETE FROM asset_albums WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: 'Album deleted successfully' });
  } catch (error) {
    console.error('Error deleting album:', error);
    return NextResponse.json({ error: 'Failed to delete album' }, { status: 500 });
  }
}
