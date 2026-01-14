import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

interface SocialContent {
  id: number;
  folder_id: number | null;
  source_type: 'upload' | 'clip';
  video_id: number | null;
  upload_uid: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  title: string;
  caption_instagram: string | null;
  caption_tiktok: string | null;
  caption_youtube: string | null;
  hashtags_instagram: string | null;
  hashtags_tiktok: string | null;
  hashtags_youtube: string | null;
  status: 'draft' | 'review' | 'approved' | 'scheduled' | 'posted' | 'archived';
  scheduled_for: string | null;
  scheduled_platforms: string | null;
  posted_at: string | null;
  posted_platforms: string | null;
  postforme_id: string | null;
  created_at: string;
  updated_at: string;
}

// GET: List all social content with optional filtering
export async function GET(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  let query = `
    SELECT
      sc.*,
      sf.name as folder_name,
      sf.slug as folder_slug,
      v.title as linked_video_title,
      v.stream_video_id as linked_video_uid
    FROM social_content sc
    LEFT JOIN social_folders sf ON sc.folder_id = sf.id
    LEFT JOIN videos v ON sc.video_id = v.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (folder && folder !== 'all') {
    query += ' AND sf.slug = ?';
    params.push(folder);
  }

  if (status && status !== 'all') {
    query += ' AND sc.status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND sc.title LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY sc.created_at DESC';

  try {
    const content = await queryDatabase(query, params);
    return NextResponse.json({ success: true, content });
  } catch (error: any) {
    console.error('Error fetching social content:', error);
    // If table doesn't exist, return empty array instead of error
    if (error?.message?.includes('no such table') || error?.message?.includes('no such column')) {
      console.warn('social_content table may not exist or has wrong schema');
      return NextResponse.json({ success: true, content: [], tableError: true });
    }
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

// POST: Create new social content
export async function POST(req: NextRequest) {
  const actor = getUserFromRequest(req);
  if (!isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      folder_id,
      source_type = 'upload',
      video_id,
      upload_uid,
      thumbnail_url,
      duration,
      title,
      caption_instagram,
      caption_tiktok,
      caption_youtube,
      hashtags_instagram,
      hashtags_tiktok,
      hashtags_youtube,
      status = 'draft',
      scheduled_for,
      scheduled_platforms,
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (source_type === 'clip' && !video_id) {
      return NextResponse.json({ error: 'video_id is required for clip source type' }, { status: 400 });
    }

    if (source_type === 'upload' && !upload_uid) {
      return NextResponse.json({ error: 'upload_uid is required for upload source type' }, { status: 400 });
    }

    const result = await executeQuery(
      `INSERT INTO social_content (
        folder_id, source_type, video_id, upload_uid, thumbnail_url, duration,
        title, caption_instagram, caption_tiktok, caption_youtube,
        hashtags_instagram, hashtags_tiktok, hashtags_youtube,
        status, scheduled_for, scheduled_platforms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        folder_id || null,
        source_type,
        video_id || null,
        upload_uid || null,
        thumbnail_url || null,
        duration || null,
        title,
        caption_instagram || null,
        caption_tiktok || null,
        caption_youtube || null,
        hashtags_instagram || null,
        hashtags_tiktok || null,
        hashtags_youtube || null,
        status,
        scheduled_for || null,
        scheduled_platforms ? JSON.stringify(scheduled_platforms) : null,
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.lastRowId,
      message: 'Content created successfully',
    });
  } catch (error) {
    console.error('Error creating social content:', error);
    return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
  }
}
