import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, any>;
    const uid = (body.uid || '').toString();
    if (!uid) return NextResponse.json({ error: 'uid is required' }, { status: 400 });

    const title: string = (body.title || '').toString();
    const artist_name: string = (body.artist_name || '').toString();
    const description: string = (body.description || '').toString();
    const category: string = (body.category || '').toString();
    const type: string = (body.type || '').toString();
    const mood: string = (body.mood || '').toString();
    const is_public = body.is_public === true || body.is_public === 1 || body.is_public === '1' || body.is_public === 'true' ? 1 : 0;
    const credits = body.credits ?? '';
    const related_projects = body.related_projects ?? '';
    const publication_status: 'live' | 'archived' = (body.publication_status === 'live' ? 'live' : 'archived');

    // Optionally fetch details to get duration and confirm readiness
    const stream = new CloudflareStreamAPI();
    const details = await stream.getVideo(uid).catch(() => null as any);

    const embedUrl = stream.getEmbedUrl(uid);
    const posterUrl = stream.getThumbnailUrl(uid);
    const seconds = Number(details?.result?.duration || 0);
    const duration = seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '';

    await executeQuery(
      `INSERT INTO videos (
        uid, title, artist_name, description, url, poster_url, thumbnail, duration,
        category, is_public, type, mood, credits, related_projects, status, stream_video_id,
        publication_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, datetime('now'), datetime('now'))`,
      [
        uid,
        title || uid,
        artist_name,
        description,
        embedUrl,
        posterUrl,
        posterUrl,
        duration,
        category,
        is_public,
        type,
        mood,
        typeof credits === 'string' ? credits : JSON.stringify(credits),
        typeof related_projects === 'string' ? related_projects : JSON.stringify(related_projects),
        uid,
        publication_status,
      ]
    );

    return NextResponse.json({ success: true, uid, url: embedUrl });
  } catch (error) {
    console.error('Complete Stream upload error:', error);
    return NextResponse.json({ error: 'Failed to record video' }, { status: 500 });
  }
}
