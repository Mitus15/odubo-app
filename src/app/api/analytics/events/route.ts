import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

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

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

// Valid event types that map to fan_activity.activity_type
const VALID_EVENT_TYPES = [
  'page_view',
  'site_visit',
  'scroll_depth',
  'time_on_page',
  'click',
  'search',
  'product_view',
  'shop_visit',
  'add_to_cart',
  'checkout_start',
  // Modal tracking
  'modal_open',
  'modal_close',
  // Gallery/Moments tracking
  'gallery_view',
  'photo_view',
  'rsvp_submit',
  // Video tracking
  'video_open',
  'video_progress',
  // Clip tracking
  'clip_view',
  'clip_complete',
  // Music tracking
  'album_view',
  'track_play',
] as const;

type EventType = typeof VALID_EVENT_TYPES[number];

interface AnalyticsEvent {
  type: EventType;
  path: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean | null>;
}

interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  entryClipId?: number;
  landingPage?: string;
}

// Map event types to fan_activity activity_type values
// Note: fan_activity has a CHECK constraint, so new event types map to existing allowed types
function mapEventToActivityType(eventType: EventType): string {
  const mapping: Record<EventType, string> = {
    page_view: 'page_view',
    site_visit: 'site_visit',
    scroll_depth: 'page_view', // Tracked as page_view with scroll metadata
    time_on_page: 'page_view', // Tracked as page_view with time metadata
    click: 'page_view', // Tracked as page_view with click metadata
    search: 'search',
    product_view: 'product_view',
    shop_visit: 'shop_visit',
    add_to_cart: 'add_to_cart',
    checkout_start: 'page_view', // Tracked as page_view for checkout page
    // Modal tracking - map to page_view with metadata distinguishing
    modal_open: 'shop_visit', // Modal opens tracked as visits
    modal_close: 'page_view', // Close events tracked with duration metadata
    // Gallery/Moments tracking
    gallery_view: 'page_view', // Gallery views
    photo_view: 'page_view', // Photo views with index metadata
    rsvp_submit: 'rsvp', // RSVP submissions
    // Video tracking - map to page_view with video metadata
    video_open: 'page_view',
    video_progress: 'page_view',
    // Clip tracking
    clip_view: 'clip_view',
    clip_complete: 'clip_complete',
    // Music tracking - map to music events
    album_view: 'page_view',
    track_play: 'music_play',
  };
  return mapping[eventType] || 'page_view';
}

// Map event types to content_type values
function mapEventToContentType(eventType: EventType, path: string): string {
  // Event-specific content types
  if (eventType === 'product_view' || path.startsWith('/store/product/')) return 'product';
  if (eventType === 'modal_open' || eventType === 'modal_close') {
    // Modal type is in path (e.g., /store, /media, /moments)
    if (path.includes('store')) return 'store';
    if (path.includes('media')) return 'media';
    if (path.includes('moments')) return 'gallery';
    return 'modal';
  }
  if (eventType === 'gallery_view' || eventType === 'photo_view' || eventType === 'rsvp_submit') return 'gallery';
  if (eventType === 'video_open' || eventType === 'video_progress') return 'video';
  if (eventType === 'clip_view' || eventType === 'clip_complete') return 'clip';
  if (eventType === 'album_view' || eventType === 'track_play') return 'music';
  // Path-based fallbacks
  if (path.startsWith('/store')) return 'store';
  if (path.startsWith('/music')) return 'music';
  if (path.startsWith('/media')) return 'media';
  if (path.startsWith('/moments')) return 'gallery';
  if (path.startsWith('/clips')) return 'clip';
  return 'page';
}

/**
 * POST /api/analytics/events
 * Receives batched analytics events from the client.
 * Writes to fan_activity table.
 */
export async function POST(req: NextRequest) {
  try {
    // Handle sendBeacon which sends as text
    const contentType = req.headers.get('content-type') || '';
    let body;

    if (contentType.includes('text/plain')) {
      const text = await req.text();
      body = JSON.parse(text);
    } else {
      body = await req.json();
    }

    const { sessionId, visitorId, events, attribution } = body as {
      sessionId?: string;
      visitorId?: string;
      events?: AnalyticsEvent[];
      attribution?: Attribution | null;
    };

    if (!sessionId || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Rate limit check
    if (!checkRateLimit(sessionId)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Get or create anonymous fan profile based on visitorId
    let fanId: string | null = null;
    if (visitorId) {
      fanId = await getOrCreateAnonymousFanProfile(visitorId, attribution);
    }

    // Process each event (cap at 50 per request)
    const eventsToProcess = events.slice(0, 50);

    for (const event of eventsToProcess) {
      if (!event.type || !VALID_EVENT_TYPES.includes(event.type)) continue;

      const activityType = mapEventToActivityType(event.type);
      const contentType = mapEventToContentType(event.type, event.path);

      // Extract relevant metadata
      // Handle different duration formats: seconds (time_on_page) or durationMs (modal_close)
      let durationSeconds = event.metadata?.seconds as number | undefined;
      if (!durationSeconds && event.metadata?.durationMs) {
        durationSeconds = Math.round((event.metadata.durationMs as number) / 1000);
      }
      if (!durationSeconds && event.metadata?.watchSeconds) {
        durationSeconds = event.metadata.watchSeconds as number;
      }
      if (!durationSeconds && event.metadata?.playSeconds) {
        durationSeconds = event.metadata.playSeconds as number;
      }

      // Completion percent: scroll depth, video progress, etc.
      let completionPercent = event.metadata?.depth as number | undefined;
      if (!completionPercent && event.metadata?.watchPercentage) {
        completionPercent = event.metadata.watchPercentage as number;
      }

      // Serialize metadata to JSON
      const metadataJson = event.metadata ? JSON.stringify(event.metadata) : null;

      // Insert into fan_activity
      await executeQuery(
        `INSERT INTO fan_activity (
          fan_id, activity_type, content_id, content_type, content_title,
          platform, device_type, source, medium, campaign, referrer,
          session_id, duration_seconds, completion_percent, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          fanId || 'anonymous',
          activityType,
          event.path, // Use path as content_id for page views
          contentType,
          event.metadata?.clipTitle || event.metadata?.title || null,
          'odubo',
          null, // Device type could be extracted from user agent
          attribution?.source || null,
          attribution?.medium || null,
          attribution?.campaign || null,
          attribution?.referrer || null,
          sessionId,
          durationSeconds || null,
          completionPercent || null,
          metadataJson,
        ]
      );
    }

    return NextResponse.json({ success: true, processed: eventsToProcess.length });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Analytics events API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * Get or create an anonymous fan profile based on visitorId.
 * Returns the fan_id for activity tracking.
 */
async function getOrCreateAnonymousFanProfile(
  visitorId: string,
  attribution?: Attribution | null
): Promise<string> {
  try {
    // Try to find existing profile by fingerprint (using visitorId as fingerprint proxy)
    const existing = await executeQuery(
      `SELECT id FROM fan_profiles WHERE fingerprint_hash = ? LIMIT 1`,
      [visitorId]
    );

    interface ProfileRow { id: string }
    const result = existing as { result?: { results?: ProfileRow[] }[] };
    if (result.result?.[0]?.results?.[0]) {
      return result.result[0].results[0].id;
    }

    // Create new anonymous fan profile
    const newId = generateId();
    await executeQuery(
      `INSERT INTO fan_profiles (
        id, fingerprint_hash, acquisition_source, acquisition_campaign,
        stage, first_seen_at, last_active_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'new', datetime('now'), datetime('now'), datetime('now'), datetime('now'))`,
      [
        newId,
        visitorId,
        attribution?.source || null,
        attribution?.campaign || null,
      ]
    );

    return newId;
  } catch (err) {
    // On error, return a temporary ID (won't link to profile but won't fail)
    console.error('Error creating anonymous fan profile:', err);
    return `temp-${visitorId.slice(0, 8)}`;
  }
}

/**
 * Generate a random ID for fan profiles.
 */
function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
