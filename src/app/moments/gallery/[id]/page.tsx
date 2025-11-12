"use client";
import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

export default function GalleryViewer({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const sp = useSearchParams();
  const codeFromUrl = sp?.get('code') || '';
  const [code, setCode] = useState<string>(codeFromUrl);
  const [photos, setPhotos] = useState<Array<any>>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [galleryInfo, setGalleryInfo] = useState<{title?: string; description?: string} | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const canFetch = useMemo(() => Number.isFinite(id), [id]);

  async function fetchPhotos() {
    if (!canFetch) return;
    setLoading(true);
    setError('');
    try {
      // Fetch gallery info
      const infoRes = await fetch(`/api/moments/galleries/${id}`);
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
      const res = await fetch(url.toString());
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load photos');
      // Client-side safety: hide rejected if server ever returns them to public views
      const list = Array.isArray(data?.photos) ? data.photos : [];
      const filtered = list.filter((p: any) => p.moderated !== 2);
      setPhotos(filtered);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canFetch) fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch]);

  // Auto-refresh while tab is visible
  useEffect(() => {
    if (!canFetch) return;
    let timer: any;
    let cancelled = false;
    function onVisibility() {
      if (document.hidden) return;
      fetchPhotos();
    }
    // staggered interval ~12s
    function start() {
      clearInterval(timer);
      timer = setInterval(() => {
        if (!document.hidden) fetchPhotos();
      }, 12000);
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

  // Swipe handling
  useEffect(() => {
    if (!viewerOpen) return;
    
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
    
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
      // Restore body scroll
      document.body.style.overflow = '';
      document.removeEventListener('touchstart', onTouchStart as any);
      document.removeEventListener('touchend', onTouchEnd as any);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [viewerOpen, photos.length]);

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

        {loading && photos.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(10)].map((_, i) => <PhotoSkeleton key={i} />)}
          </div>
        )}

        {photos.length === 0 && !loading && (
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
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
            {photos.map((p: any, i: number) => (
              <figure 
                key={p.id} 
                className="break-inside-avoid group cursor-pointer relative overflow-hidden rounded-xl bg-[#1f1e1d] border border-[#3b3733] hover:border-[#ede8df]/40 transition-all duration-300 hover:shadow-xl hover:shadow-[#ff8a3d]/5"
                onClick={() => openAt(i)}
                style={{
                  animation: loadedImages.has(p.id) ? 'fadeInUp 0.4s ease-out' : 'none',
                  opacity: loadedImages.has(p.id) ? 1 : 0
                }}
              >
                {p.media_type === 'video' ? (
                  <div className="relative aspect-video bg-black">
                    <video 
                      src={p.thumbnail_url || p.r2_url} 
                      className="w-full h-full object-cover"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <svg className="w-6 h-6 text-[#171616] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={p.thumbnail_url || p.r2_url} 
                    alt={p.original_filename || 'photo'} 
                    className="w-full h-auto group-hover:scale-[1.02] transition-transform duration-300"
                    loading="lazy"
                    onLoad={() => setLoadedImages(prev => new Set(prev).add(p.id))}
                  />
                )}
                
                {/* Overlay info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <p className="text-sm font-medium truncate">{p.user_name || 'Anonymous'}</p>
                    <p className="text-xs opacity-75">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </figure>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox viewer */}
      {viewerOpen && photos[index] && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm">
          {/* Close button */}
          <button 
            className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
            onClick={() => setViewerOpen(false)}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image/Video container */}
          <div className="h-full w-full flex items-center justify-center px-4 py-20">
            {photos[index].media_type === 'video' ? (
              <video 
                src={photos[index].r2_url} 
                controls 
                autoPlay
                className="max-h-full max-w-full rounded-lg shadow-2xl"
              />
            ) : (
              <img 
                src={photos[index].r2_url} 
                alt={photos[index].original_filename || 'photo'} 
                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>

          {/* Photo info */}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
            <p className="text-white font-medium">{photos[index].user_name || 'Anonymous'}</p>
            <p className="text-white/70 text-sm">{new Date(photos[index].created_at).toLocaleString()}</p>
          </div>

          {/* Navigation controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button 
              onClick={prev} 
              className="p-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50"
              disabled={photos.length <= 1}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <span className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium">
              {index + 1} / {photos.length}
            </span>

            {photos[index].media_type !== 'video' && (
              <a 
                href={photos[index].r2_url} 
                download
                className="p-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            )}
            
            <button 
              onClick={next} 
              className="p-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50"
              disabled={photos.length <= 1}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="absolute bottom-6 right-6 text-white/40 text-xs hidden sm:block">
            Use arrow keys to navigate
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
