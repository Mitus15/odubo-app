import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const itemId = url.searchParams.get('item_id');
    const type = url.searchParams.get('type');

    if (!itemId || !type) {
      return NextResponse.json(
        { error: 'item_id and type are required' },
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
      `SELECT COUNT(*) as count FROM ${tableName} WHERE ${itemColumn} = ?`,
      [itemId]
    );

    const res = NextResponse.json({
      success: true,
      count: result[0]?.count || 0
    });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return res;
  } catch (error) {
    console.error('Error fetching like count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch like count' },
      { status: 500 }
    );
  }
}
