"use client";
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ClipsFeed from '@/components/clips/ClipsFeed';
import dynamic from 'next/dynamic';
import PerformanceDebugger from '@/components/clips/PerformanceDebugger';

// Virtualized feed is currently disabled; focus on standard feed
// const VirtuosoFeed = dynamic(() => import('@/components/clips/VirtuosoFeed'), { ssr: false });

export default function ClipsPage() {
  const params = useSearchParams();
  const useVirtual = false; // force standard feed
  const debug = params?.get('debug') || '';
  // Read app nav height from CSS var if available
  const [navHeight, setNavHeight] = useState<number>(0);
  useEffect(() => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--app-nav-height');
      const px = parseInt(v || '0', 10);
      setNavHeight(Number.isFinite(px) ? px : 0);
    } catch {}
    // Lock body scroll while feed is active
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // Register Service Worker for HLS caching (TikTok-style instant repeat views)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/clips-sw.js').then(reg => {
        console.log('[Clips] Service Worker registered for HLS caching');
      }).catch(err => {
        console.warn('[Clips] Service Worker registration failed:', err);
      });
    }
    
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="bg-gradient-to-b from-[#171616] via-[#1b1a19] to-[#171616]">
      {/* Fullscreen fixed viewport to avoid browser UI compromising layout */}
      <div
        style={{ position: 'fixed', top: navHeight, left: 0, right: 0, bottom: 0, backgroundColor: '#000', overflow: 'hidden' }}
        className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <ClipsFeed navHeight={navHeight} />
        {(debug === '1' || debug === 'clips') && <PerformanceDebugger />}
      </div>
    </div>
  );
}
