import { getAttribution, getSessionId, type Attribution } from '@/lib/attribution';

/**
 * The shop tap on a clip, recorded as a `shop_click` funnel event.
 *
 * POST /api/analytics/funnel stores the event against the clip (funnel_events)
 * and counts it on clip_engagement.shop_click_count, which the feed's "popular"
 * sort already weighs. Nothing else in the app sent it until now.
 */

export const FUNNEL_ENDPOINT = '/api/analytics/funnel';

/** The body /api/analytics/funnel accepts, for one shop tap. */
export interface ShopClickPayload {
  sessionId: string;
  events: Array<{
    event: 'shop_click';
    clipId: number;
    productHandle: string;
    timestamp: number;
  }>;
  attribution: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    referrer: string;
  } | null;
}

/** Build the event body. Pure, so the shape the route reads is pinned by a test. */
export function shopClickPayload(
  clipId: number,
  productHandle: string,
  sessionId: string,
  attribution: Attribution | null,
  timestamp: number,
): ShopClickPayload {
  return {
    sessionId,
    events: [{ event: 'shop_click', clipId, productHandle, timestamp }],
    attribution: attribution
      ? {
          source: attribution.source,
          medium: attribution.medium,
          campaign: attribution.campaign,
          content: attribution.content,
          referrer: attribution.referrer,
        }
      : null,
  };
}

/**
 * Send the event and forget it. Nothing awaits the request and every failure
 * is swallowed, so the tap that opened the shop never waits on the network or
 * breaks because analytics did. `keepalive` lets it land even if the tap leads
 * straight on to checkout.
 */
export function postShopClick(clipId: number, productHandle: string): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    const body = JSON.stringify(
      shopClickPayload(clipId, productHandle, getSessionId(), getAttribution(), Date.now()),
    );
    void fetch(FUNNEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics never breaks a tap.
  }
}
