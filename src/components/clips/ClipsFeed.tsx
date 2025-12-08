"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipItem, ClipApiRow } from '@/types/clips';
import { mapClipRows } from '@/lib/clipsMapper';
import { shuffleArray } from '@/lib/utils';
import { addPrefetchHints, removePrefetchHints, prefetchFirstSegment, prefetchManifest } from '@/lib/hlsPrefetch';
import ClipCard from '@/components/clips/ClipCard';

const PAGE_SIZE = 8;

export default function ClipsFeed({ navHeight }: { navHeight: number }) {
  const [baseClips, setBaseClips] = useState<ClipItem[]>([]);
  const [displayClips, setDisplayClips] = useState<Array<ClipItem & { uniqueKey: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [hasUserMutePref, setHasUserMutePref] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [lastAutoScrollIndex, setLastAutoScrollIndex] = useState<number>(-1);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inflightRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const seedRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const isScrollingRef = useRef<boolean>(false);
  const scrollTimerRef = useRef<number | null>(null);
  const pendingActiveKeyRef = useRef<string | null>(null);
  const switchTimerRef = useRef<number | null>(null);
  const initializedRef = useRef<boolean>(false);
  const soundArmedRef = useRef<boolean>(false);

  // Persist mute
  useEffect(() => {
    try {
      const v = localStorage.getItem('clips:isMuted');
      if (v != null) {
        setIsMuted(v === 'true');
        setHasUserMutePref(true);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('clips:isMuted', String(isMuted));
      if (!hasUserMutePref) {
        // Persist that a preference exists once user changes it
        // We also flip this when user explicitly toggles
      }
    } catch {}
  }, [isMuted, hasUserMutePref]);

  const fetchPage = useCallback(async (p: number) => {
    if (inflightRef.current > 0) return;
    inflightRef.current++;
    setLoading(true); setError('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    
    const retry = async (attempt = 0): Promise<Response> => {
      try {
        const url = new URL('/api/clips', window.location.origin);
        url.searchParams.set('limit', String(PAGE_SIZE));
        url.searchParams.set('offset', String(p * PAGE_SIZE));
        url.searchParams.set('random', 'true');
        return await fetch(url.toString(), { 
          headers: { 'Accept': 'application/json' }, 
          signal: ctrl.signal, 
          cache: 'no-store' as any 
        });
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
        // Initialize display clips with first shuffled block
        if (p === 0 && combined.length > 0) {
          const shuffled = shuffleArray(combined);
          setDisplayClips(shuffled.map((clip, idx) => ({
            ...clip,
            uniqueKey: `${idx}-${clip.id}-${seedRef.current}`
          })));
          // Force-initialize active on first item to avoid waiting for IO
          if (!initializedRef.current) {
            initializedRef.current = true;
            setActiveIndex(0);
            setActiveId(shuffled[0].id);
          }
        }
        return combined;
      });
      
      setHasMore(mapped.length > 0);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || String(e));
    } finally {
      inflightRef.current--;
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchPage(0); 
    return () => {
      abortRef.current?.abort();
      removePrefetchHints(); // Cleanup prefetch hints on unmount
    };
  }, [fetchPage]);

  useEffect(() => {
    try { soundArmedRef.current = sessionStorage.getItem('clips:soundArmed') === 'true'; } catch {}
  }, []);

  // Track scroll state to suppress heavy work during fast scrolls
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const onScroll = () => {
      isScrollingRef.current = true;
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(() => { isScrollingRef.current = false; }, 120) as unknown as number;
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll as any);
  }, []);

  // Append new shuffled block when reaching the end
  const handleLoadMore = useCallback(() => {
    if (!baseClips.length) return;
    
    const shuffled = shuffleArray(baseClips);
    const newBlock = shuffled.map((clip, idx) => ({
      ...clip,
      uniqueKey: `${displayClips.length + idx}-${clip.id}-${seedRef.current}`
    }));
    
    setDisplayClips(prev => [...prev, ...newBlock]);
    
    // Fetch more data from API if available
    if (hasMore) {
      setPage(p => {
        const np = p + 1;
        fetchPage(np);
        return np;
      });
    }
  }, [baseClips, displayClips.length, hasMore, fetchPage]);

  // Detect when active clip is near the end
  const handleClipEnter = useCallback((uniqueKey: string) => {
    if (!displayClips.length) return;
    
    const lastClip = displayClips[displayClips.length - 1];
    const secondToLastClip = displayClips[displayClips.length - 2];
    
    // Trigger load more when we reach second-to-last clip
    if (secondToLastClip && uniqueKey === secondToLastClip.uniqueKey) {
      handleLoadMore();
    }
  }, [displayClips, handleLoadMore]);

  // Active card observer
  useEffect(() => {
    if (!rootRef.current) return;
    const root = rootRef.current;
    const items = Array.from(root.querySelectorAll('[data-clip-key]')) as HTMLElement[];
    
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length === 0) return;
      
      visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const topEntry = visible[0];
      
      if (topEntry) {
        const keyAttr = (topEntry.target as HTMLElement).dataset.clipKey;
        const idAttr = (topEntry.target as HTMLElement).dataset.clipId;
        const indexAttr = (topEntry.target as HTMLElement).dataset.clipIndex;
        const id = idAttr ? parseInt(idAttr, 10) : NaN;
        const index = indexAttr ? parseInt(indexAttr, 10) : NaN;
        // Debounce active switching to reduce thrash
        if (Number.isFinite(id)) {
          if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
          pendingActiveKeyRef.current = keyAttr || null;
          switchTimerRef.current = window.setTimeout(() => {
            setActiveId(id);
            if (Number.isFinite(index)) setActiveIndex(index);
            if (keyAttr) handleClipEnter(keyAttr);
          }, 80) as unknown as number;
        }
      }
    }, { 
      root, 
      threshold: [0.5, 0.75, 0.95], 
      rootMargin: `-${navHeight}px 0px 0px 0px` 
    });
    
    items.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [displayClips, navHeight, handleClipEnter]);

  // TikTok Strategy: Prefetch next 2-3 clips using browser link hints
  useEffect(() => {
    if (!displayClips.length || activeIndex < 0) return;
    if (isScrollingRef.current) return; // suppress during fast scroll
    
    // Network-aware policy
    const conn: any = (typeof navigator !== 'undefined' && (navigator as any).connection) || null;
    const saveData = !!conn?.saveData;
    const effectiveType = conn?.effectiveType || '4g';
    const downlink = typeof conn?.downlink === 'number' ? conn.downlink : 10;
    const goodNetwork = !saveData && effectiveType === '4g' && downlink >= 4;

    // Prefetch window: next 2 on good network, next 1 otherwise (manifest only)
    const prefetchCount = goodNetwork ? 2 : 1;
    const nextClips = displayClips.slice(activeIndex + 1, activeIndex + 1 + prefetchCount);
    const hlsUrls = nextClips.map(clip => clip.hlsUrl).filter(Boolean);

    if (hlsUrls.length > 0) {
      // Always add prefetch hints for manifests
      addPrefetchHints(hlsUrls);
      // Also explicitly fetch manifest to warm SW cache (best-effort)
      hlsUrls.forEach(u => prefetchManifest(u));
    }

    // For the immediate next clip, prefetch first segment only on good networks
    const next = displayClips[activeIndex + 1];
    if (goodNetwork && next?.hlsUrl) {
      prefetchFirstSegment(next.hlsUrl);
    }
    
    // Cleanup is handled by addPrefetchHints (removes old hints automatically)
  }, [activeIndex, displayClips]);

  // Enforce single active playback; apply global mute only to the active video
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const videos = Array.from(root.querySelectorAll('section video')) as HTMLVideoElement[];
    videos.forEach(v => {
      const section = v.closest('section');
      const isActive = section?.getAttribute('data-active') === '1';
      try {
        if (isActive) {
          // Apply current global mute preference to the active video only
          v.muted = isMuted;
          if (isMuted) {
            v.play().catch(() => {});
          } else {
            if (soundArmedRef.current) v.play().catch(() => {});
          }
        } else {
          v.pause();
        }
      } catch {}
    });
  }, [activeId, isMuted]);

  // Pause/resume active video on tab visibility changes to save CPU/bandwidth
  useEffect(() => {
    const onVis = () => {
      const root = rootRef.current; if (!root) return;
      const v = root.querySelector('section[data-active="1"] video') as HTMLVideoElement | null;
      if (!v) return;
      if (document.hidden) {
        try { v.pause(); } catch {}
      } else {
        // Only attempt autoplay on resume if currently muted; otherwise wait for gesture
        if (v.muted) {
          v.play().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <div
      ref={rootRef}
      className="overflow-y-auto h-full"
      style={{ 
        scrollSnapType: 'y mandatory', 
        WebkitOverflowScrolling: 'touch', 
        overscrollBehavior: 'contain', 
        scrollPaddingTop: `${navHeight}px`, 
        scrollPaddingBottom: 'env(safe-area-inset-bottom)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
      onClick={() => {
        if (!soundArmedRef.current) {
          soundArmedRef.current = true;
          try { sessionStorage.setItem('clips:soundArmed', 'true'); } catch {}
          const root = rootRef.current; if (!root) return;
          const v = root.querySelector('section[data-active="1"] video') as HTMLVideoElement | null;
          if (v) { try { v.muted = isMuted; v.play().catch(() => {}); } catch {} }
        }
      }}
    >
      {displayClips.map((clip, index) => {
        // Network-aware windowing: shrink on weak networks
        const conn: any = (typeof navigator !== 'undefined' && (navigator as any).connection) || null;
        const saveData = !!conn?.saveData;
        const effectiveType = conn?.effectiveType || '4g';
        const downlink = typeof conn?.downlink === 'number' ? conn.downlink : 10;
        const goodNetwork = !saveData && effectiveType === '4g' && downlink >= 4;
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isIOS = /iP(ad|hone|od)/.test(ua) || (typeof navigator !== 'undefined' && (navigator as any).platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
        const isMobile = isIOS || (typeof window !== 'undefined' && window.innerWidth < 768);
        const windowRadius = isMobile ? 1 : (goodNetwork ? 2 : 1);
        const isNearActive = Math.abs(activeIndex - index) <= windowRadius;
        // Aggressive preloading: buffer the next video while current plays
        const shouldPreload = index === activeIndex + 1;
        
        return (
          <section
            key={clip.uniqueKey}
            data-clip-key={clip.uniqueKey}
            data-clip-id={String(clip.id)}
            data-clip-index={String(index)}
            data-active={activeId === clip.id ? '1' : '0'}
            className="flex items-center justify-center"
            style={{ 
              height: `calc(100svh - ${navHeight}px)`, 
              scrollSnapAlign: 'start', 
              scrollSnapStop: 'always' 
            }}
          >
            {isNearActive ? (
              <ClipCard 
                clip={clip} 
                active={activeId === clip.id}
                shouldPreload={shouldPreload}
                muted={isMuted} 
                onToggleMute={() => { setIsMuted(m => !m); setHasUserMutePref(true); try { localStorage.setItem('clips:isMuted', String(!isMuted)); } catch {} }} 
                onAutoMute={() => { if (!hasUserMutePref) { setIsMuted(true); try { localStorage.setItem('clips:isMuted', 'true'); } catch {} } }}
                onSyncMute={(actual) => { if (actual !== isMuted) { setIsMuted(actual); if (!hasUserMutePref) try { localStorage.setItem('clips:isMuted', String(actual)); } catch {} } }}
                hasUserMutePref={hasUserMutePref}
                onEnded={handleLoadMore}
                currentIndex={index}
                lastAutoScrollIndex={lastAutoScrollIndex}
                onAutoScroll={(idx) => setLastAutoScrollIndex(idx)}
              />
            ) : (
              // Lightweight placeholder maintains scroll height without memory overhead
              <div className="w-full h-full bg-black flex items-center justify-center" style={{ contentVisibility: 'auto', containIntrinsicSize: `calc(100svh - ${navHeight}px) 100vw` }}>
                <img 
                  src={clip.poster ?? undefined} 
                  alt="" 
                  className="w-full h-full object-cover opacity-40"
                  fetchPriority="low"
                  loading="lazy"
                />
              </div>
            )}
          </section>
        );
      })}

      {error && (
        <div className="mx-auto max-w-md my-4 p-3 rounded-xl border border-red-700/60 bg-red-900/30 text-red-200 text-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
}

function dedupeById(arr: ClipItem[]): ClipItem[] {
  const seen = new Set<number>();
  const out: ClipItem[] = [];
  for (const c of arr) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}
