import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

/**
 * Manual visibility override for videos/clips
 * Admin can force content live/archived regardless of distribution status
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
    const videoId = parseInt(id, 10);

    if (isNaN(videoId)) {
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

    values.push(videoId);

    await queryDatabase(
      `UPDATE videos SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated video
    const videos = await queryDatabase(
      'SELECT id, title, type, publication_status, is_public FROM videos WHERE id = ?',
      [videoId]
    ) as any[];

    const video = videos[0];

    return NextResponse.json({
      success: true,
      video,
      message: 'Visibility updated successfully'
    });
  } catch (error) {
    console.error('Error updating video visibility:', error);
    return NextResponse.json(
      { error: 'Failed to update visibility' },
      { status: 500 }
    );
  }
}
