import { NextRequest, NextResponse } from 'next/server';

// Dev-only proxy for R2 public URLs like https://media.odubo.studio/<key>
// Usage: /api/r2-proxy/<key>
export async function GET(req: NextRequest, { params }: { params: { key: string[] } }) {
  const isProd = process.env.NODE_ENV === 'production';
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if (!base) {
    return NextResponse.json({ error: 'CLOUDFLARE_R2_PUBLIC_URL not configured' }, { status: 500 });
  }
  const keyPath = (params.key || []).join('/');
  const target = `${base.replace(/\/$/, '')}/${keyPath}`;

  try {
    const res = await fetch(target, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status} for ${keyPath}` }, { status: res.status });
    }
    const headers = new Headers();
    // Pass through common content headers
    const contentType = res.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const contentLength = res.headers.get('content-length');
    if (contentLength) headers.set('content-length', contentLength);
    const cacheControl = res.headers.get('cache-control');
    if (cacheControl) headers.set('cache-control', cacheControl);

    const body = await res.arrayBuffer();
    return new NextResponse(body, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Proxy error' }, { status: 500 });
  }
}
