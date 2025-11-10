import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';

function computeAllowedOriginsFromReq(req: NextRequest) {
  const headerOrigin = (req.headers.get('origin') || '').replace(/\/$/, '');
  const envOriginRaw = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const envOrigin = envOriginRaw
    ? (envOriginRaw.startsWith('http') ? envOriginRaw : `https://${envOriginRaw}`)
    : '';

  const allowedOriginsRaw = Array.from(new Set([
    headerOrigin || undefined,
    envOrigin || undefined,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : undefined,
    process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3000' : undefined,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3001' : undefined,
    process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3001' : undefined,
  ].filter(Boolean) as string[]));

  const allowedOriginsNormalized = allowedOriginsRaw
    .map(o => String(o).replace(/^https?:\/\//i, '').replace(/\/$/, ''))
    .filter(Boolean);

  const hostSet = new Set<string>(
    allowedOriginsNormalized.map(h => h.replace(/:\d+$/, ''))
  );
  if (process.env.NODE_ENV !== 'production') {
    hostSet.add('localhost');
    hostSet.add('127.0.0.1');
  }
  const allowedOrigins = Array.from(hostSet);

  return {
    headerOrigin,
    envOriginRaw,
    envOrigin,
    allowedOriginsRaw,
    allowedOriginsNormalized,
    allowedOrigins,
  };
}

export async function GET(req: NextRequest) {
  // Lightweight debug endpoint to inspect computed origins; safe data only
  try {
    const computed = computeAllowedOriginsFromReq(req);
    return NextResponse.json({ ok: true, ...computed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

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
    // Proactive env validation for clearer errors
    const hasAccount = !!process.env.CLOUDFLARE_ACCOUNT_ID;
    const hasStreamToken = !!(process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN);
    if (!hasAccount || !hasStreamToken) {
      return NextResponse.json({ 
        error: 'Cloudflare Stream credentials not configured',
        code: 'STREAM_CREDS_MISSING',
        expectedEnv: {
          CLOUDFLARE_ACCOUNT_ID: hasAccount ? 'present' : 'missing',
          CLOUDFLARE_STREAM_API_TOKEN_or_CLOUDFLARE_API_TOKEN: hasStreamToken ? 'present' : 'missing'
        }
      }, { status: 500 });
    }

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

    let stream: CloudflareStreamAPI;
    try {
      stream = new CloudflareStreamAPI();
    } catch (e: any) {
      console.error('Stream client init failed:', e?.message || e);
      return NextResponse.json({ 
        error: 'Failed to initialize Stream client', 
        code: 'STREAM_CLIENT_INIT',
        details: e?.message || String(e)
      }, { status: 500 });
    }
    // Configure CORS for Cloudflare Stream direct upload using computed origins
    const { allowedOrigins } = computeAllowedOriginsFromReq(req);

    let res;
    try {
      res = await stream.createUploadUrl(3600, {
        name: title || `upload-${Date.now()}`,
        requireSignedURLs: !(is_public === 1),
        allowedOrigins,
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
    } catch (e: any) {
      console.error('Stream direct upload URL API error:', e?.message || e);
      return NextResponse.json({ 
        error: 'Stream API error creating upload URL',
        code: 'STREAM_API_ERROR',
        details: e?.message || String(e),
        allowedOriginsSent: allowedOrigins
      }, { status: 500 });
    }

    const json = { success: true, uploadURL: res.result.uploadURL, uid: res.result.uid, allowedOrigins } as const;
    try { await writeAuditLog(req, user, 'videos.stream_direct_upload_url', res.result.uid, { title, is_public }); } catch {}
    return NextResponse.json(json);
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
