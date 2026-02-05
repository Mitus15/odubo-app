import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * Bulk visibility override for all clips of a parent video
 * Makes all clips live/archived when parent is manually published
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const parentVideoId = parseInt(id, 10);

    if (isNaN(parentVideoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const body = await request.json();
    const { publication_status, is_public } = body;

    // Validate values
    if (publication_status && !['live', 'archived'].includes(publication_status)) {
      return NextResponse.json(
        { error: 'publication_status must be "live" or "archived"' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];

    if (publication_status !== undefined) {
      updates.push('publication_status = ?');
      values.push(publication_status);
    }

    if (is_public !== undefined) {
      updates.push('is_public = ?');
      values.push(is_public ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No visibility fields provided' },
        { status: 400 }
      );
    }

    values.push(parentVideoId);

    // Update all clips with this parent_video_id
    const result = await db
      .prepare(`UPDATE videos SET ${updates.join(', ')} WHERE parent_video_id = ?`)
      .bind(...values)
      .run();

    if (!result.success) {
      throw new Error('Failed to update clips visibility');
    }

    // Count affected clips
    const count = await db
      .prepare('SELECT COUNT(*) as count FROM videos WHERE parent_video_id = ?')
      .bind(parentVideoId)
      .first<{ count: number }>();

    return NextResponse.json({
      success: true,
      clips_updated: count?.count || 0,
      message: `${count?.count || 0} clips updated successfully`
    });
  } catch (error) {
    console.error('Error updating clips visibility:', error);
    return NextResponse.json(
      { error: 'Failed to update clips visibility' },
      { status: 500 }
    );
  }
}
