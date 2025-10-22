import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // Admin only
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
  }
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await rateLimit({ key: `stream-direct:${ip}`, limit: 10, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const title: string = (body.title || '').toString();
    const is_public: number = body.is_public === true || body.is_public === 1 || body.is_public === '1' || body.is_public === 'true' ? 1 : 0;
    const artist_name: string = (body.artist_name || '').toString();
    const description: string = (body.description || '').toString();
    const category: string = (body.category || '').toString();
    const type: string = (body.type || '').toString();
    const mood: string = (body.mood || '').toString();
    const credits = body.credits ?? '';
    const related_projects = body.related_projects ?? '';

    const stream = new CloudflareStreamAPI();
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : undefined;

    const res = await stream.createUploadUrl(3600, {
      name: title,
      requireSignedURLs: !(is_public === 1),
      allowedOrigins: siteOrigin,
      meta: {
        title: title,
        creator: artist_name || '',
        artist_name,
        description,
        category,
        type,
        mood,
        credits: typeof credits === 'string' ? credits : JSON.stringify(credits),
        related_projects: typeof related_projects === 'string' ? related_projects : JSON.stringify(related_projects),
        tags: [category, type, mood].filter(Boolean).join(','),
        uploadedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, uploadURL: res.result.uploadURL, uid: res.result.uid });
  } catch (error) {
    console.error('Direct upload URL error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Failed to create Stream upload URL', 
      details: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
