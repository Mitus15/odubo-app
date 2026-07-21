import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

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
    const user = await verifyUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.is_admin) {
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
    await queryDatabase(
      `UPDATE videos SET ${updates.join(', ')} WHERE parent_video_id = ?`,
      values
    );

    // Count affected clips
    const counts = await queryDatabase(
      'SELECT COUNT(*) as count FROM videos WHERE parent_video_id = ?',
      [parentVideoId]
    ) as { count: number }[];

    const count = counts[0]?.count || 0;

    return NextResponse.json({
      success: true,
      clips_updated: count,
      message: `${count} clips updated successfully`
    });
  } catch (error) {
    console.error('Error updating clips visibility:', error);
    return NextResponse.json(
      { error: 'Failed to update clips visibility' },
      { status: 500 }
    );
  }
}
