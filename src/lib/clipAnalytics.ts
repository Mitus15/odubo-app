/**
 * Clip engagement and funnel analytics.
 *
 * Tracks:
 * - Clip views (when a clip becomes active)
 * - Watch duration and completion
 * - User interactions (share, shop clicks)
 * - Funnel events (product views, add to cart, checkout)
 *
 * Events are buffered and sent in batches to reduce network overhead.
 */

import { getAttribution, getSessionId } from './attribution';

export type FunnelEvent =
  | 'clip_view'
  | 'clip_complete'
  | 'clip_share'
  | 'shop_click'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'purchase';

export interface ViewEvent {
  clipId: number;
  startTime: number;
  watchDuration: number;
  completed: boolean;
  clipDuration?: number;
}

interface BufferedEvent {
  type: 'view' | 'funnel';
  data: ViewEvent | FunnelEventData;
  timestamp: number;
}

interface FunnelEventData {
  event: FunnelEvent;
  clipId?: number;
  productHandle?: string;
  orderId?: string;
  value?: number;
  items?: Array<{ handle: string; quantity: number; price: number }>;
  metadata?: Record<string, string | number | boolean>;
}

class ClipAnalytics {
  private sessionId: string;
  private eventBuffer: BufferedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;
  private activeView: ViewEvent | null = null;

  constructor() {
    this.sessionId = '';

    // Only initialize on client
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.isInitialized) return;

    this.sessionId = getSessionId();
    this.isInitialized = true;

    // Flush on page unload
    this.setupUnloadHandler();
  }

  private setupUnloadHandler() {
    // Use multiple event listeners for better coverage
    const flush = () => this.flush(true);

    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);

    // Also flush when tab becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.endCurrentView();
        this.flush(true);
      }
    });
  }

  /**
   * Start tracking a clip view.
   * Call when a clip becomes active.
   */
  startView(clipId: number, clipDuration?: number): void {
    if (!this.isInitialized) return;

    // End any existing view first
    this.endCurrentView();

    this.activeView = {
      clipId,
      startTime: Date.now(),
      watchDuration: 0,
      completed: false,
      clipDuration,
    };

    // Also track as a funnel event
    this.trackFunnel('clip_view', {
      clipId,
      metadata: { position: 0 }, // Could pass position if available
    });
  }

  /**
   * End the current view and calculate watch duration.
   * Call when the clip changes or page unloads.
   */
  endCurrentView(): void {
    if (!this.activeView) return;

    const view = this.activeView;
    view.watchDuration = Date.now() - view.startTime;

    // Mark as completed if watched 80% or more
    if (view.clipDuration && view.clipDuration > 0) {
      const watchedPercent = view.watchDuration / (view.clipDuration * 1000);
      view.completed = watchedPercent >= 0.8;
    }

    // Buffer the view event
    this.eventBuffer.push({
      type: 'view',
      data: { ...view },
      timestamp: Date.now(),
    });

    // Track completion as funnel event if applicable
    if (view.completed) {
      this.trackFunnel('clip_complete', {
        clipId: view.clipId,
        metadata: {
          watchDuration: view.watchDuration,
          clipDuration: view.clipDuration || 0,
        },
      });
    }

    this.activeView = null;
    this.scheduleFlush();
  }

  /**
   * Track a funnel event.
   */
  trackFunnel(event: FunnelEvent, options: Omit<FunnelEventData, 'event'> = {}): void {
    if (!this.isInitialized) return;

    const eventData: FunnelEventData = {
      event,
      ...options,
    };

    this.eventBuffer.push({
      type: 'funnel',
      data: eventData,
      timestamp: Date.now(),
    });

    this.scheduleFlush();
  }

  /**
   * Convenience method for tracking shop button clicks.
   */
  trackShopClick(clipId: number, productHandle?: string): void {
    this.trackFunnel('shop_click', {
      clipId,
      productHandle,
    });
  }

  /**
   * Convenience method for tracking share actions.
   */
  trackShare(clipId: number, method?: string): void {
    this.trackFunnel('clip_share', {
      clipId,
      metadata: method ? { method } : undefined,
    });
  }

  /**
   * Convenience method for tracking product views.
   */
  trackProductView(productHandle: string, fromClipId?: number): void {
    this.trackFunnel('product_view', {
      productHandle,
      clipId: fromClipId,
    });
  }

  /**
   * Convenience method for tracking add to cart.
   */
  trackAddToCart(productHandle: string, price: number, fromClipId?: number): void {
    this.trackFunnel('add_to_cart', {
      productHandle,
      clipId: fromClipId,
      value: price,
    });
  }

  /**
   * Convenience method for tracking checkout start.
   */
  trackCheckoutStart(value: number, items: FunnelEventData['items']): void {
    this.trackFunnel('checkout_start', {
      value,
      items,
    });
  }

  /**
   * Convenience method for tracking purchase completion.
   */
  trackPurchase(orderId: string, value: number, items: FunnelEventData['items']): void {
    this.trackFunnel('purchase', {
      orderId,
      value,
      items,
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    // Flush after 5 seconds of inactivity
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, 5000);
  }

  private async flush(immediate = false): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventBuffer.length === 0) return;

    // Take current buffer and clear it
    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    const attribution = getAttribution();

    // Separate view and funnel events
    const viewEvents = events
      .filter(e => e.type === 'view')
      .map(e => e.data as ViewEvent);

    const funnelEvents = events
      .filter(e => e.type === 'funnel')
      .map(e => ({
        ...(e.data as FunnelEventData),
        timestamp: e.timestamp,
      }));

    // Send view events
    if (viewEvents.length > 0) {
      this.sendViewEvents(viewEvents, attribution, immediate);
    }

    // Send funnel events
    if (funnelEvents.length > 0) {
      this.sendFunnelEvents(funnelEvents, attribution, immediate);
    }
  }

  private async sendViewEvents(
    events: ViewEvent[],
    attribution: ReturnType<typeof getAttribution>,
    immediate: boolean
  ): Promise<void> {
    try {
      await fetch('/api/clips/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events,
          attribution,
        }),
        keepalive: immediate, // Survives page unload
      });
    } catch {
      // Re-queue events on failure (unless immediate/unload)
      if (!immediate) {
        this.eventBuffer.unshift(
          ...events.map(e => ({
            type: 'view' as const,
            data: e,
            timestamp: Date.now(),
          }))
        );
      }
    }
  }

  private async sendFunnelEvents(
    events: Array<FunnelEventData & { timestamp: number }>,
    attribution: ReturnType<typeof getAttribution>,
    immediate: boolean
  ): Promise<void> {
    try {
      await fetch('/api/analytics/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events,
          attribution,
        }),
        keepalive: immediate,
      });
    } catch {
      // Re-queue events on failure (unless immediate/unload)
      if (!immediate) {
        this.eventBuffer.unshift(
          ...events.map(e => ({
            type: 'funnel' as const,
            data: e,
            timestamp: e.timestamp,
          }))
        );
      }
    }
  }
}

// Singleton instance
let analyticsInstance: ClipAnalytics | null = null;

export function getClipAnalytics(): ClipAnalytics {
  if (!analyticsInstance) {
    analyticsInstance = new ClipAnalytics();
  }
  return analyticsInstance;
}

// Convenience exports for direct usage
export const clipAnalytics = {
  startView: (clipId: number, clipDuration?: number) =>
    getClipAnalytics().startView(clipId, clipDuration),

  endView: () =>
    getClipAnalytics().endCurrentView(),

  trackShopClick: (clipId: number, productHandle?: string) =>
    getClipAnalytics().trackShopClick(clipId, productHandle),

  trackShare: (clipId: number, method?: string) =>
    getClipAnalytics().trackShare(clipId, method),

  trackProductView: (productHandle: string, fromClipId?: number) =>
    getClipAnalytics().trackProductView(productHandle, fromClipId),

  trackAddToCart: (productHandle: string, price: number, fromClipId?: number) =>
    getClipAnalytics().trackAddToCart(productHandle, price, fromClipId),

  trackCheckoutStart: (value: number, items: FunnelEventData['items']) =>
    getClipAnalytics().trackCheckoutStart(value, items),

  trackPurchase: (orderId: string, value: number, items: FunnelEventData['items']) =>
    getClipAnalytics().trackPurchase(orderId, value, items),

  trackFunnel: (event: FunnelEvent, options?: Omit<FunnelEventData, 'event'>) =>
    getClipAnalytics().trackFunnel(event, options),
};
