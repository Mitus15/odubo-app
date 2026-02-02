
import { NextRequest, NextResponse } from 'next/server';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface UploadRequestBody {
  name?: string;
  meta?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json() as UploadRequestBody;
    const { name, meta } = body;

    const stream = new CloudflareStreamAPI();
    // Set maxDurationSeconds to 3600 (1 hour) or allow client to specify if needed.
    // Cloudflare Stream requires this for direct uploads.
    const response = await stream.createUploadUrl(3600, {
      name,
      meta
    });

    if (!response.success) {
      return NextResponse.json({ error: 'Failed to create upload URL', details: response }, { status: 500 });
    }

    return NextResponse.json(response.result);
  } catch (error: any) {
    console.error('Error creating upload URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
