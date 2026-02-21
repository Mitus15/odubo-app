'use client';

import Image from 'next/image';
import Link from 'next/link';

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
}

export default function WatchPageClient({ video, moreVideos }: WatchPageClientProps) {
  const posterParam = video.poster_url
    ? `&poster=${encodeURIComponent(video.poster_url)}`
    : '';
  const embedUrl = video.uid
    ? `https://iframe.videodelivery.net/${video.uid}?controls=true&preload=metadata${posterParam}`
    : null;

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">

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
          className="text-xs tracking-[0.2em] uppercase text-[#b2a491]/40 hover:text-[#b2a491]/70 transition-colors font-light"
        >
          Odubo Studio
        </Link>
        {(video.category || video.type) && (
          <span className="text-[10px] tracking-[0.15em] uppercase text-[#843c2d]/80 bg-[#843c2d]/8 border border-[#843c2d]/20 px-3 py-1 rounded-full">
            {video.category || video.type}
          </span>
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
        <div className="max-w-3xl mx-auto px-6 sm:px-10 pb-20">
          <div className="border-t border-white/5 pt-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#b2a491]/30 mb-6">
              More Work
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {moreVideos.map((v) => (
                <Link key={v.id} href={`/watch/${v.id}`} className="group block">
                  <div className="aspect-video rounded-md overflow-hidden relative bg-[#171616]">
                    {v.poster_url ? (
                      <Image
                        src={v.poster_url}
                        alt={v.title}
                        fill
                        className="object-cover opacity-55 group-hover:opacity-80 transition-opacity duration-500"
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
    </div>
  );
}
