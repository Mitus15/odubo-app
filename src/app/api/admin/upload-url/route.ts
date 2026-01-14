import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

// POST: Create direct upload URL for Cloudflare Stream (admin only)
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { filename, name, meta } = body;

    const stream = new CloudflareStreamAPI();

    // Create direct upload URL (1 hour max duration)
    const response = await stream.createUploadUrl(3600, {
      name: name || filename || 'video-upload',
      meta: meta || {},
    });

    if (!response.success) {
      return NextResponse.json(
        { error: 'Failed to create upload URL' },
        { status: 500 }
      );
    }

    // Return the upload URL and video UID
    return NextResponse.json({
      uploadURL: response.result.uploadURL,
      uid: response.result.uid,
    });
  } catch (e: any) {
    console.error('Upload URL error:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to create upload URL') },
      { status: 500 }
    );
  }
}
