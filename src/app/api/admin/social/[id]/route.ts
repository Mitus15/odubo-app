import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// GET: Get single social content item
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
    const content = await queryDatabase(
      `SELECT
        sc.*,
        sf.name as folder_name,
        sf.slug as folder_slug,
        v.title as linked_video_title,
        v.stream_video_id as linked_video_uid,
        v.thumbnail_url as linked_video_thumbnail
      FROM social_content sc
      LEFT JOIN social_folders sf ON sc.folder_id = sf.id
      LEFT JOIN videos v ON sc.video_id = v.id
      WHERE sc.id = ?`,
      [id]
    );

    if (!content || content.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Also fetch analytics for this content
    const analytics = await queryDatabase(
      'SELECT * FROM social_analytics WHERE content_id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      content: content[0],
      analytics,
    });
  } catch (error) {
    console.error('Error fetching social content:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

// PATCH: Update social content
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
      'folder_id',
      'title',
      'thumbnail_url',
      'caption_instagram',
      'caption_tiktok',
      'caption_youtube',
      'hashtags_instagram',
      'hashtags_tiktok',
      'hashtags_youtube',
      'status',
      'scheduled_for',
      'scheduled_platforms',
      'posted_at',
      'posted_platforms',
      'postforme_id',
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = ?`);
        // Handle JSON fields
        if (['scheduled_platforms', 'posted_platforms'].includes(field) && Array.isArray(body[field])) {
          values.push(JSON.stringify(body[field]));
        } else {
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
      `UPDATE social_content SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: 'Content updated successfully' });
  } catch (error) {
    console.error('Error updating social content:', error);
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
  }
}

// DELETE: Delete social content
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
    // Check if content exists
    const existing = await queryDatabase(
      'SELECT id, upload_uid FROM social_content WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Delete analytics first (due to foreign key)
    await executeQuery('DELETE FROM social_analytics WHERE content_id = ?', [id]);

    // Delete the content
    await executeQuery('DELETE FROM social_content WHERE id = ?', [id]);

    // Note: If upload_uid exists, we might want to delete from Cloudflare Stream too
    // For now, we'll leave that as a manual cleanup task

    return NextResponse.json({ success: true, message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Error deleting social content:', error);
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
  }
}
