import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { changedRows, executeQuery, queryDatabase } from '@/lib/db';
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
    // This route completes rows in videos and starts poster runs that call
    // Gemini. Left unverified, anyone could write a waiting video's duration
    // or spend the Gemini key, so production fails closed: no secret, no
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

/** The fields this route reads from a Stream video object. */
type StreamVideo = {
  uid?: string;
  readyToStream?: boolean;
  duration?: number;
  /** When Stream last changed the video: for a notification, when processing finished. */
  modified?: string;
  // Cloudflare's docs spell the reason code both ways.
  status?: { state?: string; errorReasonCode?: string; errReasonCode?: string };
};

/** The row a notification may complete. */
type VideoRow = {
  id: number;
  parent_video_id: number | null;
  title: string | null;
  category: string | null;
  mood: string | null;
  duration: string | number | null;
  duration_seconds: number | null;
  poster_url: string | null;
  thumbnail_status: string | null;
  created_at: string | null;
};

/**
 * A notification completes the row that was waiting on Stream. It never
 * overrules it.
 *
 * - Status and visibility stay the owner's. Every upload route writes its
 *   own (Arsenal hides with is_public), so writing "ready" here could only
 *   ever turn an archived video back into a published one.
 * - A row written after Stream finished was written by something that
 *   waited for it (the Loop film pipeline, imports) and is left alone, as is
 *   a row that already knows its duration (completed by an earlier
 *   notification).
 * - The automatic poster replaces only Stream's default frame, on a video no
 *   poster has been generated for, and is claimed so it never runs twice: a
 *   clip gets a random frame (R2), a parent video the Gemini pick. It runs
 *   after the response.
 *
 * Cloudflare sends the video object itself, uid and all at the top level;
 * the Stream API returns the same object under `result`. Both are read, and
 * `data`, the only shape this route read before 2026-10-02.
 */
async function handlePayload(payload: StreamVideo & { data?: StreamVideo; result?: StreamVideo }): Promise<NextResponse> {
  const video: StreamVideo = (payload?.uid ? payload : payload?.result ?? payload?.data) ?? {};
  const uid = video.uid;
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  const state = video.status?.state;
  if (state === 'error') {
    const reason = video.status?.errorReasonCode || video.status?.errReasonCode || 'no reason given';
    console.error(`[Stream Webhook] Stream could not process ${uid}: ${reason}`);
    return NextResponse.json({ success: true, skipped: 'processing failed' });
  }
  const duration = Number(video.duration);
  if (video.readyToStream !== true || state !== 'ready' || !(duration > 0)) {
    return NextResponse.json({ success: true, skipped: 'not ready' });
  }

  const [row] = (await queryDatabase(
    `SELECT id, parent_video_id, title, category, mood, duration, duration_seconds, poster_url, thumbnail_status, created_at
     FROM videos WHERE uid = ? OR stream_video_id = ? LIMIT 1`,
    [uid, uid]
  )) as VideoRow[];
  if (!row) return NextResponse.json({ success: true, skipped: 'no row' });
  if (epochMs(row.created_at) > epochMs(video.modified)) {
    return NextResponse.json({ success: true, skipped: 'written after processing' });
  }
  if (knowsDuration(row)) return NextResponse.json({ success: true, skipped: 'already complete' });

  await executeQuery(
    `UPDATE videos SET duration = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?`,
    [String(Math.floor(duration)), duration, row.id]
  );

  const poster = (await claimPoster(row, uid)) ? 'generating' : 'kept';
  if (poster === 'generating') after(() => makePoster(uid, row, duration));
  console.log(`[Stream Webhook] Video ${row.id} (${uid}) ready: ${Math.floor(duration)}s, poster ${poster}`);
  return NextResponse.json({ success: true, poster });
}

/** A D1 or ISO timestamp in epoch ms (NaN when absent). D1's datetime('now') is UTC written without a zone. */
function epochMs(value: string | null | undefined): number {
  if (!value) return NaN;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`);
}

/** Seconds above zero, or any duration text but "" and "0" (some rows hold "3:45"). */
function knowsDuration(row: VideoRow): boolean {
  const text = String(row.duration ?? '').trim();
  return Number(row.duration_seconds) > 0 || (text !== '' && Number(text) !== 0);
}

/** No poster yet, or the frame Stream serves by default, which every upload route writes first. */
function isStreamDefaultPoster(url: string | null, uid: string): boolean {
  if (!url) return true;
  const path = `/${uid}/thumbnails/thumbnail.jpg`;
  return url === `https://videodelivery.net${path}` || (url.startsWith('https://customer-') && url.endsWith(`.cloudflarestream.com${path}`));
}

/** True when this request claimed the automatic poster: Stream's default frame, never generated, and no one got there first. */
async function claimPoster(row: VideoRow, uid: string): Promise<boolean> {
  if ((row.thumbnail_status ?? 'pending') !== 'pending' || !isStreamDefaultPoster(row.poster_url, uid)) return false;
  const claim = await executeQuery(
    `UPDATE videos SET thumbnail_status = 'generating', updated_at = datetime('now')
     WHERE id = ? AND COALESCE(thumbnail_status, 'pending') = 'pending'`,
    [row.id]
  );
  return changedRows(claim) === 1;
}

/** Clip: a random frame to R2. Parent video: frames ranked by Gemini. thumbnailService records the outcome on the row. */
async function makePoster(uid: string, row: VideoRow, duration: number): Promise<void> {
  try {
    const result =
      row.parent_video_id != null
        ? await generateClipThumbnail(uid, Math.floor(duration), row.id)
        : await generateAIThumbnailCandidates(uid, row.id, {
            title: row.title ?? undefined,
            category: row.category ?? undefined,
            mood: row.mood ?? undefined,
          });
    if (result.success) console.log(`[Stream Webhook] Poster for video ${row.id}: ${result.posterUrl}`);
    else console.error(`[Stream Webhook] Poster for video ${row.id} failed:`, result.error);
  } catch (error) {
    console.error(`[Stream Webhook] Poster for video ${row.id} failed:`, error);
  }
}
