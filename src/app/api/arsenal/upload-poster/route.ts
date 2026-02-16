import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

function getR2Client() {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured');
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  };
  return ext ? (map[ext] || 'image/jpeg') : 'image/jpeg';
}

/**
 * POST /api/arsenal/upload-poster
 *
 * Step 1: Get presigned upload URL
 * Body: { videoId: number, fileName: string }
 * Returns: { uploadUrl, publicUrl, key }
 *
 * Step 2: Confirm upload (after client PUTs to uploadUrl)
 * Body: { videoId: number, publicUrl: string, confirm: true }
 * Returns: { success: true }
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as {
      videoId?: number;
      fileName?: string;
      publicUrl?: string;
      confirm?: boolean;
    };
    const { videoId, fileName, publicUrl, confirm } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    // Verify video exists
    const videos = await queryDatabase(
      'SELECT id, title FROM videos WHERE id = ?',
      [videoId]
    ) as any[];

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Step 2: Confirm upload — save poster_url to DB
    if (confirm && publicUrl) {
      await executeQuery(
        `UPDATE videos SET poster_url = ?, updated_at = datetime('now') WHERE id = ?`,
        [publicUrl, videoId]
      );

      return NextResponse.json({
        success: true,
        videoId,
        poster_url: publicUrl,
      });
    }

    // Step 1: Generate presigned upload URL
    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = getMimeType(fileName);
    const key = `posters/${videoId}.${ext}`;
    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;

    if (!bucket) {
      return NextResponse.json({ error: 'R2 bucket not configured' }, { status: 500 });
    }

    const s3 = getR2Client();
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
    const resultPublicUrl = publicBase ? `${publicBase}/${key}` : null;

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl: resultPublicUrl,
      key,
      contentType,
    });
  } catch (error) {
    console.error('[Arsenal] Poster upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process poster upload' },
      { status: 500 }
    );
  }
}
