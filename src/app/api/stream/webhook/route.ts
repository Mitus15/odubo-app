import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('cf-webhook-signature') || '';
    const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;

    // If a secret is configured, verify HMAC of the raw body
    if (secret) {
      const raw = await req.text();
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(raw));
      const computed = Buffer.from(new Uint8Array(sig)).toString('hex');
      if (computed !== signature) {
        return new NextResponse('Invalid signature', { status: 401 });
      }
      const payload = JSON.parse(raw);
      return await handlePayload(payload);
    }

    const payload = await req.json();
    return await handlePayload(payload);
  } catch (error) {
    console.error('Stream webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePayload(payload: any): Promise<NextResponse> {
  const uid = payload?.data?.uid || payload?.result?.uid;
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  // Check current status to make idempotent - look for uid OR stream_video_id
  let existing: any[] = [];
  try {
    existing = await queryDatabase('SELECT status, id FROM videos WHERE uid = ? OR stream_video_id = ? LIMIT 1', [uid, uid]);
  } catch {
    // If column not present, nothing to update
    return NextResponse.json({ success: true, skipped: true });
  }
  if (!existing.length) return NextResponse.json({ success: true, skipped: true });
  const currentStatus = existing[0].status || 'pending';

  const statusState = payload?.data?.status?.state || payload?.result?.status?.state;
  const readyToStream = payload?.data?.readyToStream ?? payload?.result?.readyToStream;
  const duration = payload?.data?.duration ?? payload?.result?.duration;
  const thumbnailUrl = payload?.data?.thumbnail ?? payload?.result?.thumbnail;

  const status = readyToStream === true && statusState === 'ready' ? 'published' : (statusState || 'processing');
  if (currentStatus === 'published' && status === 'published' && !thumbnailUrl) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const fields: string[] = ['status = ?'];
  const params: any[] = [status];
  if (typeof duration === 'number') { 
    fields.push('duration = ?'); 
    params.push(String(Math.max(0, Math.floor(duration)))); 
  }
  if (thumbnailUrl) { 
    // Update both poster_url AND thumbnail fields for consistency
    fields.push('poster_url = ?');
    fields.push('thumbnail = ?'); 
    params.push(thumbnailUrl, thumbnailUrl); 
  }
  params.push(uid, uid);

  await executeQuery(`UPDATE videos SET ${fields.join(', ')} WHERE uid = ? OR stream_video_id = ?`, params);
  
  console.log('[Stream Webhook] Updated video:', {
    uid,
    status,
    duration: duration ? Math.floor(duration) : null,
    thumbnail: thumbnailUrl ? 'received' : 'none',
  });
  
  return NextResponse.json({ success: true });
}


