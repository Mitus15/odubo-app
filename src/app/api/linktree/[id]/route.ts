import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

/**
 * POST /api/linktree/[id]/click
 * Track a link click for analytics
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const linkId = parseInt(id, 10);

    if (isNaN(linkId)) {
      return NextResponse.json(
        { error: 'Invalid link ID' },
        { status: 400 }
      );
    }

    // Increment click count and update last_clicked_at
    await queryDatabase(`
      UPDATE linktree
      SET 
        click_count = click_count + 1,
        last_clicked_at = datetime('now')
      WHERE id = ?
    `, [linkId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking link click:', error);
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/linktree/[id]
 * Update a link (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const linkId = parseInt(id, 10);
    if (isNaN(linkId)) {
      return NextResponse.json(
        { error: 'Invalid link ID' },
        { status: 400 }
      );
    }

    const body = await request.json() as Record<string, any>;
    const updates: string[] = [];
    const values: any[] = [];

    // Allowed fields to update
    const allowedFields = [
      'title', 'url', 'category', 'platform', 'icon_url', 'description',
      'display_order', 'is_active', 'is_featured', 'managed_by', 'notes',
      'last_posted_at'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Always update last_updated_at
    updates.push(`last_updated_at = datetime('now')`);
    values.push(linkId);

    await queryDatabase(`
      UPDATE linktree
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating link:', error);
    return NextResponse.json(
      { error: 'Failed to update link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/linktree/[id]
 * Delete a link (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const linkId = parseInt(id, 10);
    if (isNaN(linkId)) {
      return NextResponse.json(
        { error: 'Invalid link ID' },
        { status: 400 }
      );
    }

    await queryDatabase(`DELETE FROM linktree WHERE id = ?`, [linkId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting link:', error);
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}
