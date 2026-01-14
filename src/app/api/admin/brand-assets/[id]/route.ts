import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// GET: Get single asset
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const asset = await queryDatabase(
      `SELECT
        a.*,
        al.name as album_name,
        al.slug as album_slug,
        c.name as category_name,
        c.slug as category_slug
      FROM assets a
      LEFT JOIN asset_albums al ON a.album_id = al.id
      LEFT JOIN asset_categories c ON al.category_id = c.id
      WHERE a.id = ?`,
      [id]
    );

    if (!asset || asset.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const result = asset[0];
    if (result.tags) {
      try {
        result.tags = JSON.parse(result.tags);
      } catch {
        result.tags = [];
      }
    } else {
      result.tags = [];
    }

    return NextResponse.json({ success: true, asset: result });
  } catch (error) {
    console.error('Error fetching asset:', error);
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 });
  }
}

// PATCH: Update asset
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const allowedFields = [
      'album_id',
      'title',
      'description',
      'alt_text',
      'photographer',
      'model_name',
      'location',
      'shoot_date',
      'tags',
      'is_featured',
      'sort_order',
      'product_handle',
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        if (field === 'tags') {
          updates.push(`${field} = ?`);
          values.push(Array.isArray(body[field]) ? JSON.stringify(body[field]) : body[field]);
        } else if (field === 'is_featured') {
          updates.push(`${field} = ?`);
          values.push(body[field] ? 1 : 0);
        } else {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await executeQuery(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: 'Asset updated successfully' });
  } catch (error) {
    console.error('Error updating asset:', error);
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
  }
}

// DELETE: Delete asset
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Get asset info for potential R2 cleanup
    const existing = await queryDatabase(
      'SELECT id, r2_key, r2_key_thumb, r2_key_web, stream_uid FROM assets WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Delete the asset
    await executeQuery('DELETE FROM assets WHERE id = ?', [id]);

    // Note: R2 files should be cleaned up separately (could add cleanup logic here)
    // For now, return the keys so client can handle cleanup if needed
    return NextResponse.json({
      success: true,
      message: 'Asset deleted successfully',
      deletedKeys: {
        r2_key: existing[0].r2_key,
        r2_key_thumb: existing[0].r2_key_thumb,
        r2_key_web: existing[0].r2_key_web,
        stream_uid: existing[0].stream_uid,
      },
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
  }
}
