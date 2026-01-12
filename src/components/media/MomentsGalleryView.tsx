'use client';

import { useEffect, useCallback, useRef, useState, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnifiedMedia, type Photo } from '@/contexts/UnifiedMediaContext';

// Hook to detect mobile vs desktop
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

/**
 * Optimized photo tile with blur-up loading
 */
const PhotoTile = memo(function PhotoTile({
  photo,
  index,
  onOpen,
}: {
  photo: Photo;
  index: number;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check if already cached/loaded on mount
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const isAboveFold = index < 9; // First 3 rows

  return (
    <button
      onClick={onOpen}
      className="relative aspect-square bg-[#1a1714] overflow-hidden group"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Blur placeholder */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a2520] to-[#1a1714] animate-pulse" />
      )}

      <img
        ref={imgRef}
        src={photo.thumbnail_url || photo.r2_url}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading={isAboveFold ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={index < 6 ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        draggable={false}
      />

      {/* Video indicator */}
      {photo.media_type === 'video' && loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-2 rounded-full bg-black/50 backdrop-blur-sm">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Username badge */}
      {photo.user_name && loaded && (
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[9px] text-white/80 truncate max-w-[80%]">
          @{photo.user_name}
        </div>
      )}
    </button>
  );
});

/**
 * Lightbox image with smooth loading
 */
const LightboxImage = memo(function LightboxImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset loaded state when src changes
  useEffect(() => {
    setLoaded(false);
    // Check if already cached
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div className="relative max-w-full max-h-full flex items-center justify-center">
      {/* Loading spinner */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt=""
        className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        decoding="async"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        draggable={false}
      />
    </div>
  );
});

interface MomentsGalleryViewProps {
  galleryId: number;
}

export default function MomentsGalleryView({ galleryId }: MomentsGalleryViewProps) {
  const {
    moments,
    refreshPhotos,
    goBack,
    openLightbox,
    closeLightbox,
    openMomentsCamera,
  } = useUnifiedMedia();

  const { photos, lightboxIndex, isLoadingPhotos } = moments;
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const isMobile = useIsMobile();

  // Touch handling for lightbox swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Setup portal root on mount
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // Fetch photos on mount
  useEffect(() => {
    if (galleryId) {
      refreshPhotos(galleryId);
    }
  }, [galleryId, refreshPhotos]);

  // Lightbox navigation
  const prev = useCallback(() => {
    if (photos.length <= 1 || lightboxIndex === null) return;
    openLightbox((lightboxIndex - 1 + photos.length) % photos.length);
  }, [photos.length, lightboxIndex, openLightbox]);

  const next = useCallback(() => {
    if (photos.length <= 1 || lightboxIndex === null) return;
    openLightbox((lightboxIndex + 1) % photos.length);
  }, [photos.length, lightboxIndex, openLightbox]);

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') closeLightbox();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, prev, next, closeLightbox]);

  // Preload adjacent lightbox images
  useEffect(() => {
    if (lightboxIndex === null || photos.length <= 1) return;

    const preloadUrls: string[] = [];
    const prevIdx = (lightboxIndex - 1 + photos.length) % photos.length;
    const nextIdx = (lightboxIndex + 1) % photos.length;

    if (photos[prevIdx]?.r2_url) preloadUrls.push(photos[prevIdx].r2_url);
    if (photos[nextIdx]?.r2_url) preloadUrls.push(photos[nextIdx].r2_url);

    preloadUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [lightboxIndex, photos]);

  // Download photo
  const handleDownload = (photo: Photo) => {
    const a = document.createElement('a');
    a.href = photo.r2_url;
    a.download = photo.original_filename || `moment-${photo.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[115] flex flex-col bg-gradient-to-br from-[#1a1714] via-[#0f0d0c] to-[#1a1714]"
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={goBack}
          className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
          aria-label="Back"
          style={{ touchAction: 'manipulation' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <h2 className="text-white text-sm font-medium">Gallery</h2>

        {/* Camera button - mobile only */}
        {isMobile ? (
          <button
            onClick={() => openMomentsCamera(galleryId)}
            className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Add photo"
            style={{ touchAction: 'manipulation' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </button>
        ) : (
          <div className="w-10" /> {/* Spacer for layout balance */}
        )}
      </header>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Loading */}
        {isLoadingPhotos && (
          <div className="p-1 md:p-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="aspect-square bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoadingPhotos && photos.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-6">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <p className="text-white/50 text-sm text-center mb-4">No photos in this gallery yet</p>
            {/* Capture button - mobile only */}
            {isMobile && (
              <button
                onClick={() => openMomentsCamera(galleryId)}
                className="px-5 py-2.5 rounded-xl bg-[#843c2d] text-white hover:bg-[#9a4535] transition-colors text-sm"
              >
                Be the first to capture
              </button>
            )}
          </div>
        )}

        {/* Photo grid - responsive columns for desktop */}
        {!isLoadingPhotos && photos.length > 0 && (
          <div className="p-1 md:p-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-2">
            {photos.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                index={index}
                onOpen={() => openLightbox(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox - rendered via portal */}
      {portalRoot && lightboxIndex !== null && currentPhoto && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black flex flex-col"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Lightbox header */}
            <header
              className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent"
              style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
            >
              <button
                onClick={closeLightbox}
                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <span className="text-white/60 text-sm">
                {lightboxIndex + 1} / {photos.length}
              </span>

              {/* Download button - only for photos */}
              {currentPhoto.media_type !== 'video' && (
                <button
                  onClick={() => handleDownload(currentPhoto)}
                  className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
                  aria-label="Download"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
              )}
              {currentPhoto.media_type === 'video' && <div className="w-10" />}
            </header>

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center p-4">
              {currentPhoto.media_type === 'video' ? (
                <video
                  src={currentPhoto.r2_url}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <LightboxImage src={currentPhoto.r2_url} />
              )}
            </div>

            {/* Navigation arrows - desktop only */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 hidden md:flex items-center justify-center text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors"
                  aria-label="Previous"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <button
                  onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 hidden md:flex items-center justify-center text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors"
                  aria-label="Next"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </>
            )}

            {/* Bottom info */}
            {currentPhoto.user_name && (
              <div
                className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"
                style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
              >
                <p className="text-white/80 text-sm">@{currentPhoto.user_name}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>,
        portalRoot
      )}
    </motion.div>
  );
}
