import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/api/requireAdmin';

export const runtime = 'nodejs';

interface UpdateRequest {
  videoId: number;
  title?: string;
  // Future: add more fields like description
}

/**
 * POST /api/arsenal/update
 * Update video metadata (title, etc.)
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;

  try {
    const body = (await request.json()) as UpdateRequest;
    const { videoId, title } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    if (title !== undefined) {
      await executeQuery(
        'UPDATE videos SET title = ?, updated_at = datetime("now") WHERE id = ?',
        [title, videoId]
      );
    }

    return NextResponse.json({ message: 'Updated successfully', videoId });
  } catch (error) {
    console.error('[Arsenal] Update error:', error);
    return NextResponse.json({ error: 'Failed to update video' }, { status: 500 });
  }
}
