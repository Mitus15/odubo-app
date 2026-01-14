import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// GET: List all categories with album counts
export async function GET(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const categories = await queryDatabase(`
      SELECT * FROM asset_categories
      ORDER BY sort_order ASC, name ASC
    `);

    // Get album counts per category
    try {
      const albumCounts = await queryDatabase(`
        SELECT category_id, COUNT(*) as album_count
        FROM asset_albums
        GROUP BY category_id
      `);

      const countsMap = new Map(albumCounts.map((ac: any) => [ac.category_id, ac.album_count]));
      categories.forEach((c: any) => {
        c.album_count = countsMap.get(c.id) || 0;
      });
    } catch {
      categories.forEach((c: any) => {
        c.album_count = 0;
      });
    }

    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    if (error?.message?.includes('no such table')) {
      return NextResponse.json({ success: true, categories: [], tableError: true });
    }
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST: Create new category
export async function POST(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description, icon } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = await queryDatabase(
      'SELECT id FROM asset_categories WHERE slug = ?',
      [slug]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 });
    }

    const maxOrder = await queryDatabase(
      'SELECT MAX(sort_order) as max_order FROM asset_categories'
    );
    const nextOrder = (maxOrder[0]?.max_order || 0) + 1;

    const result = await executeQuery(
      'INSERT INTO asset_categories (name, slug, description, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), slug, description || null, icon || null, nextOrder]
    );

    return NextResponse.json({
      success: true,
      category: {
        id: result.lastRowId,
        name: name.trim(),
        slug,
        description: description || null,
        icon: icon || null,
        sort_order: nextOrder,
      },
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
