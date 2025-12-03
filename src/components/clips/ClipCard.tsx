"use client";
import { useEffect, useRef, useState } from 'react';
import type { ClipItem } from '@/types/clips';
import { attachHls, type HlsHandle } from '@/lib/hlsPlayer';
import { prefetchFirstSegment } from '@/lib/hlsPrefetch';

export default function ClipCard({ clip, active, shouldPreload = false, muted, onToggleMute, onEnded }: { clip: ClipItem; active: boolean; shouldPreload?: boolean; muted: boolean; onToggleMute: () => void; onEnded: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<HlsHandle | null>(null);
  const loadingRef = useRef<boolean>(true);
  const [ready, setReady] = useState<boolean>(false);

  // Manage playback lifecycle with aggressive preloading
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    let cancelled = false;
    let destroyTimer: NodeJS.Timeout | null = null;

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
        
        const play = async () => {
          if (cancelled) return;
          try { await v.play(); } catch {}
        };
        
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(play, { timeout: 600 });
        } else {
          setTimeout(play, 0);
        }
      } else if (!shouldPreload) {
        // TikTok Lesson 3: Lazy destruction (2s delay) for smooth back-scrolls
        v.pause();
        destroyTimer = setTimeout(() => {
          if (cancelled) return;
          try {
            hlsRef.current?.destroy();
            hlsRef.current = null;
            v.removeAttribute('src');
            v.load();
            setReady(false);
          } catch {}
        }, 2000);
      } else {
        // Just preloading, keep paused but buffered
        v.pause();
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
  }, [active, shouldPreload, clip.hlsUrl, muted]);

  // TikTok Strategy: Prefetch first video segment when shouldPreload is true
  useEffect(() => {
    if (!shouldPreload) return;
    
    // Prefetch first segment into browser cache for instant playback
    prefetchFirstSegment(clip.hlsUrl);
  }, [shouldPreload, clip.hlsUrl]);

  return (
    <div className="relative w-full h-full">
      <div className="relative w-full h-full bg-black">
        {/* TikTok-style manual poster overlay for smooth loading transition */}
        {clip.poster && (
          <img 
            src={clip.poster} 
            alt="" 
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${ready ? 'opacity-0' : 'opacity-100'}`}
          />
        )}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
          onEnded={onEnded}
          playsInline
          muted={muted}
          autoPlay
          onCanPlay={() => { loadingRef.current = false; setReady(true); }}
        />
        {/* Overlay controls */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Bottom-left metadata */}
          <div className="absolute left-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] p-2 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white pointer-events-auto">
            <div className="text-sm font-bold">{clip.title}</div>
            <div className="text-xs text-white/80">{clip.artist}</div>
          </div>
          {/* Right-side actions */}
          <div className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+6rem)] flex flex-col gap-3 pointer-events-auto">
            <button onClick={onToggleMute} className="p-2 rounded-full bg-white/10 border border-white/20 text-white">
              {muted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6M15 9l-6 6M11 5l-4 4H5v6h2l4 4V5z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5l-4 4H5v6h2l4 4V5z" /><path d="M15 12a3 3 0 000-6M19 12a7 7 0 000-14" /></svg>
              )}
            </button>
            <button onClick={() => shareClip(clip)} className="p-2 rounded-full bg-white/10 border border-white/20 text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4m0 0L8 6m4-4v12" /></svg>
            </button>
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
