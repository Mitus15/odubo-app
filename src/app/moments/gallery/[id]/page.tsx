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

type LinkType = 'product' | 'video' | 'clip' | 'track' | 'album' | 'event' | 'gallery';
type GalleryType = 'event' | 'collection' | 'lookbook' | 'showcase' | 'bts' | 'campaign' | 'archive';
type UploadMode = 'public' | 'admin';

interface GalleryLink {
  id: number;
  link_type: LinkType;
  link_id: string;
  link_handle?: string;
  is_primary?: boolean;
  display_label?: string;
  sort_order?: number;
}

interface GalleryInfo {
  title?: string;
  description?: string;
  shopifyProductHandle?: string;
  gallery_type?: GalleryType;
  upload_mode?: UploadMode;
  links?: GalleryLink[];
}

// Helper to get action button for a link
function getLinkAction(link: GalleryLink): { label: string; icon: React.ReactNode; href?: string } | null {
  switch (link.link_type) {
    case 'product':
      return {
        label: link.display_label || 'Shop',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        ),
      };
    case 'album':
    case 'track':
      return {
        label: link.display_label || 'Listen',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
        ),
        href: link.link_handle ? `/music/${link.link_handle}` : `/music`,
      };
    case 'video':
    case 'clip':
      return {
        label: link.display_label || 'Watch',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        ),
        href: link.link_type === 'clip' ? `/?clipId=${link.link_id}` : `/media/${link.link_handle || link.link_id}`,
      };
    case 'event':
    case 'gallery':
      return {
        label: link.display_label || 'View',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 10.5V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v4.5M3 10.5h18" />
          </svg>
        ),
        href: `/moments/gallery/${link.link_id}`,
      };
    default:
      return null;
  }
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
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [galleryInfo, setGalleryInfo] = useState<GalleryInfo | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  
  // Graceful QuickShop fallback - use context if available, otherwise navigate
  let openQuickShop: ((handle: string) => void) | null = null;
  try {
    const qs = useQuickShop();
    openQuickShop = qs.openQuickShop;
  } catch {
    // QuickShop context not available - use fallback navigation
    openQuickShop = (handle: string) => {
      window.location.href = `/store/product/${handle}`;
    };
  }

  // Setup portal root on mount
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // Touch handling for swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const canFetch = useMemo(() => Number.isFinite(id), [id]);

  const PAGE_SIZE = 30;

  const fetchPhotos = useCallback(async (append = false) => {
    if (!canFetch) return;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (!append) {
        const infoRes = await fetch(`/api/moments/galleries/${id}`, { signal: ac.signal });
        if (infoRes.ok) {
          const infoData = await infoRes.json().catch(() => ({}));
          if (infoData?.gallery) {
            setGalleryInfo({
              title: infoData.gallery.title,
              description: infoData.gallery.description,
              shopifyProductHandle: infoData.gallery.shopify_product_handle || undefined,
              gallery_type: infoData.gallery.gallery_type || 'event',
              upload_mode: infoData.gallery.upload_mode || 'public',
              links: infoData.gallery.links || [],
            });
          }
        }
      }

      const offset = append ? photos.length : 0;
      const url = new URL('/api/moments/list', window.location.origin);
      url.searchParams.set('galleryId', String(id));
      if (code) url.searchParams.set('code', code);
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      const res = await fetch(url.toString(), { signal: ac.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load photos');
      const list: Photo[] = Array.isArray(data?.photos) ? data.photos : [];
      const filtered = list.filter((p: Photo) => p.moderated !== 2);
      setPhotos(prev => append ? [...prev, ...filtered] : filtered);
      setHasMore(list.length >= PAGE_SIZE);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || String(e));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [canFetch, id, code, photos.length]);

  useEffect(() => {
    if (canFetch) fetchPhotos(false);
  }, [canFetch, fetchPhotos]);

  useEffect(() => {
    if (!canFetch) return;
    const timer = setInterval(() => {
      if (!document.hidden) fetchPhotos(false);
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

  async function shareGallery() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: galleryInfo?.title || 'Photo Gallery', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {}
  }

  async function sharePhoto() {
    if (!currentPhoto) return;
    const url = currentPhoto.r2_url;
    try {
      if (navigator.share) {
        await navigator.share({ title: galleryInfo?.title || 'Photo', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {}
  }

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
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-[#ede8df] truncate">
                {galleryInfo?.title || 'Gallery'}
              </h1>
              {galleryInfo?.gallery_type && galleryInfo.gallery_type !== 'event' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#252221] text-[#726d6c] capitalize">
                  {galleryInfo.gallery_type}
                </span>
              )}
            </div>
            {galleryInfo?.description && (
              <p className="text-xs text-[#726d6c] truncate mt-0.5">
                {galleryInfo.description}
              </p>
            )}
          </div>

          <span className="text-sm text-[#726d6c] tabular-nums">{photos.length}</span>

          <button
            onClick={shareGallery}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1a1918] hover:bg-[#252221] transition-colors relative"
            aria-label="Share gallery"
          >
            {copiedLink ? (
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[#ede8df]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            )}
          </button>
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
            {galleryInfo?.upload_mode === 'admin' ? (
              <p className="text-sm text-[#726d6c]">This gallery is curated by the team</p>
            ) : (
              <>
                <p className="text-sm text-[#726d6c] mb-4">Be the first to capture a moment</p>
                <Link
                  href={`/moments?galleryId=${id}`}
                  className="inline-block px-4 py-2 rounded-lg bg-[#843c2d] text-white text-sm font-medium"
                >
                  Open Camera
                </Link>
              </>
            )}
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

        {/* Load More */}
        {!loading && hasMore && photos.length > 0 && (
          <div className="flex justify-center py-8">
            <button
              onClick={() => fetchPhotos(true)}
              disabled={loadingMore}
              className="px-6 py-3 rounded-xl bg-[#1a1918] border border-[#3b3733] text-sm text-[#ede8df] font-medium hover:bg-[#252221] transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                `Load More (${photos.length} loaded)`
              )}
            </button>
          </div>
        )}
      </main>

      {/* Linked Content Action Buttons */}
      {(galleryInfo?.links?.length || galleryInfo?.shopifyProductHandle) && (
        <div
          className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 items-end"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Legacy shopify product handle support */}
          {galleryInfo?.shopifyProductHandle && !galleryInfo?.links?.some(l => l.link_type === 'product') && (
            <button
              onClick={() => openQuickShop(galleryInfo.shopifyProductHandle!)}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-white text-black font-medium shadow-lg hover:bg-neutral-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Shop Now
            </button>
          )}

          {/* New links system */}
          {galleryInfo?.links?.map((link) => {
            const action = getLinkAction(link);
            if (!action) return null;

            // Product links use QuickShop
            if (link.link_type === 'product') {
              return (
                <button
                  key={link.id}
                  onClick={() => openQuickShop(link.link_handle || link.link_id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium shadow-lg transition-colors ${
                    link.is_primary
                      ? 'bg-white text-black hover:bg-neutral-100'
                      : 'bg-black/80 text-white hover:bg-black/90 border border-white/20'
                  }`}
                >
                  {action.icon}
                  {action.label}
                </button>
              );
            }

            // Other links navigate to their destination
            return (
              <Link
                key={link.id}
                href={action.href || '#'}
                className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium shadow-lg transition-colors ${
                  link.is_primary
                    ? 'bg-white text-black hover:bg-neutral-100'
                    : 'bg-black/80 text-white hover:bg-black/90 border border-white/20'
                }`}
              >
                {action.icon}
                {action.label}
              </Link>
            );
          })}
        </div>
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

            {/* Share button - top right, left of download */}
            <button
              onClick={sharePhoto}
              style={{
                position: 'absolute',
                top: 'calc(16px + env(safe-area-inset-top, 0px))',
                right: currentPhoto.media_type !== 'video' ? '72px' : '16px',
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
              aria-label="Share"
            >
              <svg style={{ width: '22px', height: '22px', color: 'white' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </button>

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
