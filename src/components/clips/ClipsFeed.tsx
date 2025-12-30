"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipItem, ClipApiRow } from '@/types/clips';
import { mapClipRows } from '@/lib/clipsMapper';
import { shuffleArray } from '@/lib/utils';
import { addPrefetchHints, removePrefetchHints, prefetchFirstSegment, prefetchManifest } from '@/lib/hlsPrefetch';
import { getRenderWindowRadius, getPrefetchWindow } from '@/lib/deviceInfo';
import ClipCard from '@/components/clips/ClipCard';
import { useAudio } from '@/contexts/AudioContext';

const PAGE_SIZE = 8;

interface ClipsFeedProps {
  navHeight: number;
  initialClipId?: number | null;
  onActiveClipChange?: (clip: ClipItem | null) => void;
}

export default function ClipsFeed({ navHeight, initialClipId, onActiveClipChange }: ClipsFeedProps) {
  const { armAudio } = useAudio();

  const [baseClips, setBaseClips] = useState<ClipItem[]>([]);
  const [displayClips, setDisplayClips] = useState<Array<ClipItem & { uniqueKey: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastAutoScrollIndex, setLastAutoScrollIndex] = useState(-1);
  const [hasMore, setHasMore] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const inflightRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const seedRef = useRef(Math.random().toString(36).substring(2, 9));
  const keyCounterRef = useRef(0);
  const deckRef = useRef<ClipItem[]>([]);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const prevBaseClipsRef = useRef<ClipItem[]>([]);
  const initializedRef = useRef(false);

  // Fetch clips from API
  const fetchPage = useCallback(async (p: number): Promise<boolean> => {
    if (inflightRef.current > 0) return false;
    inflightRef.current++;
    setLoading(true);
    setError('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const url = new URL('/api/clips', window.location.origin);
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(p * PAGE_SIZE));

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: ctrl.signal,
        cache: 'no-store'
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load clips');

      const rows: ClipApiRow[] = Array.isArray(data?.clips) ? data.clips : [];
      const mapped = mapClipRows(rows);

      setBaseClips(prev => p === 0 ? mapped : dedupeById([...prev, ...mapped]));
      setHasMore(mapped.length > 0);
      return mapped.length > 0;
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        // Parse error type for user-friendly messages
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
      removePrefetchHints();
    };
  }, [fetchPage]);

  // Load all pages
  useEffect(() => {
    if (baseClips.length === 0 || !hasMore) return;
    let cancelled = false;

    (async () => {
      let page = 1;
      while (!cancelled && hasMore) {
        const got = await fetchPage(page);
        if (!got) break;
        page++;
      }
    })();

    return () => { cancelled = true; };
  }, [baseClips.length, hasMore, fetchPage]);

  // Build fair shuffle deck
  const buildFairDeck = useCallback((clips: ClipItem[], exclude: Set<number>) => {
    const buckets = new Map<string, ClipItem[]>();
    for (const c of clips) {
      if (exclude.has(c.id)) continue;
      const key = c.parentId != null ? `p:${c.parentId}` : `u:${c.id}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(c);
    }

    for (const [k, arr] of buckets.entries()) {
      buckets.set(k, shuffleArray(arr));
    }

    const deck: ClipItem[] = [];
    while (buckets.size > 0) {
      const keys = shuffleArray([...buckets.keys()]);
      for (const key of keys) {
        const bucket = buckets.get(key);
        if (!bucket?.length) { buckets.delete(key); continue; }
        deck.push(bucket.shift()!);
        if (!bucket.length) buckets.delete(key);
      }
    }
    return deck;
  }, []);

  // Append from deck
  const appendFromDeck = useCallback((count: number) => {
    if (!deckRef.current.length) {
      deckRef.current = buildFairDeck(baseClips, seenIdsRef.current);
      if (!deckRef.current.length) {
        seenIdsRef.current.clear();
        deckRef.current = buildFairDeck(baseClips, seenIdsRef.current);
      }
    }

    const out: Array<ClipItem & { uniqueKey: string }> = [];
    for (let i = 0; i < count && deckRef.current.length; i++) {
      const clip = deckRef.current.shift()!;
      seenIdsRef.current.add(clip.id);
      out.push({ ...clip, uniqueKey: `${keyCounterRef.current++}-${clip.id}-${seedRef.current}` });
    }

    if (out.length) setDisplayClips(prev => [...prev, ...out]);
  }, [baseClips, buildFairDeck]);

  // Initialize display
  useEffect(() => {
    if (initializedRef.current || baseClips.length === 0 || hasMore) return;

    let orderedClips: ClipItem[];

    if (initialClipId) {
      const target = baseClips.find(c => c.id === initialClipId);
      if (target) {
        const remaining = baseClips.filter(c => c.id !== initialClipId);
        orderedClips = [target, ...buildFairDeck(remaining, new Set([initialClipId]))];
      } else {
        orderedClips = buildFairDeck(baseClips, seenIdsRef.current);
      }
    } else {
      orderedClips = buildFairDeck(baseClips, seenIdsRef.current);
    }

    const batch = orderedClips.slice(0, PAGE_SIZE);
    deckRef.current = orderedClips.slice(PAGE_SIZE);
    batch.forEach(c => seenIdsRef.current.add(c.id));

    const display = batch.map(clip => ({
      ...clip,
      uniqueKey: `${keyCounterRef.current++}-${clip.id}-${seedRef.current}`
    }));

    setDisplayClips(display);
    if (display[0]) setActiveId(display[0].id);
    initializedRef.current = true;
  }, [baseClips, hasMore, buildFairDeck, initialClipId]);

  // Load more when near end
  const handleLoadMore = useCallback(() => {
    if (!baseClips.length) return;
    appendFromDeck(PAGE_SIZE);
  }, [appendFromDeck, baseClips.length]);

  // Rebuild deck when clips change
  useEffect(() => {
    if (!baseClips.length) return;
    const prev = prevBaseClipsRef.current;
    const prevIds = new Set(prev.map(c => c.id));
    const newClips = baseClips.filter(c => !prevIds.has(c.id));

    if (newClips.length && initializedRef.current) {
      const shuffled = shuffleArray(newClips);
      for (const clip of shuffled) {
        const pos = Math.floor(Math.random() * (deckRef.current.length + 1));
        deckRef.current.splice(pos, 0, clip);
      }
    }
    prevBaseClipsRef.current = baseClips;
  }, [baseClips]);

  // Intersection observer for active clip detection
  // Uses 0.5 threshold (50% visibility) for faster transitions
  // No debounce - immediate switch to prevent pause gap between clips
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (!visible.length) return;

        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];

        const el = top.target as HTMLElement;
        const id = parseInt(el.dataset.clipId || '', 10);
        const index = parseInt(el.dataset.clipIndex || '', 10);

        if (Number.isFinite(id) && id !== activeId) {
          // Immediate switch - no debounce for seamless transitions
          setActiveId(id);
          if (Number.isFinite(index)) setActiveIndex(index);

          // Load more if near end
          if (displayClips.length && index >= displayClips.length - 2) {
            handleLoadMore();
          }
        }
      },
      {
        root,
        threshold: [0.5], // Lower threshold: 50% visibility for faster activation
        rootMargin: '0px'
      }
    );

    const items = root.querySelectorAll('[data-clip-key]');
    items.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [displayClips, handleLoadMore, activeId]);

  // Notify parent of active clip change
  useEffect(() => {
    if (!onActiveClipChange) return;
    const activeClip = displayClips.find(c => c.id === activeId);
    onActiveClipChange(activeClip || null);
  }, [activeId, displayClips, onActiveClipChange]);

  // Prefetch next clips
  useEffect(() => {
    if (!displayClips.length || activeIndex < 0) return;

    const { manifestCount, shouldPrefetchSegments } = getPrefetchWindow();
    const nextClips = displayClips.slice(activeIndex + 1, activeIndex + 1 + manifestCount);
    const urls = nextClips.map(c => c.hlsUrl).filter(Boolean);

    if (urls.length) {
      addPrefetchHints(urls);
      urls.forEach(u => prefetchManifest(u));
    }

    const next = displayClips[activeIndex + 1];
    if (shouldPrefetchSegments && next?.hlsUrl) {
      prefetchFirstSegment(next.hlsUrl);
    }
  }, [activeIndex, displayClips]);

  const windowRadius = getRenderWindowRadius();

  return (
    <div
      ref={rootRef}
      className="w-full overflow-y-auto overflow-x-hidden"
      style={{
        height: '100dvh',
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
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3 text-white/60">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <p className="text-sm">Loading clips...</p>
          </div>
        </div>
      )}

      {/* Clips */}
      {displayClips.map((clip, index) => {
        const isNearActive = Math.abs(activeIndex - index) <= windowRadius;
        const shouldPreload = index === activeIndex + 1;

        return (
          <section
            key={clip.uniqueKey}
            data-clip-key={clip.uniqueKey}
            data-clip-id={clip.id}
            data-clip-index={index}
            className="w-full flex items-center justify-center"
            style={{
              height: '100dvh',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              touchAction: 'pan-y'
            }}
          >
            {isNearActive ? (
              <ClipCard
                clip={clip}
                active={activeId === clip.id}
                shouldPreload={shouldPreload}
                onEnded={handleLoadMore}
                currentIndex={index}
                lastAutoScrollIndex={lastAutoScrollIndex}
                onAutoScroll={setLastAutoScrollIndex}
              />
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center">
                {clip.poster && (
                  <img
                    src={clip.poster}
                    alt=""
                    className="w-full h-full object-cover opacity-40"
                    loading="lazy"
                    draggable={false}
                  />
                )}
              </div>
            )}
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

function dedupeById(arr: ClipItem[]): ClipItem[] {
  const seen = new Set<number>();
  return arr.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
