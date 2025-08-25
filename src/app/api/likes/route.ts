import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const authUser = getUserFromRequest(req);
    const userId = authUser?.userId;
    const type = url.searchParams.get('type'); // 'tracks', 'videos', 'albums'
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let query = '';
    let params: any[] = [userId, parseInt(limit), parseInt(offset)];

    switch (type) {
      case 'tracks':
        query = `
          SELECT t.*, a.title as album_title, a.artist_name, a.cover_art_url,
                 utl.liked_at,
                 GROUP_CONCAT(
                   CASE WHEN tc.id IS NOT NULL 
                   THEN json_object('id', tc.id, 'role', tc.role, 'name', tc.name, 'is_featured', tc.is_featured) 
                   END
                 ) as credits_json
          FROM user_track_likes utl
          JOIN tracks t ON utl.track_id = t.id
          LEFT JOIN albums a ON t.album_id = a.id
          LEFT JOIN track_credits tc ON t.id = tc.track_id
          WHERE utl.user_id = ?
          GROUP BY t.id
          ORDER BY utl.liked_at DESC
          LIMIT ? OFFSET ?
        `;
        break;
        
      case 'videos':
        query = `
          SELECT f.*, uvl.liked_at
          FROM user_video_likes uvl
          JOIN films f ON uvl.video_id = f.id
          WHERE uvl.user_id = ?
          ORDER BY uvl.liked_at DESC
          LIMIT ? OFFSET ?
        `;
        break;
        
      case 'albums':
        query = `
          SELECT a.*, ual.liked_at,
                 COUNT(t.id) as total_tracks,
                 SUM(t.duration) as total_duration
          FROM user_album_likes ual
          JOIN albums a ON ual.album_id = a.id
          LEFT JOIN tracks t ON a.id = t.album_id
          WHERE ual.user_id = ?
          GROUP BY a.id
          ORDER BY ual.liked_at DESC
          LIMIT ? OFFSET ?
        `;
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be tracks, videos, or albums' },
          { status: 400 }
        );
    }

    const results = await queryDatabase(query, params);
    
    // Parse credits for tracks if needed
    let processedResults = results;
    if (type === 'tracks') {
      processedResults = results.map((item: any) => ({
        ...item,
        credits: item.credits_json ? 
          item.credits_json.split(',').map((creditStr: string) => {
            try {
              return JSON.parse(creditStr);
            } catch {
              return null;
            }
          }).filter(Boolean) : []
      }));
    }

    return NextResponse.json({
      success: true,
      data: processedResults,
      type
    });
  } catch (error) {
    console.error('Error fetching user likes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user likes' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = getUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rl = await rateLimit({ key: `likes:${authUser.userId}:${ip}`, limit: 30, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const body = await req.json() as { item_id: string; type: string };
    const { item_id, type } = body;

    if (!authUser.userId || !item_id || !type) {
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

    // Check if already liked
    const existingLike = await queryDatabase(
      `SELECT id FROM ${tableName} WHERE user_id = ? AND ${itemColumn} = ?`,
      [authUser.userId, item_id]
    );

    if (existingLike.length > 0) {
      return NextResponse.json(
        { error: 'Item already liked by user' },
        { status: 409 }
      );
    }

    // Add like
    const result = await executeQuery(
      `INSERT INTO ${tableName} (user_id, ${itemColumn}) VALUES (?, ?)`,
      [authUser.userId, item_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Item liked successfully',
      like_id: result.meta.last_row_id
    });
  } catch (error) {
    console.error('Error adding like:', error);
    return NextResponse.json(
      { error: 'Failed to add like' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = getUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rl = await rateLimit({ key: `likes:${authUser.userId}:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const body = await req.json() as { item_id: string; type: string };
    const { item_id, type } = body;

    if (!item_id || !type) {
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

    // Remove like
    const result = await executeQuery(
      `DELETE FROM ${tableName} WHERE user_id = ? AND ${itemColumn} = ?`,
      [authUser.userId, item_id]
    );

    if (result.meta.changes === 0) {
      return NextResponse.json(
        { error: 'Like not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Like removed successfully'
    });
  } catch (error) {
    console.error('Error removing like:', error);
    return NextResponse.json(
      { error: 'Failed to remove like' },
      { status: 500 }
    );
  }
}
