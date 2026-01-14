import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// GET: List all folders with content counts
export async function GET(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Simple query first - just get folders without content count
    const folders = await queryDatabase(`
      SELECT * FROM social_folders
      ORDER BY sort_order ASC, name ASC
    `);

    // Try to get content count, but don't fail if table doesn't exist
    let totalCount = 0;
    try {
      const countResult = await queryDatabase('SELECT COUNT(*) as count FROM social_content');
      totalCount = countResult[0]?.count || 0;

      // Also try to get per-folder counts
      const folderCounts = await queryDatabase(`
        SELECT folder_id, COUNT(*) as content_count
        FROM social_content
        GROUP BY folder_id
      `);

      // Merge counts into folders
      const countsMap = new Map(folderCounts.map((fc: any) => [fc.folder_id, fc.content_count]));
      folders.forEach((f: any) => {
        f.content_count = countsMap.get(f.id) || 0;
      });
    } catch (countError) {
      console.warn('Could not get content counts (social_content table may not exist):', countError);
      // Add zero counts to all folders
      folders.forEach((f: any) => {
        f.content_count = 0;
      });
    }

    return NextResponse.json({
      success: true,
      folders,
      totalCount,
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

// POST: Create new folder
export async function POST(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if slug already exists
    const existing = await queryDatabase(
      'SELECT id FROM social_folders WHERE slug = ?',
      [slug]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 400 });
    }

    // Get max sort order
    const maxOrder = await queryDatabase(
      'SELECT MAX(sort_order) as max_order FROM social_folders'
    );
    const nextOrder = (maxOrder[0]?.max_order || 0) + 1;

    const result = await executeQuery(
      'INSERT INTO social_folders (name, slug, is_default, sort_order) VALUES (?, ?, FALSE, ?)',
      [name.trim(), slug, nextOrder]
    );

    return NextResponse.json({
      success: true,
      folder: {
        id: result.lastRowId,
        name: name.trim(),
        slug,
        is_default: false,
        sort_order: nextOrder,
      },
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}

// PATCH: Update folder (rename, reorder)
export async function PATCH(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    // Check if folder exists and is not default
    const existing = await queryDatabase(
      'SELECT id, is_default FROM social_folders WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Default folders can only be reordered, not renamed
    if (existing[0].is_default && name) {
      return NextResponse.json({ error: 'Cannot rename default folders' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name) {
      updates.push('name = ?');
      values.push(name.trim());

      // Update slug too
      const newSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      updates.push('slug = ?');
      values.push(newSlug);
    }

    if (typeof sort_order === 'number') {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    values.push(id);
    await executeQuery(
      `UPDATE social_folders SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: 'Folder updated successfully' });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

// DELETE: Delete folder (only non-default, moves content to uncategorized)
export async function DELETE(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    // Check if folder exists and is not default
    const existing = await queryDatabase(
      'SELECT id, is_default FROM social_folders WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (existing[0].is_default) {
      return NextResponse.json({ error: 'Cannot delete default folders' }, { status: 400 });
    }

    // Move all content in this folder to uncategorized (null folder_id)
    await executeQuery(
      'UPDATE social_content SET folder_id = NULL WHERE folder_id = ?',
      [id]
    );

    // Delete the folder
    await executeQuery('DELETE FROM social_folders WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
