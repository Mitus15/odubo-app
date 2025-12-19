'use client';

import { useEffect } from 'react';
import { useUnifiedMedia, type Gallery } from '@/contexts/UnifiedMediaContext';

export default function MomentsTabView() {
  const {
    moments,
    refreshGalleries,
    openMomentsGallery,
    openMomentsCamera,
  } = useUnifiedMedia();

  const { galleries, isLoadingGalleries } = moments;

  // Fetch galleries on mount if not already loaded
  useEffect(() => {
    if (galleries.length === 0 && !isLoadingGalleries) {
      refreshGalleries();
    }
  }, [galleries.length, isLoadingGalleries, refreshGalleries]);

  // Loading state
  if (isLoadingGalleries) {
    return (
      <div className="p-3">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (galleries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        </div>
        <p className="text-white/50 text-sm text-center mb-4">No moments galleries yet</p>
        <button
          onClick={() => openMomentsCamera()}
          className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-colors text-sm"
        >
          Capture Moments
        </button>
      </div>
    );
  }

  // Galleries grid
  return (
    <div className="p-3">
      {/* Capture button */}
      <button
        onClick={() => openMomentsCamera()}
        className="w-full mb-4 p-4 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
        style={{ touchAction: 'manipulation' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
        <span className="font-medium">Capture Moments</span>
      </button>

      {/* Galleries grid */}
      <div className="grid grid-cols-2 gap-3">
        {galleries.map((gallery, index) => (
          <GalleryCard
            key={gallery.id}
            gallery={gallery}
            featured={index === 0}
            onClick={() => openMomentsGallery(gallery.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Gallery card component
function GalleryCard({
  gallery,
  featured = false,
  onClick,
}: {
  gallery: Gallery;
  featured?: boolean;
  onClick: () => void;
}) {
  // Get preview image from preview_photos if available
  const previewImage = gallery.preview_photos?.[0]?.thumbnail_url || gallery.preview_photos?.[0]?.r2_url;

  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg bg-black focus:outline-none ${
        featured ? 'col-span-2 aspect-video' : 'aspect-square'
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Preview image or placeholder */}
      {previewImage ? (
        <img
          src={previewImage}
          alt={gallery.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#302927] to-[#1a1714] flex items-center justify-center">
          <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
      )}

      {/* Featured badge */}
      {featured && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-[#843c2d] rounded-full">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Featured</span>
        </div>
      )}

      {/* Photo count badge */}
      {gallery.photo_count != null && gallery.photo_count > 0 && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-full flex items-center gap-1">
          <svg className="w-3 h-3 text-white/80" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <span className="text-[10px] text-white/80 font-medium">{gallery.photo_count}</span>
        </div>
      )}

      {/* Gradient overlay with title */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        <p className="text-white text-sm font-semibold truncate">{gallery.title}</p>
        {gallery.description && (
          <p className="text-white/60 text-xs truncate mt-0.5">{gallery.description}</p>
        )}
      </div>
    </button>
  );
}
