import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { z } from 'zod';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { deleteFile } from '@/worker/upload';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';

function toIntBoolean(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  if (typeof value === 'string') return value === 'true' || value === '1' ? 1 : 0;
  return null;
}

function safeJsonStringify(value: any): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await queryDatabase(
      `SELECT 
        id,
        COALESCE(uid, '') as uid,
        title,
        COALESCE(artist_name, '') as artist_name,
        description,
        url,
        poster_url,
        thumbnail,
        duration,
        category,
        is_public,
        type,
        mood,
        credits,
        related_projects,
        COALESCE(status, 'published') as status,
        created_at,
        COALESCE(updated_at, created_at) as updated_at
      FROM videos WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const video = rows[0];
    try { await writeAuditLog(_req, getUserFromRequest(_req), 'videos.get', String(id)); } catch {}
    return NextResponse.json({ success: true, video });
  } catch (error) {
    console.error('Error fetching video:', error);
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 });
  }
}

const videoUpdateSchema = z.object({
  title: z.string().optional(),
  artist_name: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  poster_url: z.string().optional(),
  thumbnail: z.string().optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  category: z.string().optional(),
  is_public: z.union([z.boolean(), z.number(), z.string()]).optional(),
  type: z.string().optional(),
  mood: z.string().optional(),
  credits: z.union([z.string(), z.array(z.any())]).optional(),
  related_projects: z.union([z.string(), z.array(z.any())]).optional(),
  status: z.string().optional(),
  ai_description: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const { id } = await params;

    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    if (contentType.includes('application/json')) {
      const json = await req.json();
      const parse = videoUpdateSchema.safeParse(json);
      if (!parse.success) {
        return NextResponse.json({ error: 'Invalid body', details: parse.error.flatten() }, { status: 400 });
      }
      body = parse.data;
    } else if (contentType.startsWith('multipart/form-data')) {
      const form = await req.formData();
      // Only metadata updates here; file uploads should use create/upload routes
      form.forEach((value, key) => {
        body[key] = typeof value === 'string' ? value : undefined;
      });
    }

    const fields: string[] = [];
    const paramsList: any[] = [];

    const updatable = {
      title: body.title,
      artist_name: body.artist_name,
      description: body.description,
      url: body.url || body.video_url,
      poster_url: body.poster_url || body.thumbnail_url,
      thumbnail: body.thumbnail,
      duration: body.duration,
      category: body.category,
      is_public: toIntBoolean(body.is_public),
      type: body.type,
      mood: body.mood,
      credits: safeJsonStringify(body.credits),
      related_projects: safeJsonStringify(body.related_projects),
      status: body.status,
      ai_description: safeJsonStringify(body.ai_description),
    } as Record<string, any>;

    console.log('Updating video:', id, updatable);

    Object.entries(updatable).forEach(([column, value]) => {
      if (value !== null && value !== undefined) {
        fields.push(`${column} = ?`);
        paramsList.push(value);
      }
    });

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Always update timestamp when supported
    fields.push(`updated_at = datetime('now')`);

    await executeQuery(
      `UPDATE videos SET ${fields.join(', ')} WHERE id = ?`,
      [...paramsList, id]
    );

    // Best-effort sync to Cloudflare Stream metadata if we have a stream_video_id
    try {
      const rows = await queryDatabase('SELECT stream_video_id FROM videos WHERE id = ? LIMIT 1', [id]);
      const uid = rows?.[0]?.stream_video_id as string | undefined;
      if (uid) {
        const { default: CloudflareStreamAPI } = await import('@/lib/cloudflareStream');
        const stream = new CloudflareStreamAPI();
        const meta: Record<string, any> = {};
        if (body.title) meta.title = body.title;
        if (body.artist_name) meta.creator = body.artist_name;
        if (body.description) meta.description = body.description;
        if (body.category) meta.category = body.category;
        if (body.type) meta.type = body.type;
        if (body.mood) meta.mood = body.mood;
        if (body.credits) meta.credits = typeof body.credits === 'string' ? body.credits : JSON.stringify(body.credits);
        if (body.related_projects) meta.related_projects = typeof body.related_projects === 'string' ? body.related_projects : JSON.stringify(body.related_projects);
        if (body.category || body.type || body.mood) meta.tags = [body.category, body.type, body.mood].filter(Boolean).join(',');
        if (Object.keys(meta).length > 0) {
          await stream.updateVideo(uid, { meta });
        }
      }
    } catch (e) {
      // Non-fatal: Stream sync can fail silently
      console.warn('Stream metadata sync skipped/failed:', e);
    }

    // Audit
    await writeAuditLog(req, user, 'videos.update', String(id), { fields: Object.keys(updatable).filter(k => updatable[k] !== null && updatable[k] !== undefined) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating video:', error);
    return NextResponse.json({ error: 'Failed to update video' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const { id } = await params;

    const rows = await queryDatabase('SELECT url, poster_url, thumbnail, stream_video_id FROM videos WHERE id = ?', [id]);
    if (!rows.length) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    const video = rows[0];

    const extractKeyFromUrl = (url: string): string | null => {
      if (!url) return null;
      if (url.startsWith('https://media.odubo.studio/')) {
        return url.replace('https://media.odubo.studio/', '');
      }
      if (!url.startsWith('http')) return url;
      const parts = url.split('/');
      return parts[parts.length - 1] || null;
    };

    const maybeKeys = [video?.url, video?.poster_url, video?.thumbnail]
      .map((u: string) => extractKeyFromUrl(u))
      .filter(Boolean) as string[];

    for (const key of maybeKeys) {
      try {
        const res = await deleteFile(key);
        if (!res.success) console.warn('Failed to delete from R2:', key, res.error);
      } catch (e) {
        console.warn('Delete R2 error for', key, e);
      }
    }

    // Attempt to delete Cloudflare Stream asset if present
    try {
      const uid = (video as any)?.stream_video_id as string | undefined;
      if (uid) {
        // Lazy import to avoid throwing if not configured
        const { default: CloudflareStreamAPI } = await import('@/lib/cloudflareStream');
        const stream = new CloudflareStreamAPI();
        await stream.deleteVideo(uid);
      }
    } catch (e) {
      console.warn('Failed to delete Cloudflare Stream video (non-fatal):', e);
    }

    await executeQuery('DELETE FROM videos WHERE id = ?', [id]);
    // Audit
    await writeAuditLog(req, user, 'videos.delete', String(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}


