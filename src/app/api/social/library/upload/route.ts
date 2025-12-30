import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

/**
 * POST /api/social/library/upload
 * Upload media for social posting with professional-grade organization
 *
 * Storage Path Convention:
 *   social/{entity_slug}/{YYYY}/{MM}/{DD}/{uuid}.{ext}
 *
 * Features:
 *   - Date-based organization for easy browsing/archival
 *   - Entity separation for multi-brand management
 *   - UUID filenames prevent collisions and expose no user data
 *   - Full audit trail via media_registry
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;
    const r2 = env.MEDIA_BUCKET;

    if (!r2) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityId = formData.get('entity_id') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images and videos are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 500MB.' },
        { status: 400 }
      );
    }

    // Get entity slug for path organization
    let entitySlug = 'general';
    if (entityId) {
      const entity = await db
        .prepare('SELECT slug FROM entities WHERE id = ?')
        .bind(entityId)
        .first<{ slug: string }>();
      if (entity?.slug) {
        entitySlug = entity.slug;
      }
    }

    // Generate professional path: social/{entity}/{YYYY}/{MM}/{DD}/{uuid}.{ext}
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const ext = getExtension(file.name, file.type);

    const key = `social/${entitySlug}/${year}/${month}/${day}/${uuid}.${ext}`;

    // Upload to R2 with comprehensive metadata
    const arrayBuffer = await file.arrayBuffer();
    await r2.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        originalFilename: file.name,
        uploadedAt: now.toISOString(),
        entityId: entityId || '',
        entitySlug,
        mediaType: isVideo ? 'video' : 'image',
        fileSize: String(file.size),
      },
    });

    // Build public URL
    const r2PublicUrl = (env as Record<string, unknown>).CLOUDFLARE_R2_PUBLIC_URL as string | undefined;
    const publicUrl = r2PublicUrl
      ? `${r2PublicUrl.replace(/\/$/, '')}/${key}`
      : `https://media.odubo.studio/${key}`;

    // Register in media registry for audit trail
    const registryId = crypto.randomUUID().split('-')[0];
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    try {
      await db
        .prepare(`
          INSERT INTO media_registry (
            id, storage_type, storage_key, storage_bucket,
            public_url, media_type, content_type, file_size_bytes,
            original_filename, entity_id, category,
            uploaded_by, upload_source, upload_ip, user_agent
          ) VALUES (?, 'r2', ?, ?, ?, ?, ?, ?, ?, ?, 'social', 'system', 'web', ?, ?)
        `)
        .bind(
          registryId,
          key,
          'odubo-studio-media',
          publicUrl,
          isVideo ? 'video' : 'image',
          file.type,
          file.size,
          file.name,
          entityId || null,
          clientIp,
          userAgent.slice(0, 500)
        )
        .run();

      // Log the upload action
      await db
        .prepare(`
          INSERT INTO media_audit_log (id, action, media_id, storage_type, storage_key, actor_id, actor_ip, details)
          VALUES (?, 'upload', ?, 'r2', ?, 'system', ?, ?)
        `)
        .bind(
          crypto.randomUUID().split('-')[0],
          registryId,
          key,
          clientIp,
          JSON.stringify({
            originalFilename: file.name,
            contentType: file.type,
            fileSize: file.size,
            entityId,
            entitySlug,
          })
        )
        .run();
    } catch (dbErr) {
      // Log error but don't fail the upload - file is already in R2
      console.error('[Social Upload] Registry insert failed:', dbErr);
    }

    return NextResponse.json({
      success: true,
      id: registryId,
      key,
      url: publicUrl,
      type: isVideo ? 'video' : 'image',
      filename: file.name,
      size: file.size,
      contentType: file.type,
      path: {
        entity: entitySlug,
        date: `${year}-${month}-${day}`,
      },
    });
  } catch (error) {
    console.error('[Social Upload] Error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * Get file extension from filename or MIME type
 */
function getExtension(filename: string, mimeType: string): string {
  // Try to get from filename first
  const fromName = filename.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  // Fall back to MIME type mapping
  const mimeMap: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-msvideo': 'avi',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };

  return mimeMap[mimeType] || (mimeType.startsWith('video/') ? 'mp4' : 'jpg');
}
