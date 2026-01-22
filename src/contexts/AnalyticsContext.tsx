'use client';

/**
 * Analytics Context
 *
 * Central provider for web analytics that:
 * - Initializes attribution on mount
 * - Tracks page views, clicks, scroll depth, and time on page
 * - Batches events and sends to /api/analytics/events
 * - Uses sendBeacon on page unload for reliable delivery
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { initAttribution, getAttribution, getSessionId } from '@/lib/attribution';
import { getVisitorId, generateFingerprint } from '@/lib/visitorId';

// ============================================
// Types
// ============================================

export type AnalyticsEventType =
  | 'page_view'
  | 'site_visit'
  | 'scroll_depth'
  | 'time_on_page'
  | 'click'
  | 'search'
  | 'product_view'
  | 'shop_visit'
  | 'add_to_cart'
  | 'checkout_start'
  // Modal tracking
  | 'modal_open'
  | 'modal_close'
  // Gallery/Moments tracking
  | 'gallery_view'
  | 'photo_view'
  | 'rsvp_submit'
  // Video tracking
  | 'video_open'
  | 'video_progress'
  // Clip tracking
  | 'clip_view'
  | 'clip_complete'
  // Music tracking
  | 'album_view'
  | 'track_play';

export type ModalType = 'store' | 'moments' | 'media';
export type CloseType = 'button' | 'escape' | 'backdrop' | 'navigation';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  path: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean | null>;
}

interface AnalyticsContextValue {
  // Track events
  trackPageView: (path: string, title?: string) => void;
  trackClick: (elementId: string, elementType: string, path: string) => void;
  trackScroll: (path: string, depth: number) => void;
  trackTimeOnPage: (path: string, seconds: number) => void;
  trackSearch: (query: string, resultsCount?: number) => void;
  trackProductView: (productHandle: string, fromClipId?: number) => void;
  trackShopVisit: () => void;
  trackAddToCart: (productHandle: string, price: number, variantId?: string) => void;
  trackCheckoutStart: (totalValue: number, itemCount: number) => void;

  // Modal tracking
  trackModalOpen: (modalType: ModalType, metadata?: { tab?: string; fromClipId?: number }) => void;
  trackModalClose: (modalType: ModalType, durationMs: number, closeType: CloseType) => void;

  // Gallery/Moments tracking
  trackGalleryView: (galleryId: number, photoCount: number) => void;
  trackPhotoView: (galleryId: number, photoIndex: number) => void;
  trackRsvpSubmit: (galleryId: number, fields: { hasEmail: boolean; hasInstagram: boolean; hasPhone: boolean }) => void;

  // Video tracking
  trackVideoOpen: (videoId: number, title: string) => void;
  trackVideoProgress: (videoId: number, watchPercentage: number, watchSeconds: number) => void;

  // Music tracking
  trackAlbumView: (albumId: string, trackCount: number) => void;
  trackTrackPlay: (albumId: string, trackId: string, playSeconds: number) => void;

  // Clip tracking for journey analytics
  trackClipView: (clipId: number, clipTitle?: string) => void;

  // Identity
  visitorId: string;
  sessionId: string;

  // Session state for journey analytics
  clipsViewedThisSession: number;

  // State
  isInitialized: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

// ============================================
// Constants
// ============================================

const FLUSH_INTERVAL_MS = 10000; // 10 seconds
const MAX_BUFFER_SIZE = 50;
const API_ENDPOINT = '/api/analytics/events';

// ============================================
// Provider
// ============================================

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const eventBufferRef = useRef<AnalyticsEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);
  const visitorIdRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');
  const hasSentSiteVisitRef = useRef(false);

  // Journey analytics state
  const clipsViewedThisSessionRef = useRef<number>(0);
  const lastClipIdRef = useRef<number | null>(null);

  // Initialize on mount
  useEffect(() => {
    if (typeof window === 'undefined' || isInitializedRef.current) return;

    // Initialize attribution
    initAttribution();

    // Get/generate visitor ID and session ID
    visitorIdRef.current = getVisitorId();
    sessionIdRef.current = getSessionId();

    // Generate fingerprint in background
    generateFingerprint();

    isInitializedRef.current = true;

    // Track initial site visit (once per session)
    if (!hasSentSiteVisitRef.current) {
      hasSentSiteVisitRef.current = true;
      queueEvent({
        type: 'site_visit',
        path: window.location.pathname,
        timestamp: Date.now(),
        metadata: {
          referrer: document.referrer || null,
          userAgent: navigator.userAgent,
        },
      });
    }

    // Set up unload handlers
    const handleUnload = () => flush(true);
    const handleVisibilityChange = () => {
      if (document.hidden) {
        flush(true);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  // Queue an event for batching
  const queueEvent = useCallback((event: AnalyticsEvent) => {
    eventBufferRef.current.push(event);

    // Immediate flush if buffer is full
    if (eventBufferRef.current.length >= MAX_BUFFER_SIZE) {
      flush(false);
      return;
    }

    // Schedule flush
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flush(false);
      }, FLUSH_INTERVAL_MS);
    }
  }, []);

  // Flush events to server
  const flush = useCallback((immediate: boolean) => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    const events = eventBufferRef.current;
    if (events.length === 0) return;

    eventBufferRef.current = [];

    const attribution = getAttribution();
    const payload = JSON.stringify({
      sessionId: sessionIdRef.current,
      visitorId: visitorIdRef.current,
      events,
      attribution,
    });

    if (immediate && navigator.sendBeacon) {
      // Use sendBeacon for reliable delivery on unload
      navigator.sendBeacon(API_ENDPOINT, payload);
    } else {
      // Regular fetch
      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: immediate,
      }).catch(() => {
        // Re-queue events on failure (unless immediate/unload)
        if (!immediate) {
          eventBufferRef.current.unshift(...events);
        }
      });
    }
  }, []);

  // ============================================
  // Tracking Methods
  // ============================================

  const trackPageView = useCallback((path: string, title?: string) => {
    queueEvent({
      type: 'page_view',
      path,
      timestamp: Date.now(),
      metadata: {
        title: title || document.title || null,
        referrer: document.referrer || null,
      },
    });
  }, [queueEvent]);

  const trackClick = useCallback((elementId: string, elementType: string, path: string) => {
    queueEvent({
      type: 'click',
      path,
      timestamp: Date.now(),
      metadata: {
        elementId,
        elementType,
      },
    });
  }, [queueEvent]);

  const trackScroll = useCallback((path: string, depth: number) => {
    queueEvent({
      type: 'scroll_depth',
      path,
      timestamp: Date.now(),
      metadata: {
        depth,
      },
    });
  }, [queueEvent]);

  const trackTimeOnPage = useCallback((path: string, seconds: number) => {
    queueEvent({
      type: 'time_on_page',
      path,
      timestamp: Date.now(),
      metadata: {
        seconds,
      },
    });
  }, [queueEvent]);

  const trackSearch = useCallback((query: string, resultsCount?: number) => {
    queueEvent({
      type: 'search',
      path: window.location.pathname,
      timestamp: Date.now(),
      metadata: {
        query,
        resultsCount: resultsCount ?? null,
      },
    });
  }, [queueEvent]);

  const trackProductView = useCallback((productHandle: string, fromClipId?: number) => {
    queueEvent({
      type: 'product_view',
      path: `/store/product/${productHandle}`,
      timestamp: Date.now(),
      metadata: {
        productHandle,
        fromClipId: fromClipId ?? null,
      },
    });
  }, [queueEvent]);

  const trackShopVisit = useCallback(() => {
    queueEvent({
      type: 'shop_visit',
      path: '/store',
      timestamp: Date.now(),
    });
  }, [queueEvent]);

  const trackAddToCart = useCallback((productHandle: string, price: number, variantId?: string) => {
    queueEvent({
      type: 'add_to_cart',
      path: window.location.pathname,
      timestamp: Date.now(),
      metadata: {
        productHandle,
        price,
        variantId: variantId ?? null,
      },
    });
  }, [queueEvent]);

  const trackCheckoutStart = useCallback((totalValue: number, itemCount: number) => {
    queueEvent({
      type: 'checkout_start',
      path: '/store/checkout',
      timestamp: Date.now(),
      metadata: {
        totalValue,
        itemCount,
      },
    });
  }, [queueEvent]);

  // ============================================
  // Modal Tracking Methods
  // ============================================

  const trackModalOpen = useCallback((modalType: ModalType, metadata?: { tab?: string; fromClipId?: number }) => {
    queueEvent({
      type: 'modal_open',
      path: `/${modalType}`,
      timestamp: Date.now(),
      metadata: {
        modalType,
        tab: metadata?.tab || null,
        fromClipId: metadata?.fromClipId || null,
        clipsWatchedBefore: clipsViewedThisSessionRef.current,
        lastClipId: lastClipIdRef.current,
      },
    });
  }, [queueEvent]);

  const trackModalClose = useCallback((modalType: ModalType, durationMs: number, closeType: CloseType) => {
    queueEvent({
      type: 'modal_close',
      path: `/${modalType}`,
      timestamp: Date.now(),
      metadata: {
        modalType,
        durationMs,
        closeType,
        isQuickBounce: durationMs < 5000, // Less than 5 seconds
        isEngaged: durationMs >= 30000,    // More than 30 seconds
      },
    });
  }, [queueEvent]);

  // ============================================
  // Gallery/Moments Tracking Methods
  // ============================================

  const trackGalleryView = useCallback((galleryId: number, photoCount: number) => {
    queueEvent({
      type: 'gallery_view',
      path: `/moments/gallery/${galleryId}`,
      timestamp: Date.now(),
      metadata: {
        galleryId,
        photoCount,
      },
    });
  }, [queueEvent]);

  const trackPhotoView = useCallback((galleryId: number, photoIndex: number) => {
    queueEvent({
      type: 'photo_view',
      path: `/moments/gallery/${galleryId}/photo/${photoIndex}`,
      timestamp: Date.now(),
      metadata: {
        galleryId,
        photoIndex,
      },
    });
  }, [queueEvent]);

  const trackRsvpSubmit = useCallback((galleryId: number, fields: { hasEmail: boolean; hasInstagram: boolean; hasPhone: boolean }) => {
    queueEvent({
      type: 'rsvp_submit',
      path: `/moments/gallery/${galleryId}/rsvp`,
      timestamp: Date.now(),
      metadata: {
        galleryId,
        hasEmail: fields.hasEmail,
        hasInstagram: fields.hasInstagram,
        hasPhone: fields.hasPhone,
        fieldCount: [fields.hasEmail, fields.hasInstagram, fields.hasPhone].filter(Boolean).length,
      },
    });
  }, [queueEvent]);

  // ============================================
  // Video Tracking Methods
  // ============================================

  const trackVideoOpen = useCallback((videoId: number, title: string) => {
    queueEvent({
      type: 'video_open',
      path: `/media/video/${videoId}`,
      timestamp: Date.now(),
      metadata: {
        videoId,
        title,
      },
    });
  }, [queueEvent]);

  const trackVideoProgress = useCallback((videoId: number, watchPercentage: number, watchSeconds: number) => {
    queueEvent({
      type: 'video_progress',
      path: `/media/video/${videoId}`,
      timestamp: Date.now(),
      metadata: {
        videoId,
        watchPercentage,
        watchSeconds,
        milestone: watchPercentage >= 75 ? '75%' : watchPercentage >= 50 ? '50%' : watchPercentage >= 25 ? '25%' : 'started',
      },
    });
  }, [queueEvent]);

  // ============================================
  // Music Tracking Methods
  // ============================================

  const trackAlbumView = useCallback((albumId: string, trackCount: number) => {
    queueEvent({
      type: 'album_view',
      path: `/music/album/${albumId}`,
      timestamp: Date.now(),
      metadata: {
        albumId,
        trackCount,
      },
    });
  }, [queueEvent]);

  const trackTrackPlay = useCallback((albumId: string, trackId: string, playSeconds: number) => {
    queueEvent({
      type: 'track_play',
      path: `/music/album/${albumId}/track/${trackId}`,
      timestamp: Date.now(),
      metadata: {
        albumId,
        trackId,
        playSeconds,
      },
    });
  }, [queueEvent]);

  // ============================================
  // Clip Tracking (for journey analytics)
  // ============================================

  const trackClipView = useCallback((clipId: number, clipTitle?: string) => {
    // Avoid tracking the same clip twice in a row (e.g., from scroll bouncing)
    if (lastClipIdRef.current === clipId) return;

    clipsViewedThisSessionRef.current += 1;
    lastClipIdRef.current = clipId;

    // Queue actual clip_view event for analytics
    queueEvent({
      type: 'clip_view' as AnalyticsEventType,
      path: `/clips/${clipId}`,
      timestamp: Date.now(),
      metadata: {
        clipId,
        clipTitle: clipTitle || null,
        clipIndex: clipsViewedThisSessionRef.current,
      },
    });
  }, [queueEvent]);

  // ============================================
  // Context Value
  // ============================================

  const value: AnalyticsContextValue = {
    trackPageView,
    trackClick,
    trackScroll,
    trackTimeOnPage,
    trackSearch,
    trackProductView,
    trackShopVisit,
    trackAddToCart,
    trackCheckoutStart,
    // Modal tracking
    trackModalOpen,
    trackModalClose,
    // Gallery/Moments tracking
    trackGalleryView,
    trackPhotoView,
    trackRsvpSubmit,
    // Video tracking
    trackVideoOpen,
    trackVideoProgress,
    // Music tracking
    trackAlbumView,
    trackTrackPlay,
    // Clip tracking
    trackClipView,
    // Identity
    visitorId: visitorIdRef.current,
    sessionId: sessionIdRef.current,
    // Session state
    clipsViewedThisSession: clipsViewedThisSessionRef.current,
    // State
    isInitialized: isInitializedRef.current,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

/**
 * Safe hook that returns null if not in provider context.
 * Useful for components that may be rendered outside the provider.
 */
export function useAnalyticsSafe(): AnalyticsContextValue | null {
  return useContext(AnalyticsContext);
}
