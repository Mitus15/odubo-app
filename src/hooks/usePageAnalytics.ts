'use client';

/**
 * usePageAnalytics Hook
 *
 * Automatic page analytics tracking that:
 * - Tracks page_view on mount
 * - Tracks scroll depth milestones (25%, 50%, 75%, 100%)
 * - Tracks time on page via heartbeat (every 30s)
 * - Cleans up on unmount
 */

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';

interface UsePageAnalyticsOptions {
  /** Custom page title (defaults to document.title) */
  title?: string;
  /** Disable scroll tracking */
  disableScroll?: boolean;
  /** Disable time tracking */
  disableTime?: boolean;
  /** Custom content type for categorization */
  contentType?: string;
}

// Scroll depth milestones to track
const SCROLL_MILESTONES = [25, 50, 75, 100];

// Time on page heartbeat interval (seconds)
const TIME_HEARTBEAT_SECONDS = 30;

export function usePageAnalytics(options: UsePageAnalyticsOptions = {}) {
  const pathname = usePathname();
  const analytics = useAnalyticsSafe();

  const { title, disableScroll, disableTime } = options;

  // Refs for tracking state
  const scrollMilestonesReachedRef = useRef<Set<number>>(new Set());
  const timeSpentRef = useRef<number>(0);
  const lastHeartbeatRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const mountTimeRef = useRef<number>(Date.now());

  // Track page view on mount
  useEffect(() => {
    if (!analytics || !pathname) return;

    // Reset tracking state for new page
    scrollMilestonesReachedRef.current.clear();
    timeSpentRef.current = 0;
    lastHeartbeatRef.current = 0;
    mountTimeRef.current = Date.now();

    // Track page view
    analytics.trackPageView(pathname, title);
  }, [analytics, pathname, title]);

  // Scroll depth tracking
  useEffect(() => {
    if (!analytics || !pathname || disableScroll) return;

    const handleScroll = () => {
      if (!isVisibleRef.current) return;

      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);

      for (const milestone of SCROLL_MILESTONES) {
        if (scrollPercent >= milestone && !scrollMilestonesReachedRef.current.has(milestone)) {
          scrollMilestonesReachedRef.current.add(milestone);
          analytics.trackScroll(pathname, milestone);
        }
      }
    };

    // Check scroll on mount (page might already be scrolled)
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [analytics, pathname, disableScroll]);

  // Time on page tracking
  useEffect(() => {
    if (!analytics || !pathname || disableTime) return;

    let intervalId: ReturnType<typeof setInterval>;

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };

    const tick = () => {
      if (!isVisibleRef.current) return;

      timeSpentRef.current += 1;

      // Send heartbeat every TIME_HEARTBEAT_SECONDS
      if (timeSpentRef.current - lastHeartbeatRef.current >= TIME_HEARTBEAT_SECONDS) {
        lastHeartbeatRef.current = timeSpentRef.current;
        analytics.trackTimeOnPage(pathname, timeSpentRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    intervalId = setInterval(tick, 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);

      // Final time tracking on unmount (if meaningful time spent)
      if (timeSpentRef.current > 0) {
        analytics.trackTimeOnPage(pathname, timeSpentRef.current);
      }
    };
  }, [analytics, pathname, disableTime]);

  // Expose a manual track function for custom events
  const trackCustomEvent = useCallback(
    (eventType: string, metadata?: Record<string, string | number | boolean>) => {
      if (!analytics) return;
      // This would need to be added to the analytics context if needed
      // For now, we use the existing tracking methods
    },
    [analytics]
  );

  return {
    isTracking: !!analytics,
    pathname,
    trackCustomEvent,
  };
}

/**
 * Lightweight hook for pages that only need page view tracking.
 * Use this for simple pages that don't need scroll/time tracking.
 */
export function usePageView(customTitle?: string) {
  const pathname = usePathname();
  const analytics = useAnalyticsSafe();

  useEffect(() => {
    if (!analytics || !pathname) return;
    analytics.trackPageView(pathname, customTitle);
  }, [analytics, pathname, customTitle]);
}
