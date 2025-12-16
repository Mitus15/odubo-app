"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ClipItem, ClipApiRow } from '@/types/clips';
import { mapClipRows } from '@/lib/clipsMapper';
import { shuffleArray } from '@/lib/utils';
import { addPrefetchHints, removePrefetchHints, prefetchFirstSegment, prefetchManifest } from '@/lib/hlsPrefetch';
import ClipCard from '@/components/clips/ClipCard';
import { useAudio } from '@/contexts/AudioContext';

const PAGE_SIZE = 8;

export default function ClipsFeed({ navHeight }: { navHeight: number }) {
  const { isMuted, toggleMute } = useAudio();
  const [baseClips, setBaseClips] = useState<ClipItem[]>([]);
  const [displayClips, setDisplayClips] = useState<Array<ClipItem & { uniqueKey: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [hasUserMutePref, setHasUserMutePref] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [lastAutoScrollIndex, setLastAutoScrollIndex] = useState<number>(-1);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [showVolumeIcon, setShowVolumeIcon] = useState<boolean>(false);
  const volumeIconTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inflightRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const seedRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const keyCounterRef = useRef<number>(0);
  const deckRef = useRef<ClipItem[]>([]);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const prevBaseClipsRef = useRef<ClipItem[]>([]);
    const loggedIdsRef = useRef<Set<number>>(new Set());
  const isScrollingRef = useRef<boolean>(false);
  const scrollTimerRef = useRef<number | null>(null);
  const pendingActiveKeyRef = useRef<string | null>(null);
  const switchTimerRef = useRef<number | null>(null);
  const initializedRef = useRef<boolean>(false);
  const soundArmedRef = useRef<boolean>(false);

  // Check if user has explicitly set a mute preference
  useEffect(() => {
    setIsMounted(true);
    try {
      const v = localStorage.getItem('clips:isMuted');
      if (v != null) {
        setHasUserMutePref(true);
      }
    } catch {}
  }, []);

  const fetchPage = useCallback(async (p: number): Promise<boolean | void> => {
    if (inflightRef.current > 0) return false;
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
        return await fetch(url.toString(), { 
          headers: { 'Accept': 'application/json' }, 
          signal: ctrl.signal, 
          cache: 'no-store' as any 
        });
      } catch (e: any) {
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
      setBaseClips(prev => p === 0 ? mapped : dedupeById(prev.concat(mapped)));
      
      setHasMore(mapped.length > 0);
      return mapped.length > 0;
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || String(e));
      return false;
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

  // Eagerly load all pages once to build a full first-cycle deck (avoid early repeats)
  useEffect(() => {
    let cancelled = false;
    // Only start after first page has populated something or hasMore flipped false
    if (baseClips.length === 0 && hasMore) return;
    (async () => {
      let pageToFetch = 1;
      let more = hasMore;
      while (!cancelled && more) {
        const got = await fetchPage(pageToFetch);
        more = !!got;
        pageToFetch += 1;
      }
    })();
    return () => { cancelled = true; };
  }, [baseClips.length, hasMore, fetchPage]);

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

  const buildFairDeck = useCallback((clips: ClipItem[], exclude: Set<number>) => {
    // Bucket by parentId; unknown parent gets its own bucket per clip
    const buckets = new Map<string, ClipItem[]>();
    for (const c of clips) {
      if (exclude.has(c.id)) continue;
      const key = c.parentId != null ? `p:${c.parentId}` : `u:${c.id}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(c);
    }
    // Shuffle within each bucket to avoid ordering bias
    for (const [k, arr] of buckets.entries()) {
      buckets.set(k, shuffleArray(arr));
    }
    const deck: ClipItem[] = [];
    while (buckets.size > 0) {
      const keys = shuffleArray(Array.from(buckets.keys()));
      for (const key of keys) {
        const bucket = buckets.get(key);
        if (!bucket || bucket.length === 0) {
          buckets.delete(key);
          continue;
        }
        const clip = bucket.shift()!;
        deck.push(clip);
        if (bucket.length === 0) buckets.delete(key);
      }
    }
    return deck;
  }, []);

  const appendFromDeck = useCallback((count: number, resetDisplay = false) => {
    const ensureQueue = () => {
      if (deckRef.current.length === 0) {
        deckRef.current = buildFairDeck(baseClips, seenIdsRef.current);
        // If still empty but more pages exist, fetch and wait
        if (deckRef.current.length === 0 && hasMore) {
          setPage(p => {
            const np = p + 1;
            fetchPage(np);
            return np;
          });
        }
        // If no more pages and nothing left unseen, start a new cycle
        if (deckRef.current.length === 0 && !hasMore) {
          seenIdsRef.current.clear();
          deckRef.current = buildFairDeck(baseClips, seenIdsRef.current);
        }
      }
    };

    ensureQueue();
    const out: Array<ClipItem & { uniqueKey: string }> = [];

    for (let i = 0; i < count; i++) {
      if (!deckRef.current.length) break;
      const clip = deckRef.current.shift()!;
      seenIdsRef.current.add(clip.id);
      const uniqueKey = `${keyCounterRef.current++}-${clip.id}-${seedRef.current}`;
      out.push({ ...clip, uniqueKey });

      if (!deckRef.current.length && hasMore) {
        // fetch more before continuing; stop filling this batch
        setPage(p => {
          const np = p + 1;
          fetchPage(np);
          return np;
        });
        break;
      }

      if (!deckRef.current.length && !hasMore) {
        // Cycle complete: rebuild fresh deck for next batch if needed
        deckRef.current = buildFairDeck(baseClips, seenIdsRef.current);
      }
    }

    if (!out.length) return;
    setDisplayClips(prev => resetDisplay ? out : [...prev, ...out]);
    if (resetDisplay && out[0]) {
      setActiveId(out[0].id);
    }
  }, [baseClips, buildFairDeck, fetchPage, hasMore]);

  // Append new block when reaching the end
  const handleLoadMore = useCallback(() => {
    if (!baseClips.length) return;
    appendFromDeck(PAGE_SIZE);

    // Prefetch more data if we're near the deck end and server has more
    const remaining = deckRef.current.length;
    if (hasMore && remaining <= PAGE_SIZE) {
      setPage(p => {
        const np = p + 1;
        fetchPage(np);
        return np;
      });
    }
  }, [appendFromDeck, baseClips.length, hasMore, fetchPage]);

  // Rebuild deck when base clips change
  useEffect(() => {
    if (!baseClips.length) return;

    const prev = prevBaseClipsRef.current;
    const prevIds = new Set(prev.map(c => c.id));
    const queuedIds = new Set(deckRef.current.map(c => c.id));
    const newClips = baseClips.filter(c => !prevIds.has(c.id) && !queuedIds.has(c.id));
    if (newClips.length) {
      const shuffled = shuffleArray(dedupeById(newClips));
      deckRef.current.push(...shuffled);
    }
    prevBaseClipsRef.current = baseClips;

    if (!initializedRef.current) {
      appendFromDeck(PAGE_SIZE, true);
      initializedRef.current = true;
    }
  }, [appendFromDeck, baseClips]);

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

  // Debug: log first-time activations to server (enable with NEXT_PUBLIC_CLIP_DEBUG=1 or localStorage clips:debug=1)
  useEffect(() => {
    const debugFlag = process.env.NEXT_PUBLIC_CLIP_DEBUG === '1' || (() => {
      try { return localStorage.getItem('clips:debug') === '1'; } catch { return false; }
    })();
    if (!debugFlag) return;
    if (activeId == null) return;
    if (loggedIdsRef.current.has(activeId)) return;
    const clip = displayClips.find(c => c.id === activeId);
    if (!clip) return;
    loggedIdsRef.current.add(activeId);
    fetch('/api/clip-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: clip.id,
        title: clip.title,
        parentId: clip.parentId ?? null,
        createdAt: clip.createdAt ?? null,
        productHandle: clip.productHandle ?? null,
      }),
    }).catch(() => {});
  }, [activeId, displayClips]);

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

  const handleToggleMute = () => {
    toggleMute();
    setHasUserMutePref(true);
    soundArmedRef.current = true;
    try { sessionStorage.setItem('clips:soundArmed', 'true'); } catch {}
    
    // Flash the volume icon with graceful animation
    setShowVolumeIcon(true);
    if (volumeIconTimerRef.current) {
      window.clearTimeout(volumeIconTimerRef.current);
    }
    volumeIconTimerRef.current = window.setTimeout(() => {
      setShowVolumeIcon(false);
    }, 1200) as unknown as number;
    
    // Ensure active video reflects change immediately
    const v = rootRef.current?.querySelector('section[data-active="1"] video') as HTMLVideoElement | null;
    if (v) { try { v.muted = !isMuted; v.play().catch(() => {}); } catch {} }
  };

  return (
    <>
      <style jsx>{`
        .icon-glow::before {
          content: '';
          position: absolute;
          inset: -14px;
          border-radius: 9999px;
          background: radial-gradient(closest-side, rgba(255,255,255,0.22), rgba(255,255,255,0.0));
          filter: blur(6px);
        }
      `}</style>
      <div
        ref={rootRef}
        className="overflow-y-auto h-full relative"
      style={{ 
        scrollSnapType: 'y mandatory', 
        WebkitOverflowScrolling: 'touch', 
        overscrollBehavior: 'contain', 
        scrollPaddingTop: '0px', 
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
      {/* Volume state flash indicator - mobile-friendly, springy and subtle */}
      <AnimatePresence>
        {isMounted && showVolumeIcon && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <motion.div
              initial={{ filter: 'blur(2px)' }}
              animate={{ filter: 'blur(0px)' }}
              exit={{ filter: 'blur(2px)' }}
              transition={{ duration: 0.25 }}
              className="relative p-4 rounded-full bg-black/55 backdrop-blur-md border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.55)] icon-glow"
            >
              {isMuted ? (
                <motion.svg
                  key="muted"
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  initial={{ rotate: -8 }}
                  animate={{ rotate: 0 }}
                  exit={{ rotate: 6 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </motion.svg>
              ) : (
                <motion.svg
                  key="unmuted"
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  initial={{ rotate: 8 }}
                  animate={{ rotate: 0 }}
                  exit={{ rotate: -6 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </motion.svg>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {loading && displayClips.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3 text-white/60">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <p className="text-sm">Loading clips...</p>
          </div>
        </div>
      )}
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
            onClick={handleToggleMute}
          >
            {isNearActive ? (
              <ClipCard 
                clip={clip} 
                active={activeId === clip.id}
                shouldPreload={shouldPreload}
                muted={isMuted} 
                onAutoMute={() => { 
                  if (!hasUserMutePref) { 
                    toggleMute(); 
                    try { sessionStorage.setItem('clips:soundArmed', 'true'); } catch {}
                  } 
                }}
                onSyncMute={(actual) => { 
                  if (actual !== isMuted && !hasUserMutePref) { 
                    toggleMute(); 
                  } 
                }}
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
    </>
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
