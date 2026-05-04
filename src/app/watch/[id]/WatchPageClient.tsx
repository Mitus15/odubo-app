'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import type { SocialLink } from './page';

interface WatchVideo {
  id: number;
  uid: string | null;
  title: string;
  description: string | null;
  url: string | null;
  poster_url: string | null;
  duration: string | null;
  category: string | null;
  type: string | null;
  credits: Array<{ name: string; role: string }>;
}

interface WatchPageClientProps {
  video: WatchVideo;
  moreVideos: WatchVideo[];
  socialLinks: SocialLink[];
}

export default function WatchPageClient({ video, moreVideos, socialLinks }: WatchPageClientProps) {
  const [showMusicModal, setShowMusicModal] = useState(false);
  const analytics = useAnalyticsSafe();

  // Track video view on mount
  useEffect(() => {
    analytics?.trackVideoOpen(video.id, video.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  const posterParam = video.poster_url
    ? `&poster=${encodeURIComponent(video.poster_url)}`
    : '';
  const embedUrl = video.uid
    ? `https://iframe.videodelivery.net/${video.uid}?controls=true&preload=metadata${posterParam}`
    : null;

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">

      {/* Music platforms modal */}
      <MusicModal open={showMusicModal} onClose={() => setShowMusicModal(false)} socialLinks={socialLinks} />

      {/* Ambient background glow from poster */}
      {video.poster_url && (
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
          <Image
            src={video.poster_url}
            alt=""
            fill
            className="object-cover opacity-10 blur-[80px] scale-110"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[#0d0c0a]/80" />
        </div>
      )}

      {/* Minimal header */}
      <header className="px-6 sm:px-10 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="text-[#b2a491]/40 hover:text-[#b2a491]/70 transition-colors"
          aria-label="Home"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </Link>
        {(video.category || video.type) && (
          <button
            onClick={() => setShowMusicModal(true)}
            className="text-[10px] tracking-[0.15em] uppercase text-[#843c2d]/80 bg-[#843c2d]/8 border border-[#843c2d]/20 px-3 py-1 rounded-full hover:bg-[#843c2d]/15 hover:border-[#843c2d]/35 transition-all duration-300 active:scale-95"
          >
            {video.category || video.type}
          </button>
        )}
      </header>

      {/* Video player */}
      <div className="w-full bg-black">
        {embedUrl ? (
          <div className="w-full aspect-video max-h-[80vh]">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; gyroscope; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        ) : video.url ? (
          <div className="w-full aspect-video max-h-[80vh]">
            <video
              src={video.url}
              className="w-full h-full"
              controls
              poster={video.poster_url || undefined}
            />
          </div>
        ) : (
          <div className="w-full aspect-video max-h-[80vh] flex items-center justify-center bg-[#171616]">
            <span className="text-[#b2a491]/30 text-sm">Video unavailable</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight leading-tight">
          {video.title}
        </h1>

        {video.duration && (
          <p className="mt-2 text-xs text-[#b2a491]/40 tracking-wider">{video.duration}</p>
        )}

        {video.description && (
          <p className="mt-5 text-[#b2a491]/80 text-sm sm:text-base leading-relaxed max-w-2xl">
            {video.description}
          </p>
        )}

        {/* Credits */}
        {video.credits.length > 0 && (
          <div className="mt-10 pt-8 border-t border-white/5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#b2a491]/30 mb-5">Credits</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
              {video.credits.map((c, i) => (
                <div key={i}>
                  <p className="text-[10px] uppercase tracking-wider text-[#b2a491]/35">{c.role}</p>
                  <p className="text-sm text-[#ede8df]/75 mt-0.5">{c.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* More work */}
      {moreVideos.length > 0 && (
        <div className="max-w-3xl mx-auto px-6 sm:px-10 pb-16">
          <div className="border-t border-white/[0.04] pt-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#b2a491]/30 mb-6">
              More Work
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {moreVideos.map((v) => (
                <Link key={v.id} href={`/watch/${v.id}`} className="group block">
                  <div className="aspect-[3/4] rounded-md overflow-hidden relative bg-[#171616]">
                    {v.poster_url ? (
                      <Image
                        src={v.poster_url}
                        alt={v.title}
                        fill
                        className="object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-500"
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  </div>
                  <p className="mt-2 text-xs text-[#ede8df]/45 group-hover:text-[#ede8df]/75 transition-colors duration-300 line-clamp-1 leading-snug">
                    {v.title}
                  </p>
                  {v.category && (
                    <p className="mt-0.5 text-[10px] text-[#b2a491]/25 uppercase tracking-wider">
                      {v.category}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Join the Cool */}
      <JoinTheCool socialLinks={socialLinks} />
    </div>
  );
}

/* ─── Music Modal ──────────────────────────────────────────────────────────── */

const MUSIC_PLATFORMS = ['spotify', 'apple_music', 'youtube'];

function MusicModal({ open, onClose, socialLinks }: { open: boolean; onClose: () => void; socialLinks: SocialLink[] }) {
  const musicLinks = socialLinks
    .filter(l => MUSIC_PLATFORMS.includes(l.platform))
    .sort((a, b) => MUSIC_PLATFORMS.indexOf(a.platform) - MUSIC_PLATFORMS.indexOf(b.platform));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xs mx-4 bg-[#141312]/95 border border-white/[0.06] rounded-2xl px-8 py-9 animate-[slideUp_0.4s_ease-out]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#b2a491]/30 hover:text-[#b2a491]/60 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ede8df]/20 mb-7 text-center">
          Listen
        </p>

        <div className="flex items-center justify-center gap-4">
          {musicLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group w-[60px] h-[60px] flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-300 active:scale-95"
              aria-label={link.title}
            >
              <PlatformIcon platform={link.platform} />
            </a>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ─── Join the Cool (inline section) ──────────────────────────────────────── */

const PLATFORM_ORDER = ['spotify', 'apple_music', 'youtube', 'instagram', 'tiktok', 'shopify'];

function JoinTheCool({ socialLinks }: { socialLinks: SocialLink[] }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || state === 'sending') return;
    setState('sending');

    try {
      const res = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as { success?: boolean };
      if (data.success) {
        setState('done');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }, [email, state]);

  // Sort links by platform order, shop last
  const sortedLinks = [...socialLinks].sort((a, b) => {
    const ai = PLATFORM_ORDER.indexOf(a.platform);
    const bi = PLATFORM_ORDER.indexOf(b.platform);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Shop link gets special handling (internal route)
  const externalLinks = sortedLinks.filter(l => l.platform !== 'shopify' && l.platform !== 'odubo-studio');
  const hasShop = sortedLinks.some(l => l.platform === 'shopify' || l.platform === 'odubo-studio');

  return (
    <div className="border-t border-white/[0.04]">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 sm:py-20">

        {/* Label */}
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ede8df]/20 mb-10 text-center">
          Join the Cool
        </p>

        {/* Icon grid */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {externalLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-300 active:scale-95"
              aria-label={link.title}
            >
              <PlatformIcon platform={link.platform} />
            </a>
          ))}
          {hasShop && (
            <Link
              href="/store"
              className="group w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-300 active:scale-95"
              aria-label="Shop"
            >
              <Image
                src="/brand-logos/odubo-brand/odubo.svg"
                alt="odubo studio"
                width={24}
                height={24}
                className="w-6 h-6 object-contain opacity-50 group-hover:opacity-80 transition-opacity duration-300"
              />
            </Link>
          )}
        </div>

        {/* Email capture */}
        <div className="mt-12 max-w-[280px] mx-auto">
          {state === 'done' ? (
            <p className="text-center text-xs text-[#b2a491]/40 tracking-wide">
              Check your email.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                placeholder="your email"
                required
                className="w-full bg-transparent border-b border-white/[0.12] pb-3 pt-1 text-sm text-[#ede8df]/80 placeholder:text-[#ede8df]/15 outline-none focus:border-[#843c2d]/40 transition-colors pr-10 tracking-wide"
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="absolute right-0 bottom-3 text-[#ede8df]/25 hover:text-[#ede8df]/60 transition-colors disabled:opacity-30"
                aria-label="Subscribe"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </form>
          )}
          {state === 'error' && (
            <p className="mt-2 text-xs text-red-400/50 text-center">Try again.</p>
          )}
        </div>

        {/* Home */}
        <div className="mt-14 flex justify-center">
          <Link
            href="/"
            className="text-[#b2a491]/20 hover:text-[#b2a491]/50 transition-colors duration-300"
            aria-label="Home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Platform Icons ───────────────────────────────────────────────────────── */

function PlatformIcon({ platform }: { platform: string }) {
  const cls = "w-5 h-5 opacity-45 group-hover:opacity-80 transition-opacity duration-300";

  switch (platform) {
    case 'spotify':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="#1DB954">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      );
    case 'apple_music':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="#FA2D48">
          <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.1-1.267-.315-.812-.09-1.79.574-2.306.37-.287.803-.46 1.26-.575.47-.118.944-.22 1.414-.337.25-.063.47-.18.59-.42.1-.19.12-.39.12-.59V8.76c0-.12-.02-.24-.09-.34-.1-.13-.24-.19-.4-.19-.18 0-.37.03-.55.07l-4.68 1.04c-.03 0-.06.01-.09.02-.35.07-.49.24-.52.6v7.69c0 .43-.06.85-.25 1.24-.3.59-.76.96-1.39 1.14-.35.1-.71.16-1.08.18-.96.04-1.8-.46-2.12-1.28-.31-.81-.09-1.78.58-2.3.37-.29.8-.46 1.26-.58.46-.12.93-.22 1.4-.34.26-.06.49-.19.6-.44.09-.18.11-.37.11-.57V7.13c0-.3.07-.58.27-.8.18-.2.4-.32.67-.38l6.32-1.41c.23-.05.46-.1.7-.13.3-.04.58.06.78.3.14.17.21.38.21.6v4.78z"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="#FF0000">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="#E4405F">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="white">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 opacity-35" fill="none" stroke="white" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      );
  }
}
