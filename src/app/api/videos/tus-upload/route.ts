import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * TUS creation proxy for Cloudflare Stream Direct Creator Uploads.
 * 
 * This endpoint acts as a TUS protocol proxy between the tus-js-client and Cloudflare Stream.
 * The frontend TUS client sends a creation POST here with Upload-Length and Upload-Metadata headers.
 * We proxy that request to Cloudflare's TUS endpoint and return the Location header.
 * 
 * This approach supports resumable uploads for large video files (>200MB) with proper chunking.
 * 
 * @see https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/#resumable-uploads-with-tus-for-large-files
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return NextResponse.json({ error: 'Missing Cloudflare credentials' }, { status: 500 });
    }

    // Proxy the TUS creation request to Cloudflare Stream
    // The ?direct_user=true parameter enables Direct Creator Upload mode
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': req.headers.get('Upload-Length') || '0',
          'Upload-Metadata': req.headers.get('Upload-Metadata') || '',
        },
      }
    );

    const location = cfResponse.headers.get('Location');
    const streamMediaId = cfResponse.headers.get('stream-media-id');

    if (!location) {
      const errorText = await cfResponse.text();
      console.error('Cloudflare TUS creation failed:', cfResponse.status, errorText);
      return new NextResponse(errorText || 'Failed to create TUS upload', { 
        status: cfResponse.status || 500 
      });
    }

    // Return the Location header to the TUS client
    // Also expose stream-media-id header for CORS
    return new NextResponse(null, {
      status: 201,
      headers: {
        'Location': location,
        'Tus-Resumable': '1.0.0',
        'Access-Control-Expose-Headers': 'Location, Tus-Resumable, stream-media-id',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Origin': '*',
        ...(streamMediaId ? { 'stream-media-id': streamMediaId } : {}),
      },
    });
  } catch (error: any) {
    console.error('Error creating TUS upload:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Handle TUS OPTIONS preflight requests.
 * Required for CORS when tus-js-client checks server capabilities.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Tus-Resumable': '1.0.0',
      'Tus-Version': '1.0.0',
      'Tus-Extension': 'creation,expiration',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, HEAD, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Upload-Length, Upload-Metadata, Tus-Resumable, Upload-Offset',
      'Access-Control-Expose-Headers': 'Location, Tus-Resumable, stream-media-id',
    },
  });
}
