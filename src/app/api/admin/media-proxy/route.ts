import { NextRequest, NextResponse } from 'next/server';

/**
 * Media Proxy API - fetches media files server-side to bypass CORS
 * Used by ShareButton to download videos/images for native sharing
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate URL is from allowed domains
  const allowedDomains = [
    'videodelivery.net',
    'cloudflarestream.com',
    'r2.cloudflarestorage.com',
    'pub-', // R2 public bucket URLs
  ];

  const isAllowed = allowedDomains.some(domain => url.includes(domain));
  if (!isAllowed) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
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
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Media proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}
