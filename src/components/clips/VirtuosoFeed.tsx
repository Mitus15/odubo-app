"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { ClipItem, ClipApiRow } from '@/types/clips';
import { mapClipRows } from '@/lib/clipsMapper';
import { shuffleArray } from '@/lib/utils';
import ClipCard from '@/components/clips/ClipCard';
import { addPrefetchHints, prefetchManifest, prefetchFirstSegment, removePrefetchHints } from '@/lib/hlsPrefetch';
import { useAudio } from '@/contexts/AudioContext';
import { getNetworkInfo, getRenderWindowRadius, getPrefetchWindow } from '@/lib/deviceInfo';

const PAGE_SIZE = 8;

export default function VirtuosoFeed({ navHeight }: { navHeight: number }) {
  const { armAudio } = useAudio();
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [baseClips, setBaseClips] = useState<ClipItem[]>([]);
  const [displayClips, setDisplayClips] = useState<Array<ClipItem & { uniqueKey: string }>>([]);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const inflightRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const seedRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const isScrollingRef = useRef<boolean>(false);
  const scrollTimerRef = useRef<number | null>(null);
  const switchTimerRef = useRef<number | null>(null);
  const initializedRef = useRef<boolean>(false);

  const fetchPage = useCallback(async (p: number) => {
    if (inflightRef.current > 0) return;
    inflightRef.current++;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const retry = async (attempt = 0): Promise<Response> => {
      try {
        const url = new URL('/api/clips', window.location.origin);
        url.searchParams.set('limit', String(PAGE_SIZE));
        url.searchParams.set('offset', String(p * PAGE_SIZE));
        url.searchParams.set('random', 'true');
        return await fetch(url.toString(), { headers: { 'Accept': 'application/json' }, signal: ctrl.signal, cache: 'no-store' as any });
      } catch (e) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
          return retry(attempt + 1);
        }
        throw e;
      }
    };

    try {
      const res = await retry();
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load clips');
      const rows: ClipApiRow[] = Array.isArray(data?.clips) ? data.clips : [];
      const mapped = mapClipRows(rows);
      setBaseClips(prev => {
        const combined = p === 0 ? mapped : dedupeById(prev.concat(mapped));
        if (p === 0 && combined.length > 0) {
          const shuffled = shuffleArray(combined);
          setDisplayClips(shuffled.map((clip, idx) => ({ ...clip, uniqueKey: `${idx}-${clip.id}-${seedRef.current}` })));
          if (!initializedRef.current) {
            initializedRef.current = true;
            setActiveIndex(0);
            setActiveId(shuffled[0].id);
          }
        }
        return combined;
      });
      setHasMore(mapped.length > 0);
    } catch (e) {
      // best-effort, errors bubble to UI elsewhere if needed
    } finally {
      inflightRef.current--;
    }
  }, []);

  useEffect(() => {
    fetchPage(0);
    return () => { abortRef.current?.abort(); removePrefetchHints(); };
  }, [fetchPage]);

  // Track scroll state for prefetch suppression
  useEffect(() => {
    const root = containerRef.current; if (!root) return;
    const onScroll = () => {
      isScrollingRef.current = true;
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(() => { isScrollingRef.current = false; }, 120) as unknown as number;
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll as any);
  }, []);

  const loadMoreBlock = useCallback(() => {
    if (!baseClips.length) return;
    const shuffled = shuffleArray(baseClips);
    const newBlock = shuffled.map((clip, idx) => ({ ...clip, uniqueKey: `${displayClips.length + idx}-${clip.id}-${seedRef.current}` }));
    setDisplayClips(prev => [...prev, ...newBlock]);
    if (hasMore) {
      setPage(p => { const np = p + 1; fetchPage(np); return np; });
    }
  }, [baseClips, displayClips.length, hasMore, fetchPage]);

  // IntersectionObserver to find the most visible item and mark active
  useEffect(() => {
    if (!containerRef.current) return;
    const root = containerRef.current;
    const items = Array.from(root.querySelectorAll('[data-clip-key]')) as HTMLElement[];
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (!visible.length) return;
      visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const top = visible[0];
      if (!top) return;
      const idAttr = (top.target as HTMLElement).dataset.clipId;
      const indexAttr = (top.target as HTMLElement).dataset.clipIndex;
      const keyAttr = (top.target as HTMLElement).dataset.clipKey;
      const id = idAttr ? parseInt(idAttr, 10) : NaN;
      const index = indexAttr ? parseInt(indexAttr, 10) : NaN;
      if (Number.isFinite(id)) {
        if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
        switchTimerRef.current = window.setTimeout(() => {
          setActiveId(id);
          if (Number.isFinite(index)) setActiveIndex(index);
          if (keyAttr && displayClips.length >= 2) {
            const secondToLast = displayClips[displayClips.length - 2];
            if (secondToLast?.uniqueKey === keyAttr) loadMoreBlock();
          }
        }, 80) as unknown as number;
      }
    }, { root, threshold: [0.7, 0.85, 0.95] });
    items.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [displayClips, loadMoreBlock]);

  // Prefetch next items (network-aware)
  useEffect(() => {
    if (!displayClips.length || activeIndex < 0) return;
    if (isScrollingRef.current) return; // suppress during fast scroll
    const { manifestCount, shouldPrefetchSegments } = getPrefetchWindow();
    const next = displayClips.slice(activeIndex + 1, activeIndex + 1 + manifestCount).map(c => c.hlsUrl);
    if (next.length) {
      addPrefetchHints(next);
      next.forEach(u => prefetchManifest(u));
      if (shouldPrefetchSegments && displayClips[activeIndex + 1]?.hlsUrl) {
        prefetchFirstSegment(displayClips[activeIndex + 1].hlsUrl);
      }
    }
  }, [activeIndex, displayClips]);

  // Note: ClipCard now handles all playback control via its own useEffects

  const itemContent = useCallback((index: number) => {
    const clip = displayClips[index];
    if (!clip) return null;
    // Network-aware render radius using centralized deviceInfo
    const radius = getRenderWindowRadius();
    const isNearActive = Math.abs(activeIndex - index) <= radius;
    const shouldPreload = index === activeIndex + 1;
    return (
      <section
        data-clip-key={clip.uniqueKey}
        data-clip-id={String(clip.id)}
        data-clip-index={String(index)}
        data-active={activeId === clip.id ? '1' : '0'}
        className="flex items-center justify-center"
        style={{ height: `calc(100svh - ${navHeight}px)`, scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {isNearActive ? (
          <ClipCard
            clip={clip}
            active={activeId === clip.id}
            shouldPreload={shouldPreload}
            onEnded={loadMoreBlock}
            currentIndex={index}
            lastAutoScrollIndex={-1}
            onAutoScroll={() => {}}
          />
        ) : (
          <div className="w-full h-full bg-black flex items-center justify-center" style={{ contentVisibility: 'auto', containIntrinsicSize: `calc(100svh - ${navHeight}px) 100vw` }}>
            <img src={clip.poster ?? undefined} alt="" className="w-full h-full object-cover opacity-40" loading="lazy" fetchPriority="low" />
          </div>
        )}
      </section>
    );
  }, [displayClips, navHeight, activeIndex, activeId, loadMoreBlock]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      onClick={() => armAudio()}
    >
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%', width: '100%' }}
        totalCount={displayClips.length}
        overscan={getNetworkInfo().isGoodNetwork ? 1 : 0}
        itemContent={itemContent}
        endReached={() => { if (displayClips.length > 0) loadMoreBlock(); }}
      />
    </div>
  );
}

function dedupeById(arr: ClipItem[]): ClipItem[] {
  const seen = new Set<number>();
  const out: ClipItem[] = [];
  for (const c of arr) { if (seen.has(c.id)) continue; seen.add(c.id); out.push(c); }
  return out;
}
