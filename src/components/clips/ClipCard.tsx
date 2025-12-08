"use client";
import { useEffect, useRef, useState } from 'react';
import type { ClipItem } from '@/types/clips';
import { attachHls, type HlsHandle } from '@/lib/hlsPlayer';
import { prefetchFirstSegment } from '@/lib/hlsPrefetch';

export default function ClipCard({ clip, active, shouldPreload = false, muted, onToggleMute, onEnded, currentIndex, lastAutoScrollIndex, onAutoScroll, onAutoMute, onSyncMute, hasUserMutePref }: { clip: ClipItem; active: boolean; shouldPreload?: boolean; muted: boolean; onToggleMute: () => void; onEnded: () => void; currentIndex: number; lastAutoScrollIndex: number; onAutoScroll: (index: number) => void; onAutoMute?: () => void; onSyncMute?: (actualMuted: boolean) => void; hasUserMutePref?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<HlsHandle | null>(null);
  const loadingRef = useRef<boolean>(true);
  const userInitiatedPlayRef = useRef<boolean>(false);
  const [canPlay, setCanPlay] = useState<boolean>(false);
  const [firstFrame, setFirstFrame] = useState<boolean>(false);
  const [needUserGesture, setNeedUserGesture] = useState<boolean>(false);

  // Auto-scroll to next clip when video ends
  const handleVideoEnded = () => {
    onEnded();
    
    // If user returned to the clip that just auto-scrolled, loop it
    if (currentIndex === lastAutoScrollIndex) {
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
      return;
    }
    
    // First time ending - auto-scroll to next and track this index
    onAutoScroll(currentIndex);
    const currentSection = videoRef.current?.closest('section');
    const nextSection = currentSection?.nextElementSibling as HTMLElement;
    if (nextSection) {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isIOS = /iP(ad|hone|od)/.test(ua) || (typeof navigator !== 'undefined' && (navigator as any).platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      nextSection.scrollIntoView({ behavior: isIOS ? 'auto' : 'smooth', block: 'start' });
    }
  };

  // Manage playback lifecycle with aggressive preloading
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    let cancelled = false;
    let destroyTimer: NodeJS.Timeout | null = null;
    // Performance mark for Time-to-Play metric
    try { performance.mark('video-start'); } catch {}

    async function manageVideo() {
      // Clear any pending destroy timer
      if (destroyTimer) {
        clearTimeout(destroyTimer);
        destroyTimer = null;
      }

      // TikTok Lesson 1: Preload the next video's HLS manifest while current plays
      if (active || shouldPreload) {
        // Only attach if not already attached
        if (!hlsRef.current) {
          hlsRef.current = await attachHls(v, clip.hlsUrl, shouldPreload && !active);
        }
      }

      // TikTok Lesson 2: Playback control
      if (active) {
        v.muted = muted;
        (v as any).playsInline = true;
        v.autoplay = true;
        v.loop = false;
        v.preload = 'auto';
        
        const play = async () => {
          if (cancelled) return;
          try { await v.play(); } catch (e) {
            // Mobile autoplay fallback: force mute then retry
            // Only auto-mute if not user-initiated
            if (!userInitiatedPlayRef.current) {
              if (!muted && hasUserMutePref) {
                // User prefers sound: do NOT auto-mute; show gesture prompt instead
                setNeedUserGesture(true);
                v.pause();
              } else {
                try {
                  v.muted = true;
                  onAutoMute?.();
                  await v.play();
                } catch {}
              }
            }
          }
        };
        
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(play, { timeout: 600 });
        } else {
          setTimeout(play, 0);
        }
      } else if (!shouldPreload) {
        // TikTok Lesson 3: Lazy destruction (2s delay) for smooth back-scrolls
        v.pause();
        v.muted = true;
        v.preload = 'metadata';
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isIOS = /iP(ad|hone|od)/.test(ua) || ((navigator as any)?.platform === 'MacIntel' && (navigator as any)?.maxTouchPoints > 1);
        const isMobile = isIOS || (typeof window !== 'undefined' && window.innerWidth < 768);
        destroyTimer = setTimeout(() => {
          if (cancelled) return;
          try {
            hlsRef.current?.destroy();
            hlsRef.current = null;
            v.removeAttribute('src');
            v.load();
            setCanPlay(false);
            setFirstFrame(false);
          } catch {}
        }, isMobile ? 500 : 1000);
      } else {
        // Just preloading, keep paused but buffered
        v.pause();
        v.muted = true;
        v.preload = 'auto';
      }
    }
    
    manageVideo();
    
    return () => {
      cancelled = true;
      if (destroyTimer) clearTimeout(destroyTimer);
      // Immediate cleanup on unmount
      try {
        hlsRef.current?.destroy();
        hlsRef.current = null;
      } catch {}
    };
  }, [active, shouldPreload, clip.hlsUrl]);

  // Keep UI mute state in sync with the actual element state
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onVol = () => { onSyncMute?.(v.muted); };
    v.addEventListener('volumechange', onVol);
    // Apply current state proactively when active changes
    try { v.muted = muted; } catch {}
    return () => { v.removeEventListener('volumechange', onVol); };
  }, [muted, active]);

  // TikTok Strategy: Prefetch first video segment when shouldPreload is true
  useEffect(() => {
    if (!shouldPreload) return;
    
    // Prefetch first segment into browser cache for instant playback
    prefetchFirstSegment(clip.hlsUrl);
  }, [shouldPreload, clip.hlsUrl]);

  // Ensure poster stays until the first video frame is actually rendered
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    let rafId: number | null = null;
    let rvfcId: number | null = null;

    const markFirstFrame = () => {
      setFirstFrame(true);
    };

    const onPlaying = () => {
      // Fallback: if requestVideoFrameCallback is not available, use a rAF after playing
      if ('requestVideoFrameCallback' in (v as any)) {
        rvfcId = (v as any).requestVideoFrameCallback(() => markFirstFrame());
      } else {
        rafId = requestAnimationFrame(() => markFirstFrame());
      }
      // Performance measure for Time-to-Play
      try {
        performance.mark('video-playing');
        performance.measure('video-play', 'video-start', 'video-playing');
      } catch {}
    };

    v.addEventListener('playing', onPlaying, { once: true });
    return () => {
      v.removeEventListener('playing', onPlaying as any);
      if (rafId) cancelAnimationFrame(rafId);
      // @ts-ignore
      if (rvfcId && v.cancelVideoFrameCallback) (v as any).cancelVideoFrameCallback(rvfcId);
    };
  }, [active]);

  return (
    <div className="relative w-full h-full">
      <div className="relative w-full h-full bg-black">
        {/* TikTok-style manual poster overlay for smooth loading transition */}
        {clip.poster && (
          <img 
            src={clip.poster} 
            alt="" 
            fetchPriority="high"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 will-change-[opacity] ${firstFrame ? 'opacity-0' : 'opacity-100'}`}
          />
        )}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-200 will-change-[opacity] ${firstFrame ? 'opacity-100' : 'opacity-0'}`}
          onEnded={handleVideoEnded}
          playsInline
          muted={muted}
          autoPlay
          poster={clip.poster ?? undefined}
          onCanPlay={() => { loadingRef.current = false; setCanPlay(true); }}
        />
        {/* Overlay controls */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Bottom-left metadata */}
          <div className="absolute left-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] text-white pointer-events-auto">
            <div className="text-sm font-bold">{clip.title}</div>
            <div className="text-xs text-white/80">{clip.artist}</div>
          </div>
          {/* Right-side actions */}
          <div className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+6rem)] flex flex-col gap-3 pointer-events-auto items-center">
            <button
              onClick={() => {
                const v = videoRef.current;
                userInitiatedPlayRef.current = true;
                try {
                  if (v) {
                    v.muted = !muted;
                    onSyncMute?.(v.muted);
                    // Attempt play with user gesture; should succeed without auto-mute fallback
                    v.play().catch(() => {});
                  }
                } finally {
                  onToggleMute();
                  // Reset flag shortly after to avoid impacting normal autoplay logic
                  setTimeout(() => { userInitiatedPlayRef.current = false; }, 300);
                }
              }}
              className="p-2 rounded-full bg-white/10 border border-white/20 text-white"
            >
              {muted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            {clip.productHandle && (
              <a 
                href={`/store/products/${clip.productHandle}`}
                className="p-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                title="View Product"
              >
                {/* Long Sleeve Shirt Icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23L4.5 14.5a2 2 0 0 0 2 1.5h.5v6c0 1.1.9 2 2 2h6a2 2 0 0 0 2-2v-6h.5a2 2 0 0 0 2-1.5l2.22-8.81a2 2 0 0 0-1.34-2.23z" />
                </svg>
              </a>
            )}
            <button onClick={() => shareClip(clip)} className="p-2 rounded-full bg-white/10 border border-white/20 text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4m0 0L8 6m4-4v12" /></svg>
            </button>
            {needUserGesture && (
              <button
                onClick={() => {
                  const v = videoRef.current;
                  userInitiatedPlayRef.current = true;
                  try { if (v) v.play().catch(() => {}); } finally {
                    setNeedUserGesture(false);
                    setTimeout(() => { userInitiatedPlayRef.current = false; }, 300);
                  }
                }}
                className="px-3 py-1 rounded-full bg-green-600/80 text-white text-xs border border-white/20"
                title="Tap to play with sound"
              >
                Play with sound
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

async function shareClip(clip: ClipItem) {
  const url = typeof window !== 'undefined' ? window.location.origin + `/clips?clip=${clip.id}` : '';
  try {
    if (navigator.share) {
      await navigator.share({ title: clip.title, text: `${clip.title} • ${clip.artist}`, url });
      return;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(url);
    // no toast to keep minimal; could integrate app toast later
  } catch {}
}
