import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { deleteFile } from '@/worker/upload';
import { z } from 'zod';

export async function GET() {
  try {
    // Try with full schema first, fallback to basic schema if columns don't exist
    let videos;
    try {
      videos = await queryDatabase(
        `SELECT 
          id,
          COALESCE(uid, '') as uid,
          title,
          COALESCE(artist_name, '') as artist_name,
          description,
          url,
          url as video_url,
          poster_url,
          poster_url as thumbnail_url,
          thumbnail,
          duration,
          category,
          is_public,
          type,
          mood,
          credits,
          related_projects,
          COALESCE(status, 'published') as status,
          COALESCE(stream_video_id, '') as stream_video_id,
          created_at,
          COALESCE(updated_at, created_at) as updated_at
        FROM videos 
        ORDER BY created_at DESC`
      );
    } catch (schemaError) {
      // Fallback to basic schema if new columns don't exist
      console.log('Using fallback query for videos table');
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
        ORDER BY created_at DESC`
      );
      
      // Add missing fields for compatibility
      videos = videos.map((video: any) => ({
        ...video,
        artist_name: video.artist_name || '',
        status: video.status || 'published',
        stream_video_id: video.stream_video_id || '',
        updated_at: video.updated_at || video.created_at || new Date().toISOString(),
        thumbnail_url: video.thumbnail_url || video.poster_url || video.thumbnail || ''
      }));
    }

    const transformedVideos = (videos as any[]).map((video) => ({
      ...video,
      status: video.status || 'published',
      artist_name: video.artist_name || '',
      duration: Number.parseInt(String(video.duration)) || 0,
      created_at: video.created_at || new Date().toISOString(),
      updated_at: video.updated_at || video.created_at || new Date().toISOString(),
    }));

    const res = NextResponse.json({ success: true, videos: transformedVideos });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
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
  url: z.string().min(1),
  poster_url: z.string().optional().default(''),
  thumbnail: z.string().optional().default(''),
  duration: z.union([z.string(), z.number()]).optional().default(''),
  category: z.string().optional().default(''),
  is_public: z.union([z.boolean(), z.number(), z.string()]).optional().default(false),
  type: z.string().optional().default(''),
  mood: z.string().optional().default(''),
  credits: z.union([z.string(), z.array(z.any())]).optional().default('[]'),
  related_projects: z.union([z.string(), z.array(z.any())]).optional().default('[]'),
  status: z.string().optional().default('draft'),
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
    const url = (body as any).url || (body as any).video_url || '';
    const poster_url = (body as any).poster_url || (body as any).thumbnail_url || '';
    const thumbnail = body.thumbnail || '';
    const duration = body.duration ?? '';
    const category = body.category || '';
    const is_public = body.is_public === true || body.is_public === 1 || body.is_public === '1' || body.is_public === 'true' ? 1 : 0;
    const type = body.type || '';
    const mood = body.mood || '';
    const credits = typeof body.credits === 'string' ? body.credits : JSON.stringify(body.credits || []);
    const related_projects = typeof body.related_projects === 'string' ? body.related_projects : JSON.stringify(body.related_projects || []);
    const status = (body.status || 'draft').trim();

    if (!title || !url) {
      return NextResponse.json(
        { error: 'Title and url are required' },
        { status: 400 }
      );
    }

    await executeQuery(
      `INSERT INTO videos (
        title, artist_name, description, url, poster_url, thumbnail, duration, category, is_public, type, mood, credits, related_projects, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        title,
        artist_name,
        description,
        url,
        poster_url,
        thumbnail,
        String(duration),
        category,
        is_public,
        type,
        mood,
        credits,
        related_projects,
        status || 'draft'
      ]
    );

    return NextResponse.json({ success: true }, { status: 201 });
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

    // Delete video from database
    await executeQuery('DELETE FROM videos WHERE id = ?', [id]);

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
