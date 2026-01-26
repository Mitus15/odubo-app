import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'nodejs';

interface LinkParentRequest {
  clipId: number;
  parentId: number;
}

/**
 * POST /api/arsenal/link-parent
 * Link a clip to a parent video (Magazine → Bullets)
 * Auto-assigns clip_index and updates total_siblings for all siblings
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LinkParentRequest;
    const { clipId, parentId } = body;

    if (!clipId || !parentId) {
      return NextResponse.json(
        { error: 'clipId and parentId are required' },
        { status: 400 }
      );
    }

    // Verify clip exists
    const clip = await queryDatabase(
      'SELECT id, parent_video_id FROM videos WHERE id = ?',
      [clipId]
    ) as Array<{ id: number; parent_video_id: number | null }>;

    if (!clip || clip.length === 0) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    // Verify parent exists and is not itself a clip
    const parent = await queryDatabase(
      'SELECT id, parent_video_id FROM videos WHERE id = ?',
      [parentId]
    ) as Array<{ id: number; parent_video_id: number | null }>;

    if (!parent || parent.length === 0) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    if (parent[0].parent_video_id !== null) {
      return NextResponse.json(
        { error: 'Cannot link to a clip (parent must be a top-level video)' },
        { status: 400 }
      );
    }

    // Get current max clip_index for this parent
    const maxResult = await queryDatabase(
      'SELECT MAX(clip_index) as max_index FROM videos WHERE parent_video_id = ?',
      [parentId]
    ) as Array<{ max_index: number | null }>;

    const newIndex = (maxResult[0]?.max_index || 0) + 1;

    // Link the clip to parent with new index
    await executeQuery(
      `UPDATE videos SET parent_video_id = ?, clip_index = ? WHERE id = ?`,
      [parentId, newIndex, clipId]
    );

    // Get total count of clips under this parent (including the new one)
    const countResult = await queryDatabase(
      'SELECT COUNT(*) as total FROM videos WHERE parent_video_id = ?',
      [parentId]
    ) as Array<{ total: number }>;

    const totalSiblings = countResult[0]?.total || newIndex;

    // Update total_siblings for ALL clips under this parent
    await executeQuery(
      `UPDATE videos SET total_siblings = ? WHERE parent_video_id = ?`,
      [totalSiblings, parentId]
    );

    return NextResponse.json({
      message: `Linked clip ${clipId} to parent ${parentId}`,
      clipId,
      parentId,
      clipIndex: newIndex,
      totalSiblings,
    });
  } catch (error) {
    console.error('[Arsenal] Link-parent error:', error);
    return NextResponse.json(
      { error: 'Failed to link clip to parent' },
      { status: 500 }
    );
  }
}
