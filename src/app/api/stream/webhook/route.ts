import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { generateClipThumbnail, generateAIThumbnailCandidates } from '@/lib/thumbnailService';

export const runtime = 'nodejs'; // Changed from 'edge' to support thumbnail generation with sharp/S3
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const signature = req.headers.get('cf-webhook-signature') || '';
    const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;

    // Optional signature verification if secret is configured
    // NOTE: Cloudflare Stream webhooks don't have built-in signature verification
    // You can add IP allowlisting in Cloudflare dashboard settings for security
    if (secret && signature) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(raw));
      
      // Convert to hex without using Buffer (edge runtime compatible)
      const computed = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      if (computed !== signature) {
        console.warn('[Stream Webhook] Invalid signature');
        return new NextResponse('Invalid signature', { status: 401 });
      }
      console.log('[Stream Webhook] Signature verified ✓');
    } else if (!secret && process.env.NODE_ENV === 'production') {
      console.warn('[Stream Webhook] No webhook secret configured - consider adding IP restrictions in Cloudflare');
    }
    
    const payload = JSON.parse(raw);
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

  // Map to valid DB values: 'draft' (processing), 'published' (ready), 'archived' (deleted)
  const status = readyToStream === true && statusState === 'ready' ? 'published' : 'draft';
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
  
  // Trigger automatic thumbnail generation when video becomes ready
  // NOTE: This runs async so webhook can return quickly. The thumbnailService
  // tracks status in database (pending → generating → completed/failed/fallback)
  // so the UI can know when thumbnail is ready.
  if (readyToStream === true && statusState === 'ready' && duration && duration > 0) {
    // Fetch video details to determine type BEFORE async block
    // (so we can log properly even if async starts)
    const videoRows = await queryDatabase(
      'SELECT id, parent_video_id, type, title, category, mood FROM videos WHERE uid = ? LIMIT 1',
      [uid]
    );

    if (videoRows && videoRows.length > 0) {
      const video = videoRows[0];
      const videoId = video.id as number;
      const isClip = video.parent_video_id !== null;

      console.log(`[Stream Webhook] Starting thumbnail generation for video ${videoId} (isClip: ${isClip})`);

      // Run thumbnail generation asynchronously (don't block webhook response)
      // thumbnailService handles status tracking, retries, and fallbacks
      (async () => {
        try {
          if (isClip) {
            // Clip: random frame extraction → R2 with black frame detection
            const result = await generateClipThumbnail(uid, Math.floor(duration), videoId);
            if (result.success) {
              console.log(`[Stream Webhook] Clip thumbnail generated: ${result.posterUrl}`);
            } else {
              console.error(`[Stream Webhook] Clip thumbnail generation failed:`, result.error);
            }
          } else {
            // Parent video: AI-powered thumbnail selection
            const result = await generateAIThumbnailCandidates(uid, videoId, {
              title: video.title as string,
              category: video.category as string,
              mood: video.mood as string
            });
            if (result.success) {
              console.log(`[Stream Webhook] AI thumbnail generated: ${result.posterUrl}`);
            } else {
              console.error(`[Stream Webhook] AI thumbnail generation failed:`, result.error);
            }
          }
        } catch (error) {
          console.error('[Stream Webhook] Thumbnail generation error:', error);
          // Non-fatal: thumbnailService handles status updates on failure
        }
      })();
    }
  }
  
  console.log('[Stream Webhook] Updated video:', {
    uid,
    status,
    duration: duration ? Math.floor(duration) : null,
    thumbnail: thumbnailUrl ? 'received' : 'none',
  });
  
  return NextResponse.json({ success: true });
}


