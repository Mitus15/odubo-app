import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { executeQuery, queryDatabase } from '@/lib/db';
import { generateClipThumbnail, generateAIThumbnailCandidates } from '@/lib/thumbnailService';

export const runtime = 'nodejs'; // Changed from 'edge' to support thumbnail generation with sharp/S3
export const dynamic = 'force-dynamic';

/** How far a signature's time may sit from ours before the request counts as a replay. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();

    // Verify the Webhook-Signature header.
    //
    // This route rewrites rows in videos: status, duration and poster. Left
    // unverified, anyone could POST a uid and un-archive that video or point
    // its poster at any image, so production fails closed: no secret, no
    // processing.
    //
    // Stream signs every notification with the secret Cloudflare returned
    // when the webhook was registered (PUT or GET .../stream/webhook):
    //   Webhook-Signature: time=<unix seconds>,sig1=<hex HMAC-SHA256 of `${time}.${raw body}`>
    // https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
    //
    // Trimmed because a pasted secret often carries a trailing newline.
    const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[Stream Webhook] No webhook secret configured, refusing unverified payload');
        return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 500 });
      }
      console.warn('[Stream Webhook] No secret set, skipping verification (development only)');
    } else {
      const header = req.headers.get('webhook-signature');
      if (!header) {
        console.error('[Stream Webhook] Missing Webhook-Signature header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }
      const problem = signatureProblem(header, raw, secret);
      if (problem) {
        console.error(`[Stream Webhook] ${problem}`);
        return NextResponse.json({ error: problem }, { status: 401 });
      }
    }

    const payload = JSON.parse(raw);
    return await handlePayload(payload);
  } catch (error) {
    console.error('Stream webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Why a Webhook-Signature header fails for this body, or null when Stream
 * signed exactly this body within the tolerance. The signature is checked
 * before the time, so "Stale signature" only ever describes a genuine one.
 */
function signatureProblem(header: string, body: string, secret: string): string | null {
  const fields = new Map<string, string>();
  for (const part of header.split(',')) {
    const [key, ...value] = part.split('=');
    fields.set(key.trim(), value.join('=').trim());
  }
  const time = fields.get('time') ?? '';
  const sig1 = fields.get('sig1') ?? '';
  if (!/^\d+$/.test(time) || !/^[0-9a-f]{64}$/i.test(sig1)) return 'Malformed signature';

  // Both sides are 32 bytes (sig1 is 64 hex characters), as timingSafeEqual requires.
  const expected = crypto.createHmac('sha256', secret).update(`${time}.${body}`, 'utf8').digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(sig1, 'hex'))) return 'Invalid signature';

  if (Math.abs(Date.now() / 1000 - Number(time)) > SIGNATURE_TOLERANCE_SECONDS) return 'Stale signature';
  return null;
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


