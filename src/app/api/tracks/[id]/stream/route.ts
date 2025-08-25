import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const runtime = 'edge';

// Enhanced audio streaming proxy with robust error handling and caching
// Supports byte-range requests for smooth audio streaming

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleProxy(req, id, false);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleProxy(req, id, true);
}

async function handleProxy(req: NextRequest, id: string, headOnly = false) {
  try {
    // Lookup track with additional metadata (guard against non-JSON DB errors)
    let rows: any[] = [];
    try {
      rows = await queryDatabase(
        'SELECT id, audio_url, audio_id, audio_status, title, duration FROM tracks WHERE id = ? LIMIT 1', 
        [id]
      ) as any[];
    } catch (dbErr) {
      console.error('DB lookup failed in stream route:', dbErr);
      return NextResponse.json({ error: 'Database unavailable' }, { status: 502 });
    }
    
    if (!rows || (rows as any[]).length === 0) {
      console.error(`Track not found: ${id}`);
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    
    const track = (rows as any[])[0];
    const { audio_url: audioUrl, audio_status: audioStatus, title } = track;
    
    if (!audioUrl) {
      console.error(`No audio URL for track: ${id} (${title})`);
      return NextResponse.json({ error: 'Audio file not available' }, { status: 404 });
    }
    
    // Allow streaming as long as an audio URL exists, even if status is not "ready".
    // Some ingestion pipelines mark items as pending while the file is already accessible.
    if (audioStatus && audioStatus !== 'ready') {
      console.warn(`Proceeding to stream track with non-ready status. Track: ${id} (${title}) status: ${audioStatus}`);
    }

    // Prepare headers for upstream request
    const upstreamHeaders: Record<string, string> = {};
    
    // Pass through Range header for byte-range requests
    const range = req.headers.get('range');
    if (range) {
      upstreamHeaders['Range'] = range;
      console.log(`Range request for track ${id}: ${range}`);
    }
    
    // Set proper headers for audio requests
    upstreamHeaders['Accept'] = 'audio/*,*/*;q=0.9';
    upstreamHeaders['User-Agent'] = 'Odubo-Music-Streamer/2.0';
    upstreamHeaders['Accept-Encoding'] = 'identity'; // Prevent compression for audio streaming
    
    console.log(`Proxying audio request to: ${audioUrl}`);

    // Make request to upstream server (R2/CDN)
    const upstream = await fetch(audioUrl, {
      method: headOnly ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      // Disable Next.js fetch caching to avoid stale/opaque failures
      cache: 'no-store' as any,
    });

    if (!upstream.ok) {
      console.error(`Upstream request failed: ${upstream.status} ${upstream.statusText} for ${audioUrl}`);
      return new NextResponse(null, { status: upstream.status, headers: new Headers({ 'x-upstream-error': String(upstream.status) }) });
    }

    // Build response headers
    const responseHeaders = new Headers();
    
    // Essential headers for audio streaming
    const essentialHeaders = [
      'content-type',
      'content-length', 
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified'
    ];
    
    essentialHeaders.forEach(headerName => {
      const value = upstream.headers.get(headerName);
      if (value) {
        responseHeaders.set(headerName, value);
      }
    });

    // CORS headers for browser compatibility  
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    
    // Caching strategy
    const cacheValue = upstream.headers.get('cache-control') || 'public, max-age=86400, stale-while-revalidate=604800';
    responseHeaders.set('Cache-Control', cacheValue);
    
    // Content disposition for proper handling. Ensure ASCII-only filename to avoid header errors.
    const baseTitle = typeof title === 'string' ? title : 'track';
    const asciiFilename = baseTitle
      .replace(/[^\x20-\x7E]/g, '_') // strip non-ASCII
      .replace(/["\\;]/g, '_') // sanitize special header chars
      .trim() || 'track';
    const rfc5987 = encodeURIComponent(baseTitle);
    responseHeaders.set('Content-Disposition', `inline; filename="${asciiFilename}.audio"; filename*=UTF-8''${rfc5987}.audio`);
    
    // Ensure proper content type for audio
    const existingContentType = responseHeaders.get('content-type') || '';
    if (!existingContentType.toLowerCase().startsWith('audio/')) {
      // Fallback content type detection from URL extension
      const contentType = detectAudioContentType(audioUrl);
      if (contentType) {
        responseHeaders.set('content-type', contentType);
      } else if (existingContentType) {
        // Some storages return application/octet-stream; override to a safe default to help browsers demux
        if (existingContentType.toLowerCase() === 'application/octet-stream') {
          // Default to MPEG; most browsers support it. If the file is m4a, the URL-based detection above will set audio/mp4.
          responseHeaders.set('content-type', 'audio/mpeg');
        }
      }
    }

    const status = upstream.status;
    console.log(`Streaming response: ${status} for track ${id} (${range ? 'range' : 'full'})`);

    if (headOnly) {
      return new NextResponse(null, { status, headers: responseHeaders });
    }

    // Stream the audio data back to client
    return new NextResponse(upstream.body, {
      status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Audio streaming error:', error);
    return NextResponse.json(
      { error: 'Internal streaming error' }, 
      { status: 500 }
    );
  }
}

// Helper function to detect audio content type from URL
function detectAudioContentType(url: string): string | null {
  const extension = url.toLowerCase().split('.').pop();
  const mimeTypes: { [key: string]: string } = {
    'mp3': 'audio/mpeg',
    'mpga': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'mp4': 'audio/mp4',
    'aac': 'audio/aac', 
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'ogg': 'audio/ogg',
    'oga': 'audio/ogg',
    'webm': 'audio/webm'
  };
  return mimeTypes[extension || ''] || null;
}

// Options handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
    },
  });
}