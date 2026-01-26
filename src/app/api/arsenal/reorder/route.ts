import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'nodejs';

interface ReorderRequest {
  parentId: number;
  clipIds: number[]; // Array of clip IDs in desired order
}

/**
 * POST /api/arsenal/reorder
 * Reorder clips within a parent video (drag-and-drop)
 * Updates clip_index for all affected clips and recalculates total_siblings
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReorderRequest;
    const { parentId, clipIds } = body;

    if (!parentId || !clipIds?.length) {
      return NextResponse.json(
        { error: 'parentId and clipIds are required' },
        { status: 400 }
      );
    }

    // Verify all clips belong to this parent
    const placeholders = clipIds.map(() => '?').join(',');
    const clips = await queryDatabase(
      `SELECT id FROM videos
       WHERE id IN (${placeholders})
         AND parent_video_id = ?`,
      [...clipIds, parentId]
    ) as Array<{ id: number }>;

    const foundIds = new Set((clips || []).map((c) => c.id));
    const invalidIds = clipIds.filter((id) => !foundIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid clip IDs: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }

    const totalSiblings = clipIds.length;

    // Update clip indices in order
    for (let i = 0; i < clipIds.length; i++) {
      const clipId = clipIds[i];
      const newIndex = i + 1; // 1-based index

      await executeQuery(
        `UPDATE videos
         SET clip_index = ?,
             total_siblings = ?
         WHERE id = ?`,
        [newIndex, totalSiblings, clipId]
      );
    }

    return NextResponse.json({
      message: `Reordered ${clipIds.length} clips`,
      parentId,
      totalSiblings,
    });
  } catch (error) {
    console.error('[Arsenal] Reorder error:', error);
    return NextResponse.json(
      { error: 'Failed to reorder clips' },
      { status: 500 }
    );
  }
}
