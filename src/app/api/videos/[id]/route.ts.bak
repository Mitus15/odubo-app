import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { z } from 'zod';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { deleteFile } from '@/worker/upload';
import { writeAuditLog } from '@/lib/audit';
import { normalizeVideoType } from '@/types/videoTypes';

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
        shopify_product_id,
        shopify_product_handle,
        created_at,
        COALESCE(updated_at, created_at) as updated_at
      FROM videos WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const video = rows[0] as Record<string, any>;
    
    // Try to extract UID from URL if uid column is empty
    if (!video.uid && video.url) {
      // Pattern: cloudflarestream.com/<UID> or videodelivery.net/<UID>
      const match = video.url.match(/(?:cloudflarestream\.com|videodelivery\.net)\/([a-f0-9]{32})/i);
      if (match) {
        video.uid = match[1];
      }
    }
    
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
  // Allow empty string and coerce to number when possible
  duration: z.union([z.string(), z.number()]).optional(),
  category: z.string().optional(),
  is_public: z.union([z.boolean(), z.number(), z.string()]).optional(),
  type: z.string().optional(),
  mood: z.string().optional(),
  credits: z.union([z.string(), z.array(z.any())]).optional(),
  related_projects: z.union([z.string(), z.array(z.any())]).optional(),
  status: z.string().optional(),
  publication_status: z.string().optional(),
  // Accept any JSON-compatible value to avoid strict rejection
  ai_description: z.any().optional(),
  shopify_product_id: z.string().optional().nullable(),
  shopify_product_handle: z.string().optional().nullable(),
  set_poster_from_time: z.number().optional(),
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
    // Fetch current row for UID (for poster generation)
    const existingRows = await queryDatabase('SELECT uid, stream_video_id, url FROM videos WHERE id = ? LIMIT 1', [id]);
    const current = existingRows?.[0] || {};
    
    // Extract UID from URL if not stored directly
    let videoUid = current.uid || current.stream_video_id;
    if (!videoUid && current.url) {
      const match = current.url.match(/cloudflarestream\.com\/([a-f0-9]{32})/);
      if (match) videoUid = match[1];
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
      duration: ((): any => {
        const d = body.duration;
        if (d === '' || d === null || d === undefined) return undefined;
        if (typeof d === 'number') return d;
        const n = parseFloat(String(d));
        return Number.isFinite(n) ? n : undefined;
      })(),
      category: body.category,
      is_public: toIntBoolean(body.is_public),
      // Normalize type to ensure consistency
      type: body.type !== undefined ? normalizeVideoType(body.type) : undefined,
      mood: body.mood,
      credits: safeJsonStringify(body.credits),
      related_projects: safeJsonStringify(body.related_projects),
      status: 'published',
      publication_status: body.is_public === undefined ? undefined : (toIntBoolean(body.is_public) ? 'live' : 'archived'),
      ai_description: safeJsonStringify(body.ai_description),
      shopify_product_id: body.shopify_product_id,
      shopify_product_handle: body.shopify_product_handle,
    } as Record<string, any>;

    // Derived poster from time
    if (body.set_poster_from_time !== undefined) {
      if (videoUid) {
        updatable.poster_url = `https://videodelivery.net/${videoUid}/thumbnails/thumbnail.jpg?time=${body.set_poster_from_time}`;
        // Also save the UID if it was extracted from URL
        if (!current.uid && videoUid) {
          updatable.uid = videoUid;
        }
      }
    }

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

    // Propagate visibility/status to clips
    if (updatable.is_public !== undefined || updatable.status !== undefined || updatable.publication_status !== undefined) {
      const clipUpdates: string[] = [];
      const clipParams: any[] = [];
      
      if (updatable.is_public !== undefined) {
        clipUpdates.push('is_public = ?');
        clipParams.push(updatable.is_public);
      }
      clipUpdates.push('status = ?');
      clipParams.push('published');
      if (updatable.publication_status !== undefined) {
        clipUpdates.push('publication_status = ?');
        clipParams.push(updatable.publication_status);
      }
      
      if (clipUpdates.length > 0) {
        clipUpdates.push("updated_at = datetime('now')");
        await executeQuery(
          `UPDATE videos SET ${clipUpdates.join(', ')} WHERE type = 'clip' AND related_projects LIKE ?`,
          [...clipParams, `%parent_id:${id}%`]
        );
      }
    }

    // Propagate Shopify product info to child clips if updated
    if (body.shopify_product_id !== undefined || body.shopify_product_handle !== undefined) {
      const productFields = [];
      const productParams = [];
      
      if (body.shopify_product_id !== undefined) {
        productFields.push('shopify_product_id = ?');
        productParams.push(body.shopify_product_id);
      }
      if (body.shopify_product_handle !== undefined) {
        productFields.push('shopify_product_handle = ?');
        productParams.push(body.shopify_product_handle);
      }
      
      if (productFields.length > 0) {
        console.log(`Propagating product info to clips of video ${id}`);
        await executeQuery(
          `UPDATE videos 
           SET ${productFields.join(', ')}, updated_at = datetime('now')
           WHERE type = 'clip' AND related_projects LIKE ?`,
          [...productParams, `%parent_id:${id}%`]
        );
      }
    }

    // Best-effort sync to Cloudflare Stream metadata if we have a stream_video_id
    try {
      const uid = current.stream_video_id as string | undefined;
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

    // Update Woda video context for passive learning
    try {
      // Get parent_video_id from the current video
      const videoRows = await queryDatabase('SELECT parent_video_id FROM videos WHERE id = ? LIMIT 1', [id]);
      const parentVideoId = videoRows?.[0]?.parent_video_id as number | null;

      await executeQuery(
        `INSERT INTO woda_video_context (video_id, title, description, mood, category, type, artist_name, is_clip, parent_video_id, captured_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(video_id) DO UPDATE SET
           title = COALESCE(excluded.title, woda_video_context.title),
           description = COALESCE(excluded.description, woda_video_context.description),
           mood = COALESCE(excluded.mood, woda_video_context.mood),
           category = COALESCE(excluded.category, woda_video_context.category),
           type = COALESCE(excluded.type, woda_video_context.type),
           artist_name = COALESCE(excluded.artist_name, woda_video_context.artist_name),
           is_clip = COALESCE(excluded.is_clip, woda_video_context.is_clip),
           parent_video_id = COALESCE(excluded.parent_video_id, woda_video_context.parent_video_id),
           updated_at = datetime('now')`,
        [
          id,
          updatable.title || null,
          updatable.description || null,
          updatable.mood || null,
          updatable.category || null,
          updatable.type || null,
          updatable.artist_name || null,
          parentVideoId ? 1 : 0,
          parentVideoId,
        ]
      );
    } catch (e) {
      console.warn('[Woda] Failed to update video context:', e);
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
    console.log(`[DELETE] Starting deletion of video ${id}`);

    const rows = await queryDatabase('SELECT url, poster_url, thumbnail, stream_video_id FROM videos WHERE id = ?', [id]);
    if (!rows.length) {
      console.warn(`[DELETE] Video ${id} not found`);
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    const video = rows[0];
    console.log(`[DELETE] Found video ${id}, proceeding with deletion`);

    const extractKeyFromUrl = (url: string): string | null => {
      if (!url) return null;
      if (url.startsWith('https://media.odubo.studio/')) {
        return url.replace('https://media.odubo.studio/', '');
      }
      if (!url.startsWith('http')) return url;
      const parts = url.split('/');
      return parts[parts.length - 1] || null;
    };

    // First, find and delete all child clips (by parent_video_id)
    console.log(`[DELETE] Looking for child clips of video ${id}`);
    try {
      // Find child videos by parent_video_id (the actual foreign key column)
      const childClips = await queryDatabase(
        `SELECT id, url, poster_url, thumbnail, stream_video_id FROM videos WHERE parent_video_id = ?`,
        [id]
      );
      
      console.log(`[DELETE] Found ${childClips?.length || 0} child clips by parent_video_id`);

      for (const clip of childClips || []) {
        console.log(`[DELETE] Deleting child clip ${clip.id}`);
        // Delete clip resources from R2 and Stream
        const clipKeys = [clip.url, clip.poster_url, clip.thumbnail]
          .map((u: string) => extractKeyFromUrl(u))
          .filter(Boolean) as string[];

        for (const key of clipKeys) {
          try {
            const res = await deleteFile(key);
            if (!res.success) console.warn('Failed to delete clip from R2:', key, res.error);
          } catch (e) {
            console.warn('Delete R2 error for clip', key, e);
          }
        }

        // Delete from Cloudflare Stream
        try {
          const uid = clip.stream_video_id as string | undefined;
          if (uid) {
            const { default: CloudflareStreamAPI } = await import('@/lib/cloudflareStream');
            const stream = new CloudflareStreamAPI();
            await stream.deleteVideo(uid);
          }
        } catch (e) {
          console.warn('Failed to delete clip from Cloudflare Stream (non-fatal):', e);
        }
      }

      // Delete all child clips from database
      console.log(`[DELETE] Deleting child clip records from database`);
      await executeQuery('DELETE FROM videos WHERE parent_video_id = ?', [id]);
      console.log(`[DELETE] Child clip records deleted successfully`);
    } catch (e) {
      console.error('Error deleting child clips:', e);
      // Continue with parent deletion anyway
    }

    // Delete parent video resources
    console.log(`[DELETE] Deleting parent video ${id} resources from R2`);
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
    console.log(`[DELETE] Deleting parent video ${id} from Cloudflare Stream`);
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

    // Delete from database
    console.log(`[DELETE] Deleting video ${id} from database`);
    const result = await executeQuery('DELETE FROM videos WHERE id = ?', [id]);
    console.log(`[DELETE] Database deletion result:`, result);

    // Audit - wrap in try-catch to ensure deletion succeeds even if audit fails
    try {
      await writeAuditLog(req, user, 'videos.delete', String(id));
    } catch (auditError) {
      console.error(`[DELETE] Audit log failed (non-fatal):`, auditError);
      // Don't return error, deletion was successful
    }

    console.log(`[DELETE] Video ${id} deleted successfully`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: `Failed to delete video: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}


