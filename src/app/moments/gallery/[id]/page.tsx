"use client";
import { useEffect, useMemo, useState, useRef, use, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuickShop } from '@/contexts/QuickShopContext';

interface Photo {
  id: number;
  r2_url: string;
  thumbnail_url?: string;
  original_filename?: string;
  user_name?: string;
  created_at: string;
  media_type?: string;
  moderated?: number;
}

interface GalleryInfo {
  title?: string;
  description?: string;
  shopifyProductHandle?: string;
}

export default function GalleryViewer({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const sp = useSearchParams();
  const codeFromUrl = sp?.get('code') || '';
  const [code] = useState<string>(codeFromUrl);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [galleryInfo, setGalleryInfo] = useState<GalleryInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const { openQuickShop } = useQuickShop();

  // Setup portal root on mount
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // Touch handling for swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const canFetch = useMemo(() => Number.isFinite(id), [id]);

  const fetchPhotos = useCallback(async () => {
    if (!canFetch) return;
    setLoading(true);
    setError('');
    try {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const infoRes = await fetch(`/api/moments/galleries/${id}`, { signal: ac.signal });
      if (infoRes.ok) {
        const infoData = await infoRes.json().catch(() => ({}));
        if (infoData?.gallery) {
          setGalleryInfo({
            title: infoData.gallery.title,
            description: infoData.gallery.description,
            shopifyProductHandle: infoData.gallery.shopify_product_handle || undefined,
          });
        }
      }

      const url = new URL('/api/moments/list', window.location.origin);
      url.searchParams.set('galleryId', String(id));
      if (code) url.searchParams.set('code', code);
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString(), { signal: ac.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load photos');
      const list = Array.isArray(data?.photos) ? data.photos : [];
      setPhotos(list.filter((p: Photo) => p.moderated !== 2));
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }, [canFetch, id, code]);

  useEffect(() => {
    if (canFetch) fetchPhotos();
  }, [canFetch, fetchPhotos]);

  useEffect(() => {
    if (!canFetch) return;
    const timer = setInterval(() => {
      if (!document.hidden) fetchPhotos();
    }, 30000);
    return () => clearInterval(timer);
  }, [canFetch, fetchPhotos]);

  const openAt = (i: number) => {
    setIndex(i);
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
  };

  const prev = useCallback(() => {
    if (photos.length <= 1) return;
    setIndex(i => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const next = useCallback(() => {
    if (photos.length <= 1) return;
    setIndex(i => (i + 1) % photos.length);
  }, [photos.length]);

  // Handle touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        next();
      } else {
        prev();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!viewerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') closeViewer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [viewerOpen, prev, next]);

  // Lock body scroll when viewer is open
  useEffect(() => {
    if (viewerOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [viewerOpen]);

  const currentPhoto = photos[index];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Gallery Header - scrolls with content, below app header */}
      <header className="bg-[#0a0a0a] border-b border-[#252221]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/moments"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1a1918] hover:bg-[#252221] transition-colors"
          >
            <svg className="w-5 h-5 text-[#ede8df]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-[#ede8df] truncate">
              {galleryInfo?.title || 'Gallery'}
            </h1>
          </div>

          <span className="text-sm text-[#726d6c] tabular-nums">{photos.length}</span>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 px-1 pb-24">
        {error && (
          <div className="mx-2 mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-3 gap-0.5">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-square bg-[#252221] animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && photos.length === 0 && !error && (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#252221] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#502d26]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <p className="text-[#ede8df] font-medium mb-1">No photos yet</p>
            <p className="text-sm text-[#726d6c] mb-4">Be the first to capture a moment</p>
            <Link
              href={`/moments?galleryId=${id}`}
              className="inline-block px-4 py-2 rounded-lg bg-[#843c2d] text-white text-sm font-medium"
            >
              Open Camera
            </Link>
          </div>
        )}

        {/* Photo Grid */}
        {!loading && photos.length > 0 && (
          <div className="grid grid-cols-3 gap-0.5">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                onClick={() => openAt(i)}
                className="relative aspect-square bg-[#1a1918] overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:ring-inset"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnail_url || photo.r2_url}
                  alt=""
                  loading={i < 12 ? 'eager' : 'lazy'}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {photo.media_type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Shop Now Button - shows when gallery has linked product */}
      {galleryInfo?.shopifyProductHandle && (
        <button
          onClick={() => openQuickShop(galleryInfo.shopifyProductHandle!)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-white text-black font-medium shadow-lg hover:bg-neutral-100 transition-colors"
          style={{ paddingBottom: 'max(12px, calc(12px + env(safe-area-inset-bottom, 0px)))' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Shop Now
        </button>
      )}

      {/* Fullscreen Viewer - rendered via Portal to escape all stacking contexts */}
      {viewerOpen && currentPhoto && portalRoot && createPortal(
        <div className="photo-lightbox-portal">
          {/* Black overlay that covers entire viewport */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'black',
              zIndex: 99999,
            }}
            onClick={closeViewer}
          />

          {/* Viewer content */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100000,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Close button - top left, always visible */}
            <button
              onClick={closeViewer}
              style={{
                position: 'absolute',
                top: 'calc(16px + env(safe-area-inset-top, 0px))',
                left: '16px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.2)',
                zIndex: 100001,
              }}
              aria-label="Close"
            >
              <svg style={{ width: '28px', height: '28px', color: 'white' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Download button - top right */}
            {currentPhoto.media_type !== 'video' && (
              <a
                href={currentPhoto.r2_url}
                download
                style={{
                  position: 'absolute',
                  top: 'calc(16px + env(safe-area-inset-top, 0px))',
                  right: '16px',
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  zIndex: 100001,
                }}
                aria-label="Download"
              >
                <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </a>
            )}

            {/* Image area - fills the screen */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {currentPhoto.media_type === 'video' ? (
                <video
                  key={currentPhoto.id}
                  src={currentPhoto.r2_url}
                  controls
                  autoPlay
                  playsInline
                  style={{ maxHeight: '100%', maxWidth: '100%' }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={currentPhoto.id}
                  src={currentPhoto.r2_url}
                  alt=""
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
              )}
            </div>

            {/* Bottom controls */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                padding: '16px',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
              }}
            >
              <button
                onClick={prev}
                disabled={photos.length <= 1}
                style={{
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  opacity: photos.length <= 1 ? 0.3 : 1,
                }}
              >
                <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              <span style={{ color: 'white', fontSize: '16px', fontWeight: 500, minWidth: '80px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {index + 1} / {photos.length}
              </span>

              <button
                onClick={next}
                disabled={photos.length <= 1}
                style={{
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  opacity: photos.length <= 1 ? 0.3 : 1,
                }}
              >
                <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>,
        portalRoot
      )}
    </div>
  );
}
