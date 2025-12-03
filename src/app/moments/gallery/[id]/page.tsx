"use client";
import { useEffect, useMemo, useState, useRef, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { Variants, Transition } from 'framer-motion';

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const springTransition: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 15
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: springTransition
  }
};

// Skeleton loader component
function PhotoSkeleton() {
  return (
    <div className="animate-pulse rounded-xl overflow-hidden bg-[#1f1e1d] border border-[#3b3733]">
      <div className="aspect-square bg-gradient-to-br from-[#2a2626] to-[#1f1e1d]" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-[#3b3733] rounded w-3/4" />
        <div className="h-2 bg-[#3b3733] rounded w-1/2" />
      </div>
    </div>
  );
}

export default function GalleryViewer({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const sp = useSearchParams();
  const codeFromUrl = sp?.get('code') || '';
  const [code, setCode] = useState<string>(codeFromUrl);
  const [photos, setPhotos] = useState<Array<any>>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [galleryInfo, setGalleryInfo] = useState<{title?: string; description?: string} | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const viewerContentRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reduceMotion = useReducedMotion();
  const [emptyReady, setEmptyReady] = useState(false);

  const canFetch = useMemo(() => Number.isFinite(id), [id]);

  async function fetchPhotos() {
    if (!canFetch) return;
    setLoading(true);
    setError('');
    try {
      // Cancel any in-flight request to avoid race conditions
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      // Fetch gallery info
      const infoRes = await fetch(`/api/moments/galleries/${id}` , { signal: ac.signal });
      if (infoRes.ok) {
        const infoData: any = await infoRes.json().catch(() => ({}));
        if (infoData?.gallery) {
          setGalleryInfo({
            title: infoData.gallery.title,
            description: infoData.gallery.description
          });
        }
      }

      // Fetch photos
      const url = new URL('/api/moments/list', window.location.origin);
      url.searchParams.set('galleryId', String(id));
      if (code) url.searchParams.set('code', code);
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString(), { signal: ac.signal, headers: { 'Accept': 'application/json' } });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load photos');
      // Client-side safety: hide rejected if server ever returns them to public views
      const list = Array.isArray(data?.photos) ? data.photos : [];
      const filtered = list.filter((p: any) => p.moderated !== 2);
      setPhotos(filtered);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canFetch) fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch]);

  // Auto-refresh while tab is visible - reduced from 12s to 30s for better performance
  useEffect(() => {
    if (!canFetch) return;
    let timer: any;
    let cancelled = false;
    function onVisibility() {
      if (document.hidden) return;
      fetchPhotos();
    }
    // Increased interval from 12s to 30s to reduce server load
    function start() {
      clearInterval(timer);
      timer = setInterval(() => {
        if (!document.hidden) fetchPhotos();
      }, 30000); // Changed from 12000 to 30000
    }
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, id, code]);

  function openAt(i: number) {
    setIndex(i);
    setViewerOpen(true);
  }

  function prev() { setIndex(i => (i - 1 + photos.length) % photos.length); }
  function next() { setIndex(i => (i + 1) % photos.length); }

  // Swipe handling and keyboard navigation
  useEffect(() => {
    if (!viewerOpen) return;
    
    let startX = 0; let dx = 0;
    function onTouchStart(e: TouchEvent) { startX = e.changedTouches[0].clientX; }
    function onTouchEnd(e: TouchEvent) {
      dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') setViewerOpen(false);
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('touchstart', onTouchStart as any);
      document.removeEventListener('touchend', onTouchEnd as any);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [viewerOpen, photos.length]);

  // Lock body scroll and focus close button when viewer opens
  useEffect(() => {
    if (viewerOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // focus close button on open for accessibility
      setTimeout(() => closeBtnRef.current?.focus(), 0);
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [viewerOpen]);

  // Prefetch adjacent images for smoother navigation
  const nextIdx = (index + 1) % Math.max(photos.length, 1);
  const prevIdx = (index - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1);

  // Debounce empty state so it never flashes during brief loads
  useEffect(() => {
    let t: any;
    if (loading) {
      setEmptyReady(false);
    } else if (!loading && photos.length === 0) {
      t = setTimeout(() => setEmptyReady(true), 3000);
    } else {
      setEmptyReady(false);
    }
    return () => { if (t) clearTimeout(t); };
  }, [loading, photos.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0908] via-[#171616] to-[#0a0908]">
      {/* Header with back button */}
      <header className="sticky top-0 z-40 bg-[#141312]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-[#262321]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/moments"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1f1e1d] border border-[#3b3733] hover:border-[#ede8df]/30 transition-colors group"
            >
              <svg className="w-4 h-4 text-[#b2a491] group-hover:text-[#ede8df] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium text-[#b2a491] group-hover:text-[#ede8df] transition-colors">Back</span>
            </Link>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-[#ede8df]">
                {galleryInfo?.title || 'Gallery'}
              </h1>
              {galleryInfo?.description && (
                <p className="text-sm text-[#b2a491] mt-0.5">{galleryInfo.description}</p>
              )}
            </div>
            <div className="text-xs text-[#8f8271]">
              {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24">
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-600/50 bg-red-900/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {(loading || (!loading && photos.length === 0 && !emptyReady)) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(10)].map((_, i) => <PhotoSkeleton key={i} />)}
          </div>
        )}

        {photos.length === 0 && !loading && emptyReady && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1f1e1d] border border-[#3b3733] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#666461]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-[#b2a491]">No photos yet</p>
            <p className="text-sm text-[#8f8271] mt-1">Be the first to capture a moment!</p>
          </div>
        )}

        {photos.length > 0 && (
          <motion.div 
            variants={containerVariants}
            initial={reduceMotion ? false : "hidden"}
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
          >
            {photos.map((p: any, i: number) => (
              <motion.figure 
                key={p.id}
                variants={itemVariants}
                layoutId={`photo-${p.id}`}
                className="group cursor-pointer relative overflow-hidden rounded-xl bg-[#1f1e1d] border border-[#3b3733] hover:border-[#ede8df]/40 transition-colors duration-300 hover:shadow-xl hover:shadow-[#ff8a3d]/5"
                onClick={() => openAt(i)}
              >
                <div className="relative aspect-square bg-[#0a0908] overflow-hidden">
                  <motion.div initial={reduceMotion ? false : { opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="absolute inset-0">
                    <Image 
                      src={(p.media_type === 'video' ? (p.thumbnail_url || p.r2_url) : (p.thumbnail_url || p.r2_url))}
                      alt={p.original_filename || 'photo'}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      priority={i < 4}
                      quality={75}
                      className="object-cover"
                    />
                  </motion.div>
                  {p.media_type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-[#171616] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Overlay info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-sm font-medium truncate">{p.user_name || 'Anonymous'}</p>
                    <p className="text-xs opacity-75">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </motion.figure>
            ))}
          </motion.div>
        )}
      </main>

      {/* Lightbox viewer - positioned below navbar */}
      <AnimatePresence>
        {viewerOpen && photos[index] && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-0 bottom-0 z-30 bg-black"
            role="dialog"
            aria-modal="true"
            aria-label="Media viewer"
            onClick={() => setViewerOpen(false)}
          >
            {/* Main content area - starts below navbar (h-16) */}
            <div className="pt-16 h-full flex flex-col" onClick={(e) => e.stopPropagation()} ref={viewerContentRef}>
              {/* Top bar with info and close */}
              <div className="flex-none bg-black/80 backdrop-blur-sm border-b border-white/10 px-4 py-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">{photos[index].user_name || 'Anonymous'}</p>
                  <p className="text-white/60 text-xs">{new Date(photos[index].created_at).toLocaleString()}</p>
                </div>
                <button 
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                  onClick={() => setViewerOpen(false)}
                  ref={closeBtnRef}
                  aria-label="Close viewer"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Image/Video container - fills remaining space */}
              <div className="flex-1 flex items-center justify-center px-4 py-4 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={photos[index].id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    {photos[index].media_type === 'video' ? (
                      <video 
                        src={photos[index].r2_url} 
                        controls 
                        autoPlay
                        playsInline
                        className="max-h-full max-w-full rounded-lg shadow-2xl"
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <Image 
                          src={photos[index].r2_url}
                          alt={photos[index].original_filename || 'photo'}
                          fill
                          sizes="100vw"
                          priority
                          className="object-contain rounded-lg shadow-2xl"
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom controls */}
              <div className="flex-none bg-black/80 backdrop-blur-sm border-t border-white/10 px-4 py-4">
                <div className="flex items-center justify-center gap-3">
                  <button 
                    onClick={prev} 
                    className="p-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={photos.length <= 1}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <span className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium min-w-[100px] text-center">
                    {index + 1} / {photos.length}
                  </span>

                  {photos[index].media_type !== 'video' && (
                    <a 
                      href={photos[index].r2_url} 
                      download
                      className="p-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
                      title="Download photo"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  )}
                  
                  <button 
                    onClick={next} 
                    className="p-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={photos.length <= 1}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                {/* Keyboard hint */}
                <div className="text-center text-white/40 text-xs mt-3 hidden sm:block">
                  Use arrow keys to navigate • ESC to close
                </div>
              </div>
            </div>

            {/* Hidden prefetchers for next/prev images */}
            {photos[nextIdx] && photos[nextIdx].media_type !== 'video' && (
              <link rel="prefetch" as="image" href={photos[nextIdx].r2_url} />
            )}
            {photos[prevIdx] && photos[prevIdx].media_type !== 'video' && (
              <link rel="prefetch" as="image" href={photos[prevIdx].r2_url} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
