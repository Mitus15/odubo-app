import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Rate limit: 100 events per minute per session
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60000;

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

interface ViewEvent {
  clipId: number;
  watchDuration: number;
  completed: boolean;
  clipDuration?: number;
}

interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  referrer?: string;
}

/**
 * POST /api/clips/engagement
 * Receives batched view events from the client analytics module.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, events, attribution } = body as {
      sessionId?: string;
      events?: ViewEvent[];
      attribution?: Attribution | null;
    };

    if (!sessionId || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Rate limit check
    if (!checkRateLimit(sessionId)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Get request metadata
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'salt').digest('hex').slice(0, 16);
    const userAgent = req.headers.get('user-agent') || '';

    // Process each view event
    for (const event of events.slice(0, 50)) { // Cap at 50 events per request
      if (!event.clipId || typeof event.clipId !== 'number') continue;

      const watchDurationMs = Math.max(0, Math.min(event.watchDuration || 0, 3600000)); // Cap at 1 hour
      const watchDurationSeconds = Math.floor(watchDurationMs / 1000);
      const completed = event.completed ? 1 : 0;

      // Insert view event
      await executeQuery(
        `INSERT INTO clip_view_events (
          clip_id, session_id, watch_duration_ms, completed,
          source, referrer, utm_source, utm_medium, utm_campaign,
          user_agent, ip_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.clipId,
          sessionId,
          watchDurationMs,
          completed,
          attribution?.source || 'direct',
          attribution?.referrer || '',
          attribution?.source || '',
          attribution?.medium || '',
          attribution?.campaign || '',
          userAgent.slice(0, 500),
          ipHash,
        ]
      );

      // Update aggregate engagement counts
      await executeQuery(
        `INSERT INTO clip_engagement (clip_id, view_count, watch_time_seconds, completion_count, updated_at)
         VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(clip_id) DO UPDATE SET
           view_count = view_count + 1,
           watch_time_seconds = watch_time_seconds + excluded.watch_time_seconds,
           completion_count = completion_count + excluded.completion_count,
           updated_at = CURRENT_TIMESTAMP`,
        [event.clipId, watchDurationSeconds, completed]
      );
    }

    return NextResponse.json({ success: true, processed: events.length });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Engagement API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/clips/engagement?clipId=123
 * Get engagement stats for a specific clip (for admin dashboard).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clipId = searchParams.get('clipId');

    if (!clipId) {
      return NextResponse.json({ error: 'clipId required' }, { status: 400 });
    }

    const rows = await queryDatabase(
      `SELECT * FROM clip_engagement WHERE clip_id = ?`,
      [parseInt(clipId, 10)]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        clipId: parseInt(clipId, 10),
        viewCount: 0,
        watchTimeSeconds: 0,
        completionCount: 0,
        shareCount: 0,
        shopClickCount: 0,
      });
    }

    const row = rows[0] as {
      clip_id: number;
      view_count: number;
      watch_time_seconds: number;
      completion_count: number;
      share_count: number;
      shop_click_count: number;
      updated_at: string;
    };

    return NextResponse.json({
      clipId: row.clip_id,
      viewCount: row.view_count,
      watchTimeSeconds: row.watch_time_seconds,
      completionCount: row.completion_count,
      shareCount: row.share_count,
      shopClickCount: row.shop_click_count,
      updatedAt: row.updated_at,
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
