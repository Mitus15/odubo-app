import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// R2 credentials from environment
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'odubo-studio-media';
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

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
    // Check if R2 is configured
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { error: 'Storage not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY.' },
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
      const entityResults = await queryDatabase(
        'SELECT slug FROM entities WHERE id = ?',
        [entityId]
      );
      const entity = entityResults?.[0] as { slug: string } | undefined;
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

    // Upload to R2 via S3-compatible API
    const arrayBuffer = await file.arrayBuffer();
    const uploadSuccess = await uploadToR2(key, arrayBuffer, file.type, {
      originalFilename: file.name,
      uploadedAt: now.toISOString(),
      entityId: entityId || '',
      entitySlug,
      mediaType: isVideo ? 'video' : 'image',
      fileSize: String(file.size),
    });

    if (!uploadSuccess) {
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // Build public URL
    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
      : `https://media.odubo.studio/${key}`;

    // Register in media registry for audit trail
    const registryId = crypto.randomUUID().split('-')[0];
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    try {
      await executeQuery(
        `INSERT INTO media_registry (
          id, storage_type, storage_key, storage_bucket,
          public_url, media_type, content_type, file_size_bytes,
          original_filename, entity_id, category,
          uploaded_by, upload_source, upload_ip, user_agent
        ) VALUES (?, 'r2', ?, ?, ?, ?, ?, ?, ?, ?, 'social', 'system', 'web', ?, ?)`,
        [
          registryId,
          key,
          R2_BUCKET_NAME,
          publicUrl,
          isVideo ? 'video' : 'image',
          file.type,
          file.size,
          file.name,
          entityId || null,
          clientIp,
          userAgent.slice(0, 500),
        ]
      );

      // Log the upload action
      await executeQuery(
        `INSERT INTO media_audit_log (id, action, media_id, storage_type, storage_key, actor_id, actor_ip, details)
         VALUES (?, 'upload', ?, 'r2', ?, 'system', ?, ?)`,
        [
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
          }),
        ]
      );
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
 * Upload file to R2 using S3-compatible API with AWS Signature V4
 */
async function uploadToR2(
  key: string,
  body: ArrayBuffer,
  contentType: string,
  metadata: Record<string, string>
): Promise<boolean> {
  try {
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const url = `${endpoint}/${R2_BUCKET_NAME}/${key}`;

    // For R2, we need to use AWS Signature V4
    // This is a simplified version - for production, use a proper AWS SDK
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };

    // Add custom metadata
    for (const [k, v] of Object.entries(metadata)) {
      if (v) {
        headers[`x-amz-meta-${k.toLowerCase()}`] = v;
      }
    }

    // Create canonical request
    const method = 'PUT';
    const canonicalUri = `/${R2_BUCKET_NAME}/${key}`;
    const canonicalQueryString = '';

    const sortedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaders.map(h => `${h.toLowerCase()}:${headers[h]}\n`).join('');
    const signedHeaders = sortedHeaders.map(h => h.toLowerCase()).join(';');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const region = 'auto';
    const service = 's3';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const canonicalRequestHash = await sha256Hex(canonicalRequest);
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join('\n');

    // Calculate signature
    const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + R2_SECRET_ACCESS_KEY!), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    const signature = await hmacSha256Hex(kSigning, stringToSign);

    // Create authorization header
    const authorization = `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    headers['Authorization'] = authorization;

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[R2 Upload] Failed:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[R2 Upload] Error:', error);
    return false;
  }
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function hmacSha256Hex(key: ArrayBuffer | Uint8Array, message: string): Promise<string> {
  const signature = await hmacSha256(key, message);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
