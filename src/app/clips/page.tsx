"use client";
import { useEffect, useRef, useState, useCallback } from 'react';

type Clip = {
  id: number;
  title: string;
  description?: string;
  url: string;
  uid?: string;
  duration?: number | string;
  poster_url?: string;
  thumbnail?: string;
  created_at?: string;
};

const getUid = (clip: Clip) => {
  if (clip.uid) return clip.uid;
  const m = clip.url.match(/cloudflarestream\.com\/([a-f0-9]+)\/manifest/);
  if (m) return m[1];
  const i = clip.url.match(/iframe\.videodelivery\.net\/([a-f0-9]+)/);
  if (i) return i[1];
  return '';
};

export default function ClipsFeedPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [random, setRandom] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const userGestureRef = useRef<boolean>(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips?limit=8&offset=${offset}&random=${random}`);
      const data = await res.json();
      if (res.ok) {
        // Merge without duplicates (by id + uid)
        setClips(prev => {
          const existing = new Set(prev.map(c => `${c.id}:${getUid(c)}`));
          const incoming: Clip[] = data.clips || [];
          const merged = [...prev];
          for (const clip of incoming) {
            const key = `${clip.id}:${getUid(clip)}`;
            if (!existing.has(key)) {
              existing.add(key);
              merged.push(clip);
            }
          }
          return merged;
        });
        setOffset(data.nextOffset ?? (offset + (data.clips?.length || 0)));
        setHasMore(Boolean(data.hasMore));
        if (!data.hasMore) {
          // Endless mode: when reaching end, reset and continue fetching randomly
          setOffset(0);
          setHasMore(true);
          setRandom(true);
        }
        if ((data.clips || []).length === 0 && offset === 0) {
          setHasMore(false);
        }
        if (data.feedSource === 'videos_fallback') {
          // Visual hint that we are showing fallback content
          document.documentElement.style.setProperty('--clips-fallback-active', '1');
        } else {
          document.documentElement.style.setProperty('--clips-fallback-active', '0');
        }
      } else {
        setError(data.error || 'Failed to load clips');
      }
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, offset, random]);

  useEffect(() => {
    // Initial load and on random toggle
    setClips([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
    loadMore();
  }, [random]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadMore();
        }
      }
    }, { root: scrollerRef.current, rootMargin: '400px 0px' });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  // Compute dynamic viewport height between site nav and bottom safe area
  useEffect(() => {
    const getNavHeight = () => {
      // Try common selectors for a fixed/sticky site-wide nav/header
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        '[data-site-nav], header[role="banner"], header.site-nav, header.sticky, nav[role="navigation"], header'
      ));
      // Choose the tallest fixed/sticky/absolute element at the top
      let maxH = 0;
      for (const el of candidates) {
        const cs = window.getComputedStyle(el);
        const pos = cs.position;
        if (pos === 'fixed' || pos === 'sticky' || pos === 'absolute') {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 0 + 2) {
            maxH = Math.max(maxH, rect.height);
          }
        }
      }
      return maxH;
    };

    const updateViewportVars = () => {
      const vv = (window as any).visualViewport;
      const rawVH = vv ? vv.height : window.innerHeight;
      const navH = getNavHeight();
      const safeBottom = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')) || 0;
      const computed = Math.max(0, rawVH - navH); // we keep safe-area for padding on overlays
      setAvailableHeight(computed);
      const vw = vv ? vv.width : document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--vw', `${vw}px`);
      document.documentElement.style.setProperty('--vh', `${rawVH}px`);
      document.documentElement.style.setProperty('--nav-h', `${navH}px`);
      document.documentElement.style.setProperty('--clips-vh', `${computed}px`);
      document.documentElement.style.setProperty('--safe-bottom', `${safeBottom}px`);
    };

    updateViewportVars();
    window.addEventListener('resize', updateViewportVars);
    window.addEventListener('orientationchange', updateViewportVars);
    const vv: any = (window as any).visualViewport;
    if (vv && vv.addEventListener) vv.addEventListener('resize', updateViewportVars);
    return () => {
      window.removeEventListener('resize', updateViewportVars);
      window.removeEventListener('orientationchange', updateViewportVars);
      if (vv && vv.removeEventListener) vv.removeEventListener('resize', updateViewportVars);
    };
  }, []);

  useEffect(() => {
    // Auto play/pause visible videos within the scroller
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement;
        try {
          if (entry.isIntersecting) {
            // Keep each video in sync with global mute state
            video.muted = isMuted;
            const tryPlay = () => video.play().catch(() => {});
            if (!isMuted) tryPlay();
          } else {
            video.pause();
          }
        } catch {}
      });
    }, { threshold: 0.6, root: scrollerRef.current });
    const container = scrollerRef.current || document;
    const videos = (container instanceof Document ? container : container).querySelectorAll('video[data-clip="1"]');
    videos.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [clips, isMuted]);

  // Persist global mute state and honor mobile audio policies
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clips_isMuted');
      if (saved === 'false') setIsMuted(false);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('clips_isMuted', String(isMuted)); } catch {}
  }, [isMuted]);

  // Mark first user gesture to allow play with sound
  useEffect(() => {
    const markGesture = () => { userGestureRef.current = true; };
    window.addEventListener('touchend', markGesture, { once: true });
    window.addEventListener('click', markGesture, { once: true });
    return () => {
      window.removeEventListener('touchend', markGesture);
      window.removeEventListener('click', markGesture);
    };
  }, []);

  // Attempt to play currently visible video when tab becomes visible
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const container = scrollerRef.current || document;
      const videos = (container instanceof Document ? container : container).querySelectorAll('video[data-clip="1"]');
      let best: HTMLVideoElement | null = null;
      let bestArea = 0;
      videos.forEach(v => {
        const r = v.getBoundingClientRect();
        const vw = Math.max(0, Math.min(window.innerWidth, r.right) - Math.max(0, r.left));
        const vh = Math.max(0, Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top));
        const area = vw * vh;
        if (area > bestArea) { bestArea = area; best = v; }
      });
      if (best) {
        best.muted = isMuted;
        if (!isMuted) best.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isMuted]);

  const toggleMuteGlobal = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      const videos = document.querySelectorAll<HTMLVideoElement>('video[data-clip="1"]');
      // Apply mute state but do NOT auto-play all; only the most visible clip should play
      videos.forEach(video => {
        video.muted = next;
      });

      // Find most visible video within viewport
      let best: HTMLVideoElement | null = null;
      let bestArea = 0;
      videos.forEach(v => {
        const r = v.getBoundingClientRect();
        const vw = Math.max(0, Math.min(window.innerWidth, r.right) - Math.max(0, r.left));
        const vh = Math.max(0, Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top));
        const area = vw * vh;
        if (area > bestArea) { bestArea = area; best = v; }
      });

      if (!next && userGestureRef.current && best) {
        try { best.volume = 1; } catch {}
        best.play().catch(() => {});
      }
      return next;
    });
  }, []);

  // No mute/unmute toggle: videos served with sound by default

  return (
    <div
      className="w-screen bg-neutral-900 text-white overflow-hidden"
      style={{ height: availableHeight ? `${availableHeight}px` : undefined, marginTop: 'var(--nav-h)' }}
    >
      {/* Scroll snap container (uses dynamic viewport height between nav and bottom) */}
      <div
        ref={scrollerRef}
        className="w-screen snap-y snap-mandatory overscroll-y-contain overflow-y-auto scroll-smooth"
        style={{ height: 'var(--clips-vh)' }}
      >
        <div className="relative" style={{ height: 'var(--clips-vh)' }}>
        {clips.map((clip, index) => (
          <section
            key={`${clip.id}-${getUid(clip)}`}
            className="snap-start snap-always w-screen relative overflow-hidden"
            style={{ height: 'var(--clips-vh)' }}
          >
            {/* Video container: cover-style, centered, cropped by viewport */}
            <div
              className="bg-black"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                // Centered cover using measured viewport vars
                width: 'max(var(--vw), calc(var(--clips-vh) * 9 / 16))',
                height: 'max(var(--clips-vh), calc(var(--vw) * 16 / 9))'
              }}
            >
              <video
                data-clip="1"
                data-uid={getUid(clip)}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                loop
                muted={isMuted}
                controls={false}
                crossOrigin="anonymous"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget as HTMLVideoElement;
                  v.muted = isMuted;
                  if (!isMuted) {
                    try { v.volume = 1; } catch {}
                    v.play().catch(() => {});
                  }
                }}
                onCanPlay={(e) => {
                  const v = e.currentTarget as HTMLVideoElement;
                  if (!isMuted && userGestureRef.current) {
                    try { v.volume = 1; } catch {}
                    v.play().catch(() => {});
                  }
                }}
              >
                <source src={`https://videodelivery.net/${getUid(clip)}/manifest/video.m3u8`} type="application/x-mpegURL" />
              </video>
              {/* Tap area to toggle global sound */}
              <button
                onClick={toggleMuteGlobal}
                className="absolute inset-0 z-10"
                aria-label="Toggle sound"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              />
            </div>

            {/* Overlay UI positioned relative to section to avoid misalignment */}
            <div className="pointer-events-none absolute inset-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)', paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
              <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute right-4 flex flex-col gap-3 pointer-events-auto z-20" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}>
                <button
                  onClick={toggleMuteGlobal}
                  className="rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white w-11 h-11 grid place-items-center shadow-lg"
                  aria-label="Toggle sound"
                >
                  {/* Reflect global audio state in icon */}
                  {isMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5L6 9H3v6h3l5 4V5z" />
                      <path d="M16 8l5 5M21 8l-5 5" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5L6 9H3v6h3l5 4V5z" />
                      <path d="M15 9a3 3 0 0 1 0 6" />
                      <path d="M19 7a6 6 0 0 1 0 10" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    const uid = getUid(clip);
                    const url = `${location.origin}/clips/${uid}`;
                    navigator.clipboard?.writeText(url).catch(() => {});
                  }}
                  className="rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white w-11 h-11 grid place-items-center shadow-lg"
                  aria-label="Copy link"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.07 0l1.76-1.76a5 5 0 0 0-7.07-7.07L11 5" />
                    <path d="M14 11a5 5 0 0 0-7.07 0L5.17 12.76a5 5 0 0 0 7.07 7.07L13 19" />
                  </svg>
                </button>
                <a
                  href={`https://x.com/intent/tweet?text=${encodeURIComponent(clip.title || 'Check this clip')}&url=${encodeURIComponent(location.origin + '/clips/' + getUid(clip))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white w-11 h-11 grid place-items-center shadow-lg"
                  aria-label="Share on X"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 3h3l-7.5 9L22 21h-6l-4.5-5.7L6 21H3l8-9.6L2 3h6l4.2 5.3L18 3Z" />
                  </svg>
                </a>
              </div>
            </div>
          </section>
        ))}

        {/* Sentinel for infinite load (invisible) */}
        <div ref={sentinelRef} className="h-2 w-full" />
        </div>
      </div>
    </div>
  );
}
