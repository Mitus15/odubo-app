"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipItem, ClipApiRow } from '@/types/clips';
import { mapClipRows } from '@/lib/clipsMapper';
import { shuffleArray } from '@/lib/utils';
import { addPrefetchHints, removePrefetchHints } from '@/lib/hlsPrefetch';
import ClipCard from '@/components/clips/ClipCard';

const PAGE_SIZE = 8;

export default function ClipsFeed({ navHeight }: { navHeight: number }) {
  const [baseClips, setBaseClips] = useState<ClipItem[]>([]);
  const [displayClips, setDisplayClips] = useState<Array<ClipItem & { uniqueKey: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inflightRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const seedRef = useRef<string>(Math.random().toString(36).substring(2, 9));

  // Persist mute
  useEffect(() => {
    try { const v = localStorage.getItem('clips:isMuted'); if (v != null) setIsMuted(v === 'true'); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('clips:isMuted', String(isMuted)); } catch {} }, [isMuted]);

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
        
        if (Number.isFinite(id)) {
          setActiveId(id);
          if (Number.isFinite(index)) setActiveIndex(index);
          if (keyAttr) handleClipEnter(keyAttr);
        }
      }
    }, { 
      root, 
      threshold: [0.7, 0.85, 0.95], 
      rootMargin: `-${navHeight}px 0px 0px 0px` 
    });
    
    items.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [displayClips, navHeight, handleClipEnter]);

  // TikTok Strategy: Prefetch next 2-3 clips using browser link hints
  useEffect(() => {
    if (!displayClips.length || activeIndex < 0) return;
    
    // Get next 2 clips to prefetch
    const nextClips = displayClips.slice(activeIndex + 1, activeIndex + 3);
    const hlsUrls = nextClips.map(clip => clip.hlsUrl).filter(Boolean);
    
    if (hlsUrls.length > 0) {
      addPrefetchHints(hlsUrls);
    }
    
    // Cleanup is handled by addPrefetchHints (removes old hints automatically)
  }, [activeIndex, displayClips]);

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
    >
      {displayClips.map((clip, index) => {
        // TikTok-style windowing: only render heavy components for active ± 2 clips
        const isNearActive = Math.abs(activeIndex - index) <= 2;
        // Aggressive preloading: buffer the next video while current plays
        const shouldPreload = index === activeIndex + 1;
        
        return (
          <section
            key={clip.uniqueKey}
            data-clip-key={clip.uniqueKey}
            data-clip-id={String(clip.id)}
            data-clip-index={String(index)}
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
                onToggleMute={() => setIsMuted(m => !m)} 
                onEnded={handleLoadMore}
              />
            ) : (
              // Lightweight placeholder maintains scroll height without memory overhead
              <div className="w-full h-full bg-black flex items-center justify-center">
                <img 
                  src={clip.poster ?? undefined} 
                  alt="" 
                  className="w-full h-full object-cover opacity-40 blur-sm"
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
