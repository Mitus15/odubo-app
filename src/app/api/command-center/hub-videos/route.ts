import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

// GET /api/command-center/hub-videos - List videos from the hub (Cloudflare Stream)
// These are existing videos that can be imported into video distribution
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const excludeImported = searchParams.get('excludeImported') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    // Build query to get videos from the hub that have Stream UIDs
    let query = `
      SELECT
        v.id,
        v.uid,
        v.title,
        v.artist_name as artistName,
        v.description,
        v.url,
        v.poster_url as posterUrl,
        v.thumbnail,
        v.duration,
        v.category,
        v.type,
        v.status,
        v.stream_video_id as streamVideoId,
        v.created_at as createdAt
      FROM videos v
      WHERE (v.uid IS NOT NULL AND v.uid != '')
         OR (v.stream_video_id IS NOT NULL AND v.stream_video_id != '')
    `;

    const params: any[] = [];

    // Exclude already imported videos
    if (excludeImported) {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM video_releases vr
        WHERE vr.internal_video_id = CAST(v.id AS TEXT)
      )`;
    }

    // Search filter
    if (search) {
      query += ` AND (v.title LIKE ? OR v.artist_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const result = await queryDatabase(query, params) || [];

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total FROM videos v
      WHERE (v.uid IS NOT NULL AND v.uid != '')
         OR (v.stream_video_id IS NOT NULL AND v.stream_video_id != '')
    `;
    const countParams: any[] = [];

    if (excludeImported) {
      countQuery += ` AND NOT EXISTS (
        SELECT 1 FROM video_releases vr
        WHERE vr.internal_video_id = CAST(v.id AS TEXT)
      )`;
    }

    if (search) {
      countQuery += ` AND (v.title LIKE ? OR v.artist_name LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countResults = await queryDatabase(countQuery, countParams);
    const countResult = countResults?.[0] as { total: number } | undefined;

    // Process videos to extract Stream UID and generate thumbnails
    const videos = result.map((row: any) => {
      // Get the Stream UID - prefer uid column, fall back to stream_video_id or extract from URL
      let streamUid = row.uid || row.streamVideoId;
      if (!streamUid && row.url) {
        const match = row.url.match(/(?:cloudflarestream\.com|videodelivery\.net)\/([a-f0-9]{32})/i);
        if (match) streamUid = match[1];
      }

      // Generate thumbnail URL from Stream if we have a UID
      let thumbnailUrl = row.posterUrl || row.thumbnail;
      if (streamUid && !thumbnailUrl) {
        thumbnailUrl = `https://videodelivery.net/${streamUid}/thumbnails/thumbnail.jpg`;
      }

      return {
        id: row.id,
        uid: streamUid,
        title: row.title || 'Untitled',
        artistName: row.artistName || '',
        description: row.description || '',
        thumbnailUrl,
        duration: row.duration,
        category: row.category,
        type: row.type,
        status: row.status,
        createdAt: row.createdAt,
      };
    });

    return NextResponse.json({
      videos,
      total: countResult?.total || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Hub Videos API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch hub videos' }, { status: 500 });
  }
}

export const runtime = 'edge';
