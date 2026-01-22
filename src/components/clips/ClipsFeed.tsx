"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { ClipItem, ClipApiRow } from '@/types/clips';
import { mapClipRows } from '@/lib/clipsMapper';
import { useAudio } from '@/contexts/AudioContext';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import PosterCard from '@/components/clips/PosterCard';

const PAGE_SIZE = 12; // Larger pages for better infinite scroll

interface ClipsFeedProps {
  navHeight: number;
  initialClipId?: number | null;
  initialClips?: ClipItem[];  // Server-rendered clips to avoid client waterfall
  onActiveClipChange?: (clip: ClipItem | null) => void;
  onClipsReady?: (clips: ClipItem[], activeIndex: number) => void;
  onScrollDirectionChange?: (direction: 'forward' | 'backward' | null) => void;
  videoReady?: boolean;
  /** Ref to expose scrollToNextClip function to parent - replaces window global */
  scrollToNextRef?: MutableRefObject<(() => void) | null>;
}

/**
 * ClipsFeed - Scroll container with poster-only cards
 *
 * This component handles:
 * - Fetching clips from the API
 * - Managing the fair shuffle deck
 * - Detecting which clip is active via IntersectionObserver
 * - Passing clips and activeIndex to parent for SingleVideoPlayer
 *
 * Video playback is handled by SingleVideoPlayer (fixed position).
 * This component only renders poster images for scrolling.
 */
export default function ClipsFeed({
  navHeight,
  initialClipId,
  initialClips,
  onActiveClipChange,
  onClipsReady,
  onScrollDirectionChange,
  videoReady = false,
  scrollToNextRef,
}: ClipsFeedProps) {
  const { armAudio } = useAudio();
  const analytics = useAnalyticsSafe();

  const [displayClips, setDisplayClips] = useState<Array<ClipItem & { uniqueKey: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [scrollDirection, setScrollDirection] = useState<'forward' | 'backward' | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inflightRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const prevScrollTopRef = useRef(0);
  // Session seed for consistent random order across pagination
  const sessionSeedRef = useRef(Math.random().toString(36).substring(2, 12));
  const keyCounterRef = useRef(0);
  const pageRef = useRef(0);
  const initializedRef = useRef(false);
  // Store the base clips (original fetched clips) for circular looping
  const baseClipsRef = useRef<ClipItem[]>([]);
  // Track if we've exhausted the API (no more pages)
  const apiExhaustedRef = useRef(false);
  // Debounce loadMore to prevent rapid calls
  const loadMoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadMoreTimeRef = useRef(0);

  // Fetch clips from API with session seed for consistent random order
  const fetchPage = useCallback(async (p: number): Promise<boolean> => {
    if (inflightRef.current > 0) return false;
    inflightRef.current++;
    if (p === 0) setLoading(true);
    setError('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const url = new URL('/api/clips', window.location.origin);
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(p * PAGE_SIZE));
      // Use session seed for consistent random order across pages
      url.searchParams.set('seed', sessionSeedRef.current);

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: ctrl.signal,
        cache: 'no-store'
      });

      const data = await res.json().catch(() => ({})) as { error?: string; clips?: ClipApiRow[]; hasMore?: boolean };
      if (!res.ok) throw new Error(data?.error || 'Failed to load clips');

      const rows: ClipApiRow[] = Array.isArray(data?.clips) ? data.clips : [];
      const mapped = mapClipRows(rows);

      // Add unique keys for React
      const withKeys = mapped.map(clip => ({
        ...clip,
        uniqueKey: `${keyCounterRef.current++}-${clip.id}-${sessionSeedRef.current}`
      }));

      setDisplayClips(prev => p === 0 ? withKeys : [...prev, ...withKeys]);

      const hasMoreFromApi = data.hasMore ?? mapped.length === PAGE_SIZE;
      setHasMore(hasMoreFromApi);
      pageRef.current = p;

      // Track when API is exhausted - store base clips for circular looping
      if (!hasMoreFromApi && !apiExhaustedRef.current) {
        apiExhaustedRef.current = true;
        // Store base clips (without unique keys) for looping
        setDisplayClips(current => {
          baseClipsRef.current = current.map(({ uniqueKey, ...clip }) => clip as ClipItem);
          return current;
        });
      }

      // Set initial active clip on first page
      if (p === 0 && withKeys[0]) {
        setActiveId(withKeys[0].id);
        setActiveIndex(0);
        initializedRef.current = true;
      }

      return mapped.length > 0;
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        const msg = e?.message || String(e);
        if (!navigator.onLine || msg.includes('network') || msg.includes('fetch')) {
          setError('Connection lost. Check your internet and try again.');
        } else if (msg.includes('404') || msg.includes('not found')) {
          setError('Content not found.');
        } else if (msg.includes('500') || msg.includes('server')) {
          setError('Server error. Please try again later.');
        } else {
          setError(msg);
        }
      }
      return false;
    } finally {
      inflightRef.current--;
      setLoading(false);
    }
  }, []);

  // Initial setup: use SSR clips if available, otherwise fetch
  useEffect(() => {
    if (initialClips && initialClips.length > 0 && !initializedRef.current) {
      // Use server-rendered clips - skip API call
      const withKeys = initialClips.map(clip => ({
        ...clip,
        uniqueKey: `${keyCounterRef.current++}-${clip.id}-ssr`
      }));

      setDisplayClips(withKeys);
      // Store base clips for circular looping (SSR clips are the complete set)
      baseClipsRef.current = initialClips;
      setHasMore(true); // Assume more clips are available for pagination
      setLoading(false);
      pageRef.current = 0;

      if (withKeys[0]) {
        setActiveId(withKeys[0].id);
        setActiveIndex(0);
      }
      initializedRef.current = true;
    } else if (!initializedRef.current) {
      // No SSR clips, fetch from API
      fetchPage(0);
    }

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchPage, initialClips]);

  // Maximum number of clip instances to keep in memory (prevents infinite growth)
  // With virtualization, only ~5 are rendered at once anyway
  const MAX_DISPLAY_CLIPS = 100;
  // Minimum time between loadMore calls (ms)
  const LOAD_MORE_DEBOUNCE = 500;

  // Load more clips - fetch next page or loop circularly
  const handleLoadMore = useCallback(() => {
    // Debounce: prevent rapid repeated calls
    const now = Date.now();
    if (now - lastLoadMoreTimeRef.current < LOAD_MORE_DEBOUNCE) {
      return;
    }

    if (inflightRef.current > 0) return;

    // If API has more pages, fetch them
    if (hasMore) {
      lastLoadMoreTimeRef.current = now;
      fetchPage(pageRef.current + 1);
      return;
    }

    // API exhausted - append cloned clips for infinite circular scrolling
    // This avoids refetching and creates seamless looping
    if (baseClipsRef.current.length > 0) {
      lastLoadMoreTimeRef.current = now;

      const clonedClips = baseClipsRef.current.map(clip => ({
        ...clip,
        uniqueKey: `${keyCounterRef.current++}-${clip.id}-loop`
      }));

      setDisplayClips(prev => {
        const newClips = [...prev, ...clonedClips];

        // Memory management: if array is too large, trim from the start
        // This works because virtualization only renders clips near activeIndex
        if (newClips.length > MAX_DISPLAY_CLIPS) {
          const trimCount = newClips.length - MAX_DISPLAY_CLIPS;
          // Adjust activeIndex to compensate for trimming
          setActiveIndex(idx => Math.max(0, idx - trimCount));
          return newClips.slice(trimCount);
        }

        return newClips;
      });
    }
  }, [hasMore, fetchPage]);

  // Active clip detection using IntersectionObserver (primary) with scroll fallbacks
  // IntersectionObserver is more reliable than manual scroll position calculations
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !displayClips.length) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastScrollTop = root.scrollTop;

    // Track the most visible clip via IntersectionObserver
    const visibilityMap = new Map<number, number>(); // clipIndex -> intersectionRatio

    const updateActiveFromVisibility = () => {
      if (visibilityMap.size === 0) return;

      // Find the clip with highest visibility
      let bestIndex = -1;
      let bestRatio = 0;

      visibilityMap.forEach((ratio, index) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestIndex = index;
        }
      });

      // Only update if we found a clip with >50% visibility
      if (bestIndex >= 0 && bestRatio >= 0.5) {
        const clip = displayClips[bestIndex];
        if (clip && clip.id !== activeId) {
          setActiveId(clip.id);
          setActiveIndex(bestIndex);

          // Load more if near end
          if (bestIndex >= displayClips.length - 2) {
            handleLoadMore();
          }
        }
      }
    };

    // IntersectionObserver: primary detection method
    // CRITICAL: root must be the scroll container, NOT viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute('data-clip-index') || '-1', 10);
          if (index >= 0) {
            if (entry.isIntersecting) {
              visibilityMap.set(index, entry.intersectionRatio);
            } else {
              visibilityMap.delete(index);
            }
          }
        });
        updateActiveFromVisibility();
      },
      {
        root: root, // CRITICAL: scroll container, NOT viewport
        threshold: [0.5, 0.7, 0.9], // Multiple thresholds for granular detection
      }
    );

    // Observe all clip sections
    const sections = root.querySelectorAll('[data-clip-index]');
    sections.forEach((section) => observer.observe(section));

    // Scroll direction tracking (still needed for video behavior)
    const handleScroll = () => {
      const currentScrollTop = root.scrollTop;
      const newDirection = currentScrollTop > prevScrollTopRef.current ? 'forward' : 'backward';
      if (Math.abs(currentScrollTop - prevScrollTopRef.current) > 5) {
        setScrollDirection(newDirection);
      }
      prevScrollTopRef.current = currentScrollTop;

      // Fallback timeout in case IntersectionObserver misses edge cases
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (root.scrollTop === lastScrollTop) {
          updateActiveFromVisibility();
        }
        lastScrollTop = root.scrollTop;
      }, 100); // Increased from 30ms - IO handles most cases now

      lastScrollTop = root.scrollTop;
    };

    // scrollend event as enhancement (when browser supports it)
    const handleScrollEndEvent = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      updateActiveFromVisibility();
    };

    root.addEventListener('scroll', handleScroll, { passive: true });
    root.addEventListener('scrollend', handleScrollEndEvent, { passive: true });

    // Initial detection
    updateActiveFromVisibility();

    return () => {
      observer.disconnect();
      if (scrollTimeout) clearTimeout(scrollTimeout);
      root.removeEventListener('scroll', handleScroll);
      root.removeEventListener('scrollend', handleScrollEndEvent);
    };
  }, [displayClips, handleLoadMore, activeId]);

  // Notify parent of active clip change
  useEffect(() => {
    if (!onActiveClipChange) return;
    const activeClip = displayClips.find(c => c.id === activeId);
    onActiveClipChange(activeClip || null);
  }, [activeId, displayClips, onActiveClipChange]);

  // Track clip views for analytics when active clip changes
  useEffect(() => {
    if (!activeId || !analytics) return;
    const activeClip = displayClips.find(c => c.id === activeId);
    analytics.trackClipView(activeId, activeClip?.title);
  }, [activeId, analytics, displayClips]);

  // Notify parent when clips are ready
  useEffect(() => {
    if (!onClipsReady || !displayClips.length) return;
    onClipsReady(displayClips, activeIndex);
  }, [displayClips, activeIndex, onClipsReady]);

  // Notify parent of scroll direction changes
  useEffect(() => {
    onScrollDirectionChange?.(scrollDirection);
  }, [scrollDirection, onScrollDirectionChange]);

  // Scroll to next clip (called by parent when video ends)
  const scrollToNextClip = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const nextIndex = activeIndex + 1;
    if (nextIndex >= displayClips.length) {
      // At the end, load more if possible
      handleLoadMore();
      return;
    }

    const nextSection = root.querySelector(`[data-clip-index="${nextIndex}"]`);
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeIndex, displayClips.length, handleLoadMore]);

  // Expose scrollToNextClip to parent via ref (type-safe, no global pollution)
  useEffect(() => {
    if (scrollToNextRef) {
      scrollToNextRef.current = scrollToNextClip;
    }
    return () => {
      if (scrollToNextRef) {
        scrollToNextRef.current = null;
      }
    };
  }, [scrollToNextClip, scrollToNextRef]);

  return (
    <div
      ref={rootRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden"
      style={{
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'none',
        touchAction: 'pan-y',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
      onClick={() => armAudio()}
    >
      {/* Loading state */}
      {loading && displayClips.length === 0 && (
        <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
          <div className="flex flex-col items-center gap-3 text-white/60">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <p className="text-sm">Loading clips...</p>
          </div>
        </div>
      )}

      {/* Clips - virtualized: only render activeIndex ± 2 */}
      {displayClips.map((clip, index) => {
        // Virtualization: skip clips far from active index
        const distance = Math.abs(index - activeIndex);
        if (distance > 2) {
          // Render placeholder to maintain scroll position
          return (
            <div
              key={clip.uniqueKey}
              data-clip-index={index}
              style={{ height: '100dvh', scrollSnapAlign: 'start' }}
            />
          );
        }

        return (
          <section
            key={clip.uniqueKey}
            data-clip-key={clip.uniqueKey}
            data-clip-id={clip.id}
            data-clip-index={index}
            className="w-full flex items-center justify-center flex-shrink-0"
            style={{
              height: '100dvh',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              touchAction: 'pan-y'
            }}
          >
            <PosterCard
              clip={clip}
              active={activeId === clip.id}
              videoReady={activeId === clip.id && videoReady}
            />
          </section>
        );
      })}

      {/* Error state with retry */}
      {error && (
        <div className="mx-auto max-w-md my-4 p-4 rounded-xl border border-red-700/60 bg-red-900/30 text-red-200 text-sm text-center">
          <p className="mb-3">{error}</p>
          <button
            onClick={() => {
              setError('');
              fetchPage(0);
            }}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
