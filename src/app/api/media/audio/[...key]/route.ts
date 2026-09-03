/**
 * GET /api/media/audio/[...key] — serve an R2 object by presigned redirect.
 *
 * The bucket's public host is media.odubo.studio, which stopped resolving
 * when the domain lapsed. Presigned URLs go straight to the R2 S3 endpoint
 * and work regardless, which is what lets a master play today rather than
 * after a domain purchase. Same trick the Wall already uses for photos
 * (src/app/api/loop/gallery/media/[...key]).
 *
 * Unauthenticated by design: this is the album preview's audio path, and the
 * preview is a link the owner sends to people. The exposure is bounded by
 * isServableKey(), which allows only the warehouse/ and music/ prefixes and
 * refuses traversal — this must never become a way to browse the bucket.
 * Keys under those prefixes carry timestamps and UUIDs, not guessable names.
 */
import { NextRequest, NextResponse } from 'next/server';

import { createStorageService } from '@/lib/storage/StorageService';
import { isServableKey } from '@/lib/release/audioSource';

export const runtime = 'nodejs';

/** Extensions served as bytes rather than a redirect. */
const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

function extensionOfKey(key: string): string {
  const name = key.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function isImageKey(key: string): boolean {
  return extensionOfKey(key) in IMAGE_TYPES;
}

function contentTypeFor(key: string): string {
  return IMAGE_TYPES[extensionOfKey(key)] ?? 'application/octet-stream';
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await ctx.params;
  const key = (segments ?? []).join('/');

  if (!isServableKey(key)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const url = await createStorageService().getPresignedUrl({
      key,
      operation: 'get',
      expiresIn: 3600,
    });

    // Images are PIPED; audio is REDIRECTED. The split is not arbitrary.
    //
    // A master is hundreds of megabytes, so the browser should range-request
    // R2 directly and a 302 is exactly right. But next/image fetches this URL
    // server-side and does NOT follow the redirect — it reads the empty
    // redirect body and hands sharp nothing, which surfaces as
    // "Input Buffer is empty" and a 500 from the optimizer. Not a broken
    // image: a broken page, whose only symptom is a missing cover.
    //
    // Cover art is a couple of megabytes and is fetched once and then cached
    // by the optimizer, so piping it through the Function costs nothing.
    if (!isImageKey(key)) {
      return NextResponse.redirect(url, {
        status: 302,
        headers: { 'Cache-Control': 'private, max-age=900' },
      });
    }

    const upstream = await fetch(url, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      console.error(`[media:image] upstream ${upstream.status} for ${key}`);
      return NextResponse.json({ error: 'Media unavailable' }, { status: 502 });
    }
    const headers = new Headers({
      'Content-Type': upstream.headers.get('content-type') ?? contentTypeFor(key),
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    const length = upstream.headers.get('content-length');
    if (length) headers.set('Content-Length', length);
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error('[media:audio] presign failed:', err);
    return NextResponse.json({ error: 'Media unavailable' }, { status: 502 });
  }
}

export async function HEAD(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> }
) {
  return GET(req, ctx);
}
