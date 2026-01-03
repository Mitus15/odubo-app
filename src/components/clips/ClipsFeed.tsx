"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipItem, ClipApiRow } from '@/types/clips';
import { mapClipRows } from '@/lib/clipsMapper';
import { useAudio } from '@/contexts/AudioContext';
import PosterCard from '@/components/clips/PosterCard';

const PAGE_SIZE = 12; // Larger pages for better infinite scroll

interface ClipsFeedProps {
  navHeight: number;
  initialClipId?: number | null;
  onActiveClipChange?: (clip: ClipItem | null) => void;
  onClipsReady?: (clips: ClipItem[], activeIndex: number) => void;
  onScrollDirectionChange?: (direction: 'forward' | 'backward' | null) => void;
  videoReady?: boolean;
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
  onActiveClipChange,
  onClipsReady,
  onScrollDirectionChange,
  videoReady = false,
}: ClipsFeedProps) {
  const { armAudio } = useAudio();

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
      setHasMore(data.hasMore ?? mapped.length === PAGE_SIZE);
      pageRef.current = p;

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

  // Initial fetch
  useEffect(() => {
    fetchPage(0);
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchPage]);

  // Load more clips - fetch next page or loop with new shuffle
  const handleLoadMore = useCallback(() => {
    if (inflightRef.current > 0) return;

    if (!hasMore) {
      // All clips seen - reshuffle with new seed for infinite loop
      sessionSeedRef.current = Math.random().toString(36).substring(2, 12);
      pageRef.current = -1; // Will become 0 on next fetch
      setHasMore(true);
    }

    fetchPage(pageRef.current + 1);
  }, [hasMore, fetchPage]);

  // Scroll-end detection for smooth transitions
  // Only switch video when scroll has completely stopped
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !displayClips.length) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastScrollTop = root.scrollTop;

    const findCenteredClip = (): { id: number; index: number; distance: number } | null => {
      const viewportHeight = root.clientHeight;
      const scrollTop = root.scrollTop;
      const viewportCenter = scrollTop + viewportHeight / 2;

      let closestClip: { id: number; index: number; distance: number } | null = null;

      const items = root.querySelectorAll('[data-clip-key]');
      items.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const elTop = htmlEl.offsetTop;
        const elCenter = elTop + htmlEl.clientHeight / 2;
        const distance = Math.abs(elCenter - viewportCenter);

        const id = parseInt(htmlEl.dataset.clipId || '', 10);
        const index = parseInt(htmlEl.dataset.clipIndex || '', 10);

        if (Number.isFinite(id) && (!closestClip || distance < closestClip.distance)) {
          closestClip = { id, index, distance };
        }
      });

      return closestClip;
    };

    const handleScrollEnd = () => {
      const centered = findCenteredClip();
      if (centered && centered.id !== activeId) {
        setActiveId(centered.id);
        setActiveIndex(centered.index);

        // Load more if near end
        if (centered.index >= displayClips.length - 2) {
          handleLoadMore();
        }
      }
    };

    const handleScroll = () => {
      // Track scroll direction
      const currentScrollTop = root.scrollTop;
      const newDirection = currentScrollTop > prevScrollTopRef.current ? 'forward' : 'backward';
      if (Math.abs(currentScrollTop - prevScrollTopRef.current) > 5) {
        setScrollDirection(newDirection);
      }
      prevScrollTopRef.current = currentScrollTop;

      // Clear any pending timeout
      if (scrollTimeout) clearTimeout(scrollTimeout);

      // Set new timeout - fires when scroll stops
      scrollTimeout = setTimeout(() => {
        // Double-check scroll has truly stopped
        if (root.scrollTop === lastScrollTop) {
          handleScrollEnd();
        }
        lastScrollTop = root.scrollTop;
      }, 30); // Wait 30ms after scroll stops (reduced for faster response)

      lastScrollTop = root.scrollTop;
    };

    // Also use scrollend event if browser supports it
    const handleScrollEndEvent = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      handleScrollEnd();
    };

    root.addEventListener('scroll', handleScroll, { passive: true });
    root.addEventListener('scrollend', handleScrollEndEvent, { passive: true });

    // Initial detection
    handleScrollEnd();

    return () => {
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

  // Expose scrollToNextClip via a ref callback pattern
  useEffect(() => {
    // Attach to window for parent access (cleaner than prop drilling)
    (window as any).__clipsFeedScrollToNext = scrollToNextClip;
    return () => {
      delete (window as any).__clipsFeedScrollToNext;
    };
  }, [scrollToNextClip]);

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
