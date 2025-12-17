import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Rate limit: 50 events per minute per session
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 50;
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

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

type FunnelEventType =
  | 'clip_view'
  | 'clip_complete'
  | 'clip_share'
  | 'shop_click'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'purchase';

interface FunnelEvent {
  event: FunnelEventType;
  clipId?: number;
  productHandle?: string;
  orderId?: string;
  value?: number;
  items?: Array<{ handle: string; quantity: number; price: number }>;
  metadata?: Record<string, string | number | boolean>;
  timestamp?: number;
}

interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  referrer?: string;
}

/**
 * POST /api/analytics/funnel
 * Receives batched funnel events from the client analytics module.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, events, attribution } = body as {
      sessionId?: string;
      events?: FunnelEvent[];
      attribution?: Attribution | null;
    };

    if (!sessionId || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Rate limit check
    if (!checkRateLimit(sessionId)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Process each funnel event
    for (const event of events.slice(0, 20)) { // Cap at 20 events per request
      if (!event.event) continue;

      // Validate event type
      const validEvents: FunnelEventType[] = [
        'clip_view', 'clip_complete', 'clip_share', 'shop_click',
        'product_view', 'add_to_cart', 'checkout_start', 'purchase'
      ];
      if (!validEvents.includes(event.event)) continue;

      // Convert value to cents if provided
      const valueCents = event.value ? Math.round(event.value * 100) : null;

      // Serialize metadata/items to JSON
      const dataJson = event.metadata || event.items
        ? JSON.stringify({ metadata: event.metadata, items: event.items })
        : null;

      // Insert funnel event
      await executeQuery(
        `INSERT INTO funnel_events (
          event_type, session_id, clip_id, product_handle, order_id,
          value_cents, utm_source, utm_medium, utm_campaign, utm_content,
          referrer, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.event,
          sessionId,
          event.clipId || null,
          event.productHandle || null,
          event.orderId || null,
          valueCents,
          attribution?.source || '',
          attribution?.medium || '',
          attribution?.campaign || '',
          attribution?.content || '',
          attribution?.referrer || '',
          dataJson,
        ]
      );

      // Update clip engagement counters for relevant events
      if (event.clipId) {
        if (event.event === 'clip_share') {
          await executeQuery(
            `UPDATE clip_engagement SET share_count = share_count + 1, updated_at = CURRENT_TIMESTAMP WHERE clip_id = ?`,
            [event.clipId]
          );
        } else if (event.event === 'shop_click') {
          await executeQuery(
            `UPDATE clip_engagement SET shop_click_count = shop_click_count + 1, updated_at = CURRENT_TIMESTAMP WHERE clip_id = ?`,
            [event.clipId]
          );
        }
      }
    }

    return NextResponse.json({ success: true, processed: events.length });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Funnel API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/analytics/funnel
 * Get funnel analytics for admin dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 90);
    const eventType = searchParams.get('event');
    const source = searchParams.get('source');

    let whereClause = `WHERE created_at >= datetime('now', '-${days} days')`;
    const params: (string | number)[] = [];

    if (eventType) {
      whereClause += ` AND event_type = ?`;
      params.push(eventType);
    }

    if (source) {
      whereClause += ` AND utm_source = ?`;
      params.push(source);
    }

    // Get event counts by type
    const eventCounts = await queryDatabase(
      `SELECT event_type, COUNT(*) as count, COUNT(DISTINCT session_id) as unique_sessions
       FROM funnel_events ${whereClause}
       GROUP BY event_type
       ORDER BY count DESC`,
      params
    );

    // Get conversion funnel
    const funnelStages = await queryDatabase(
      `SELECT
         SUM(CASE WHEN event_type = 'clip_view' THEN 1 ELSE 0 END) as clip_views,
         SUM(CASE WHEN event_type = 'shop_click' THEN 1 ELSE 0 END) as shop_clicks,
         SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) as product_views,
         SUM(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) as add_to_carts,
         SUM(CASE WHEN event_type = 'checkout_start' THEN 1 ELSE 0 END) as checkouts,
         SUM(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) as purchases,
         SUM(CASE WHEN event_type = 'purchase' THEN value_cents ELSE 0 END) as revenue_cents
       FROM funnel_events ${whereClause}`,
      params
    );

    // Get top sources
    const topSources = await queryDatabase(
      `SELECT utm_source as source, COUNT(*) as count, COUNT(DISTINCT session_id) as sessions
       FROM funnel_events ${whereClause} AND utm_source != ''
       GROUP BY utm_source
       ORDER BY count DESC
       LIMIT 10`,
      params
    );

    // Get daily trend
    const dailyTrend = await queryDatabase(
      `SELECT
         date(created_at) as date,
         COUNT(*) as events,
         COUNT(DISTINCT session_id) as sessions
       FROM funnel_events ${whereClause}
       GROUP BY date(created_at)
       ORDER BY date DESC
       LIMIT ?`,
      [...params, days]
    );

    return NextResponse.json({
      period: { days },
      eventCounts,
      funnel: funnelStages?.[0] || {},
      topSources,
      dailyTrend,
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
