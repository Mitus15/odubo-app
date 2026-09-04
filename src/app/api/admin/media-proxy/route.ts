import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';

/**
 * Media Proxy — fetches media server-side to bypass CORS for native sharing.
 *
 * Despite living under /api/admin/ this route had NO authentication of any
 * kind, and its allowlist was a substring test. Both are fixed here, and both
 * mattered independently:
 *
 *   AUTH — it would fetch and return the body of any URL that satisfied the
 *   allowlist. A presigned R2 URL contains "r2.cloudflarestorage.com", so this
 *   was a second, same-origin, unauthenticated way to pull gated album audio,
 *   entirely bypassing the media route's own checks.
 *
 *   ALLOWLIST — `url.includes(domain)` matches anywhere in the string, so
 *   `https://evil.example/?x=r2.cloudflarestorage.com` passed. The host is now
 *   parsed and matched as a hostname suffix, which cannot be spoofed by a path
 *   or query string.
 *
 * Presigned URLs are refused outright. A signed URL is a bearer capability, and
 * laundering one through a proxy strips the audit trail while keeping the
 * access — there is no legitimate reason to hand one to this route.
 */
export const runtime = 'nodejs';

/** Hostnames (or suffixes) this proxy will fetch from. */
const ALLOWED_HOSTS = [
  'videodelivery.net',
  'cloudflarestream.com',
  'media.odubo.studio',
];

/** Host prefixes for Cloudflare's per-account subdomains. */
const ALLOWED_HOST_PREFIXES = ['customer-', 'pub-'];

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
  return ALLOWED_HOST_PREFIXES.some((p) => host.startsWith(p));
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;

  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Not a URL' }, { status: 400 });
  }

  if (target.protocol !== 'https:') {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  // A presigned URL already carries its own authorisation. Proxying one turns
  // this route into a way to use someone else's capability.
  if (target.searchParams.has('X-Amz-Signature') || target.searchParams.has('Signature')) {
    return NextResponse.json({ error: 'Presigned URLs are not proxied' }, { status: 403 });
  }

  if (!isAllowedHost(target.hostname)) {
    console.error('Media proxy: host not allowed:', target.hostname);
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const response = await fetch(target.toString(), { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Media proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}
