import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'edge';


export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const authUser = getUserFromRequest(req);
    const userId = authUser?.userId;
    const itemId = url.searchParams.get('item_id');
    const type = url.searchParams.get('type');

    if (!userId || !itemId || !type) {
      return NextResponse.json(
        { error: 'user_id, item_id, and type are required' },
        { status: 400 }
      );
    }

    let tableName = '';
    let itemColumn = '';
    
    switch (type) {
      case 'track':
        tableName = 'user_track_likes';
        itemColumn = 'track_id';
        break;
      case 'video':
        tableName = 'user_video_likes';
        itemColumn = 'video_id';
        break;
      case 'album':
        tableName = 'user_album_likes';
        itemColumn = 'album_id';
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be track, video, or album' },
          { status: 400 }
        );
    }

    const result = await queryDatabase(
      `SELECT id, liked_at FROM ${tableName} WHERE user_id = ? AND ${itemColumn} = ?`,
      [userId, itemId]
    );

    const res = NextResponse.json({
      success: true,
      liked: result.length > 0,
      liked_at: result.length > 0 ? result[0].liked_at : null
    });
    // User-specific; prevent caching
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('Error checking like status:', error);
    return NextResponse.json(
      { error: 'Failed to check like status' },
      { status: 500 }
    );
  }
}
