import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { normalizeVideoType, VALID_VIDEO_TYPES } from '@/types/videoTypes';

export const runtime = 'nodejs';

/**
 * POST /api/admin/normalize-video-types
 *
 * Normalizes all video types in the database to use standardized values.
 * This is a one-time migration endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    // Get all videos with their current types
    const videos = await queryDatabase(
      'SELECT id, title, type FROM videos',
      []
    ) as Array<{ id: number; title: string; type: string | null }>;

    const updates: Array<{ id: number; title: string; oldType: string | null; newType: string }> = [];

    for (const video of videos) {
      const normalizedType = normalizeVideoType(video.type);

      // Only update if the type changed
      if (video.type !== normalizedType) {
        updates.push({
          id: video.id,
          title: video.title,
          oldType: video.type,
          newType: normalizedType,
        });

        await executeQuery(
          'UPDATE videos SET type = ?, updated_at = datetime("now") WHERE id = ?',
          [normalizedType, video.id]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Normalized ${updates.length} video types`,
      validTypes: VALID_VIDEO_TYPES,
      updates,
    });
  } catch (error) {
    console.error('Error normalizing video types:', error);
    return NextResponse.json(
      { error: 'Failed to normalize video types', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/normalize-video-types
 *
 * Preview what would be normalized without making changes.
 */
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    // Get all videos with their current types
    const videos = await queryDatabase(
      'SELECT id, title, type FROM videos',
      []
    ) as Array<{ id: number; title: string; type: string | null }>;

    const wouldUpdate: Array<{ id: number; title: string; oldType: string | null; newType: string }> = [];
    const typeCounts: Record<string, number> = {};

    for (const video of videos) {
      const currentType = video.type || '(null)';
      typeCounts[currentType] = (typeCounts[currentType] || 0) + 1;

      const normalizedType = normalizeVideoType(video.type);

      if (video.type !== normalizedType) {
        wouldUpdate.push({
          id: video.id,
          title: video.title,
          oldType: video.type,
          newType: normalizedType,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalVideos: videos.length,
      currentTypeCounts: typeCounts,
      validTypes: VALID_VIDEO_TYPES,
      wouldUpdate,
      message: `${wouldUpdate.length} videos would be updated. POST to apply changes.`,
    });
  } catch (error) {
    console.error('Error previewing video type normalization:', error);
    return NextResponse.json(
      { error: 'Failed to preview normalization', details: String(error) },
      { status: 500 }
    );
  }
}
