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
  return { allowedOrigins, headerOrigin, envOrigin, allowedOriginsRaw, allowedOriginsNormalized };
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
  }
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await rateLimit({ key: `stream-upload-proxy:${ip}`, limit: 6, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const hasAccount = !!process.env.CLOUDFLARE_ACCOUNT_ID;
    const hasStreamToken = !!(process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN);
    if (!hasAccount || !hasStreamToken) {
      return NextResponse.json({ 
        error: 'Cloudflare Stream credentials not configured',
        code: 'STREAM_CREDS_MISSING'
      }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing video file', code: 'NO_FILE' }, { status: 400 });
    }
    const title = String(form.get('title') || '') || `upload-${Date.now()}`;
  const is_public_raw = form.get('is_public');
  const isPublicStr = String(is_public_raw ?? 'false');
  const is_public = (isPublicStr === 'true' || isPublicStr === '1') ? 1 : 0;
    const artist_name = String(form.get('artist_name') || '');
    const description = String(form.get('description') || '');
    const category = String(form.get('category') || '');
    const type = String(form.get('type') || '');
    const mood = String(form.get('mood') || '');
    let credits: any = form.get('credits');
    let related_projects: any = form.get('related_projects');
    if (typeof credits === 'string') {
      try { credits = JSON.parse(credits); } catch {}
    }
    if (typeof related_projects === 'string') {
      try { related_projects = JSON.parse(related_projects); } catch {}
    }

    let stream: CloudflareStreamAPI;
    try { stream = new CloudflareStreamAPI(); } catch (e: any) {
      return NextResponse.json({ error: 'Failed to init Stream client', details: e?.message || String(e), code: 'STREAM_CLIENT_INIT' }, { status: 500 });
    }

    const { allowedOrigins } = computeAllowedOriginsFromReq(req);

    // Use direct upload (TUS) from the server to support large files avoiding 413.
    let uid = '';
    try {
      const create = await stream.createUploadUrl(3600, {
        name: title,
        requireSignedURLs: !(is_public === 1),
        allowedOrigins,
        meta: {
          title,
          creator: artist_name,
          artist_name,
          description,
          category,
          type,
          mood,
          credits: typeof credits === 'string' ? credits : JSON.stringify(credits || []),
          related_projects: typeof related_projects === 'string' ? related_projects : JSON.stringify(related_projects || []),
          tags: [category, type, mood].filter(Boolean).join(','),
          uploadedAt: new Date().toISOString(),
          proxy: true,
        },
      });
      const uploadURL = create.result.uploadURL;
      uid = create.result.uid;

      const blob = file as File;
      const ab = await blob.arrayBuffer();
      const body = Buffer.from(ab);
      const tusRes = await fetch(uploadURL, {
        method: 'PATCH',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': '0',
          'Content-Type': 'application/offset+octet-stream',
          'Content-Length': String(body.byteLength),
        },
        body,
      });
      if (!tusRes.ok) {
        const t = await tusRes.text().catch(() => '');
        return NextResponse.json({ error: 'TUS upload failed', details: `${tusRes.status} ${tusRes.statusText} ${t}`, code: 'STREAM_TUS_FAIL', allowedOrigins }, { status: 500 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: 'Stream direct-upload (server) failed', details: e?.message || String(e), code: 'STREAM_DIRECT_SERVER_FAIL', allowedOrigins }, { status: 500 });
    }

    try { await writeAuditLog(req, user, 'videos.stream_proxy_upload', uid, { title, is_public }); } catch {}
    return NextResponse.json({ success: true, uid, allowedOrigins });
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected proxy error', details: e?.message || String(e), code: 'STREAM_PROXY_ERROR' }, { status: 500 });
  }
}
