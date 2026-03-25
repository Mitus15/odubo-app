"use client";
import Link from 'next/link';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';



interface Gallery {
  id: number;
  title: string;
  code?: string;
  created_at?: string;
  photo_count?: number;
  preview_photos?: Array<{ id: number; thumbnail_url?: string; r2_url: string }>;
}

function MomentsIndex() {
  const params = useSearchParams();
  const prefillGalleryId = params?.get('galleryId') ?? '';
  const prefillIg = params?.get('ig') ?? '';
  const prefillCode = params?.get('code') ?? '';

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [galleryId, setGalleryId] = useState<string>(prefillGalleryId);
  const [ig, setIg] = useState<string>(prefillIg ? (prefillIg.startsWith('@') ? prefillIg : `@${prefillIg}`) : '');
  const [eventCode, setEventCode] = useState<string>(prefillCode);


  const refreshGalleries = useCallback(async () => {
    try {
      setGalleryLoading(true);
      const res = await fetch('/api/moments/galleries/public?limit=12&preview=true');
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.galleries)) setGalleries(data.galleries);
    } catch {
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  useEffect(() => { refreshGalleries(); }, [refreshGalleries]);

  useEffect(() => {
    if (prefillIg) {
      try { localStorage.setItem('instagramHandle', prefillIg.replace(/^@/, '')); } catch {}
    } else {
      try {
        const stored = localStorage.getItem('instagramHandle');
        if (stored && !ig) setIg(stored.startsWith('@') ? stored : `@${stored}`);
      } catch {}
    }
  }, [prefillIg, ig]);

  useEffect(() => {
    if (!galleryId || eventCode) return;
    fetch(`/api/moments/galleries/${encodeURIComponent(galleryId)}`)
      .then(res => res.json())
      .then(data => { if (data?.gallery?.code) setEventCode(String(data.gallery.code)); })
      .catch(() => {});
  }, [galleryId, eventCode]);

  return (
    <div className="min-h-full bg-[#171616]">


      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {/* Clips link - shown on desktop alongside galleries */}
        <div className="hidden md:block mb-6">
          <Link 
            href="/moments/clips"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-300 hover:from-purple-600/30 hover:to-indigo-600/30 hover:border-purple-500/50 transition-all text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Watch Clips
          </Link>
        </div>

        <GalleryGrid galleries={galleries} loading={galleryLoading} />
        <Link
          href="/moments/capture"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white shadow-lg shadow-[#843c2d]/30 flex items-center justify-center hover:from-[#9a4535] hover:to-[#843c2d] transition-all z-40"
          title="Capture"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        </Link>
      </main>


    </div>
  );
}

export default function MomentsPageClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#171616] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" /></div>}>
      <MomentsIndex />
    </Suspense>
  );
}

function GalleryGrid({ galleries, loading }: { galleries: Gallery[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-8">
        {/* Hero skeleton */}
        <div className="animate-pulse">
          <div className="aspect-[16/9] sm:aspect-[21/9] rounded-2xl bg-[#252221]" />
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] rounded-xl bg-[#252221]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (galleries.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#302927] to-[#252221] flex items-center justify-center border border-[#502d26]/20">
          <svg className="w-10 h-10 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[#ede8df] mb-1">No galleries yet</h3>
        <p className="text-sm text-[#726d6c]">Check back soon for event photos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {galleries.map((gallery, index) => (
          <Link
            key={gallery.id}
            href={`/moments/gallery/${gallery.id}`}
            className={`group block ${index === 0 ? 'col-span-2 sm:col-span-2' : ''}`}
          >
            <div className={`relative rounded-xl overflow-hidden bg-[#1a1918] border border-[#502d26]/20 group-hover:border-[#843c2d]/40 transition-colors ${
              index === 0 ? 'aspect-video' : 'aspect-square'
            }`}>
              {gallery.preview_photos && gallery.preview_photos.length > 0 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gallery.preview_photos[0].thumbnail_url || gallery.preview_photos[0].r2_url}
                    alt={gallery.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#252221] via-[#1a1918] to-[#252221]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/odubo_logo_emboss.webp"
                    alt=""
                    className="w-16 h-16 object-contain opacity-20"
                    draggable={false}
                  />
                  <span className="mt-2 text-[10px] text-[#502d26]/60 uppercase tracking-widest">
                    Coming Soon
                  </span>
                </div>
              )}

              {/* Photo count badge */}
              {gallery.photo_count !== undefined && gallery.photo_count > 0 && (
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-xs text-white font-medium flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                  </svg>
                  {gallery.photo_count}
                </div>
              )}

              {/* Featured badge for first item */}
              {index === 0 && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#843c2d] text-xs text-white font-semibold uppercase tracking-wide">
                  Featured
                </div>
              )}

              {/* Content overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className={`font-semibold text-white mb-1 line-clamp-2 group-hover:text-[#f0e4d8] transition-colors ${
                  index === 0 ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
                }`}>
                  {gallery.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  {gallery.created_at && (
                    <span>{new Date(gallery.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  )}
                  {gallery.photo_count !== undefined && gallery.photo_count > 0 && index === 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/40" />
                      <span>{gallery.photo_count} photos</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}




