import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { deleteFile } from '@/worker/upload';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/audit';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { normalizeVideoType, VALID_VIDEO_TYPES, VIDEO_TYPES } from '@/types/videoTypes';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(0, Math.min(200, Number(url.searchParams.get('limit') || '50')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));
    const publicationStatus = url.searchParams.get('publication_status');
    const uid = url.searchParams.get('uid');
    const excludeType = url.searchParams.get('exclude_type'); // e.g., 'clip' to exclude clips
    const hasFilter = publicationStatus === 'live' || publicationStatus === 'archived';

    // Try with full schema first, fallback to basic schema if columns don't exist
    let videos;
    try {
      const whereClauses: string[] = [];
      const paramsFull: any[] = [];

      if (uid) {
        whereClauses.push('uid = ?');
        paramsFull.push(uid);
      } else if (hasFilter) {
        whereClauses.push("COALESCE(publication_status,'archived') = ?");
        paramsFull.push(publicationStatus);
      }

      // Exclude specific type (e.g., clips)
      if (excludeType) {
        whereClauses.push("COALESCE(type, '') != ?");
        paramsFull.push(excludeType);
      }

      const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

      paramsFull.push(limit);
      paramsFull.push(offset);

      videos = await queryDatabase(
        `SELECT 
          id,
          COALESCE(uid, '') as uid,
          title,
          COALESCE(artist_name, '') as artist_name,
          description,
          COALESCE(short_description, '') as short_description,
          COALESCE(long_description, '') as long_description,
          COALESCE(tags, '[]') as tags,
          url,
          url as video_url,
          poster_url,
          poster_url as thumbnail_url,
          thumbnail,
          duration,
          duration_seconds,
          category,
          is_public,
          type,
          mood,
          credits,
          related_projects,
          COALESCE(status, 'published') as status,
          COALESCE(stream_video_id, '') as stream_video_id,
          COALESCE(publication_status, 'archived') as publication_status,
          ai_description,
          thumbnail_timestamp_pct,
          shopify_product_id,
          shopify_product_handle,
          created_at,
          COALESCE(updated_at, created_at) as updated_at
        FROM videos 
        ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        paramsFull
      );
    } catch (schemaError) {
      // Fallback to basic schema if new columns don't exist
      console.log('Using fallback query for videos table');
      const paramsBasic: any[] = [];
      let whereBasic = '';
      
      if (uid) {
        whereBasic = 'WHERE uid = ?';
        paramsBasic.push(uid);
      }

      paramsBasic.push(limit);
      paramsBasic.push(offset);

      videos = await queryDatabase(
        `SELECT 
          id,
          uid,
          title,
          description,
          url as video_url,
          poster_url as thumbnail_url,
          thumbnail,
          duration,
          category,
          is_public,
          type,
          mood,
          credits,
          related_projects,
          created_at
        FROM videos 
        ${whereBasic}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        paramsBasic
      );
      
      // Add missing fields for compatibility
      videos = videos.map((video: any) => ({
        ...video,
        artist_name: video.artist_name || '',
        status: video.status || 'published',
        stream_video_id: video.stream_video_id || '',
        publication_status: video.publication_status || 'archived',
        updated_at: video.updated_at || video.created_at || new Date().toISOString(),
        thumbnail_url: video.thumbnail_url || video.poster_url || video.thumbnail || '',
        short_description: video.short_description || '',
        long_description: video.long_description || '',
        tags: video.tags || '[]',
        duration_seconds: video.duration_seconds || null,
        ai_description: video.ai_description || null,
        thumbnail_timestamp_pct: video.thumbnail_timestamp_pct || null,
      }));
    }

    const transformedVideos = (videos as any[]).map((video) => {
      let parsedTags: any = [];
      try { parsedTags = Array.isArray(video.tags) ? video.tags : JSON.parse(String(video.tags || '[]')); } catch { parsedTags = []; }
      
      // Extract UID from URL if uid column is empty
      let videoUid = video.uid || video.stream_video_id || '';
      if (!videoUid && video.url) {
        const match = video.url.match(/(?:cloudflarestream\.com|videodelivery\.net)\/([a-f0-9]{32})/i);
        if (match) videoUid = match[1];
      }
      
      return {
        ...video,
        uid: videoUid,
        status: video.status || 'published',
        artist_name: video.artist_name || '',
        duration: Number.parseInt(String(video.duration)) || 0,
        duration_seconds: typeof video.duration_seconds === 'number' ? video.duration_seconds : (Number.isFinite(Number(video.duration_seconds)) ? Number(video.duration_seconds) : null),
        tags: parsedTags,
        created_at: video.created_at || new Date().toISOString(),
        updated_at: video.updated_at || video.created_at || new Date().toISOString(),
      };
    });

    // Audit (non-blocking)
    await writeAuditLog(req, getUserFromRequest(req), 'videos.list', `count=${transformedVideos.length}`, {
      limit,
      offset,
      publication_status: hasFilter ? publicationStatus : 'any',
    });

    const res = NextResponse.json({ success: true, videos: transformedVideos });
    // Disable caching for admin/API routes to ensure fresh data
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos', details: String(error) },
      { status: 500 }
    );
  }
}

const videoCreateSchema = z.object({
  title: z.string().min(1),
  artist_name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  short_description: z.string().optional().nullable(),
  long_description: z.string().optional().nullable(),
  ai_description: z.string().optional().nullable(),
  tags: z.union([z.string(), z.array(z.string())]).optional().default('[]'),
  url: z.string().min(1),
  poster_url: z.string().optional().default(''),
  thumbnail: z.string().optional().default(''),
  duration: z.union([z.string(), z.number()]).optional().default(''),
  duration_seconds: z.union([z.number(), z.string()]).optional().nullable(),
  category: z.string().optional().default(''),
  is_public: z.union([z.boolean(), z.number(), z.string()]).optional().default(false),
  type: z.string().optional().default(''),
  mood: z.string().optional().default(''),
  credits: z.union([z.string(), z.array(z.any())]).optional().default('[]'),
  related_projects: z.union([z.string(), z.array(z.any())]).optional().default('[]'),
  status: z.string().optional().default('published'),
  publication_status: z.enum(['live','archived']).optional().default('live'),
  thumbnail_timestamp_pct: z.union([z.number(), z.string()]).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }
    const json = await req.json();
    const parse = videoCreateSchema.safeParse(json);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid body', details: parse.error.flatten() }, { status: 400 });
    }
    const body = parse.data as z.infer<typeof videoCreateSchema>;

    const title = body.title.trim();
    const artist_name = body.artist_name || '';
  const description = body.description || '';
  const short_description = body.short_description ?? null;
  const long_description = body.long_description ?? null;
  const ai_description = body.ai_description ?? null;
  const tagsJson = Array.isArray(body.tags) ? JSON.stringify(body.tags) : (typeof body.tags === 'string' ? body.tags : '[]');
    const url = (body as any).url || (body as any).video_url || '';
    const poster_url = (body as any).poster_url || (body as any).thumbnail_url || '';
    const thumbnail = body.thumbnail || '';
    const duration = body.duration ?? '';
  const duration_seconds = body.duration_seconds === '' ? null : (body.duration_seconds as any);
    const category = body.category || '';
    const is_public = body.is_public === true || body.is_public === 1 || body.is_public === '1' || body.is_public === 'true' ? 1 : 0;
    // Normalize type to ensure consistency across all videos
    const type = normalizeVideoType(body.type);
    const mood = body.mood || '';
    const credits = typeof body.credits === 'string' ? body.credits : JSON.stringify(body.credits || []);
    const related_projects = typeof body.related_projects === 'string' ? body.related_projects : JSON.stringify(body.related_projects || []);
    const status = 'published';
    const publication_status: 'live' | 'archived' = 'live';
  const thumbnail_timestamp_pct = (body.thumbnail_timestamp_pct === '' ? null : (body.thumbnail_timestamp_pct as any));
    const uid = (body as any).uid || '';

    if (!title || !url) {
      return NextResponse.json(
        { error: 'Title and url are required' },
        { status: 400 }
      );
    }

    await executeQuery(
      `INSERT INTO videos (
        title, artist_name, description, short_description, long_description, ai_description, tags,
        url, uid, poster_url, thumbnail, duration, duration_seconds, category, is_public, type, mood,
        credits, related_projects, status, publication_status, thumbnail_timestamp_pct, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        title,
        artist_name,
        description,
        short_description,
        long_description,
        ai_description,
        tagsJson,
        url,
        uid,
        poster_url,
        thumbnail,
        String(duration),
        duration_seconds,
        category,
        is_public,
        type,
        mood,
        credits,
        related_projects,
        status,
        publication_status,
        thumbnail_timestamp_pct
      ]
    );
    // Resolve inserted ID by UID (safer across runtimes)
    let inserted: any = null;
    try {
      const rows = await queryDatabase('SELECT id FROM videos WHERE uid = ? ORDER BY created_at DESC LIMIT 1', [uid]);
      inserted = rows?.[0] || null;
    } catch {}

    // Audit
    await writeAuditLog(req, user, 'videos.create', title, { publication_status });
    return NextResponse.json({ success: true, id: inserted?.id ?? null, uid }, { status: 201 });
  } catch (error) {
    console.error('Error creating video:', error);
    return NextResponse.json(
      { error: 'Failed to create video' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }
    const body = await req.json() as { id: string; status: string };
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'ID and status are required' },
        { status: 400 }
      );
    }

    await executeQuery(
      'UPDATE videos SET status = ? WHERE id = ?',
      [status, id]
    );
    // Audit
    await writeAuditLog(req, user, 'videos.update_status', String(id), { status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating video status:', error);
    return NextResponse.json(
      { error: 'Failed to update video status' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }
    const body = await req.json() as { id: string };
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // First, get the video data to find associated files
    const videos = await queryDatabase('SELECT * FROM videos WHERE id = ?', [id]);
    const video = videos[0];

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Extract file keys from URLs for R2 deletion
    const videoUrl = video?.url || video?.video_url;
    const thumbnailUrl = video?.poster_url || video?.thumbnail_url || video?.thumbnail;

    // Helper function to extract key from URL
    const extractKeyFromUrl = (url: string): string | null => {
      if (!url) return null;
      
      // Handle different URL formats
      if (url.startsWith('https://media.odubo.studio/')) {
        return url.replace('https://media.odubo.studio/', '');
      }
      
      // If it's already just a key (no protocol), use as-is
      if (!url.startsWith('http')) {
        return url;
      }
      
      // For other URL formats, try to extract the last part
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    };

    const videoKey = extractKeyFromUrl(videoUrl);
    const thumbnailKey = extractKeyFromUrl(thumbnailUrl);

    console.log('Deleting files:', { videoKey, thumbnailKey, originalUrls: { videoUrl, thumbnailUrl } });

    // Delete from R2 storage if files exist
    if (videoKey) {
      try {
        const deleteResult = await deleteFile(videoKey);
        if (!deleteResult.success) {
          console.error('Failed to delete video from R2:', deleteResult.error);
        } else {
          console.log('Successfully deleted video from R2:', videoKey);
        }
      } catch (error) {
        console.error('Error deleting video from R2:', error);
      }
    }

    if (thumbnailKey) {
      try {
        const deleteResult = await deleteFile(thumbnailKey);
        if (!deleteResult.success) {
          console.error('Failed to delete thumbnail from R2:', deleteResult.error);
        } else {
          console.log('Successfully deleted thumbnail from R2:', thumbnailKey);
        }
      } catch (error) {
        console.error('Error deleting thumbnail from R2:', error);
      }
    }

    // Delete from Cloudflare Stream if UID exists
    if (video.uid) {
      try {
        const stream = new CloudflareStreamAPI();
        await stream.deleteVideo(video.uid);
      } catch (e) {
        console.error('Failed to delete from Cloudflare Stream:', e);
      }
    }

    // Delete associated clips
    try {
      const clips = await queryDatabase(
        `SELECT id, uid FROM videos WHERE type = 'clip' AND related_projects LIKE ?`,
        [`%parent_id:${id}%`]
      );
      
      if (clips.length > 0) {
        const stream = new CloudflareStreamAPI();
        for (const clip of clips) {
          if (clip.uid) {
            try {
              await stream.deleteVideo(clip.uid);
            } catch (e) {
              console.error(`Failed to delete clip ${clip.id} from Stream:`, e);
            }
          }
          await executeQuery('DELETE FROM videos WHERE id = ?', [clip.id]);
        }
      }
    } catch (e) {
      console.error('Failed to delete associated clips:', e);
    }

    // Delete video from database
    await executeQuery('DELETE FROM videos WHERE id = ?', [id]);
    // Audit
    await writeAuditLog(req, user, 'videos.delete', String(id));
    return NextResponse.json({ 
      success: true,
      message: 'Video and associated files deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    );
  }
}
