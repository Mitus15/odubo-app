'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Video {
  id: number;
  title: string;
  description: string;
  url: string;
  poster_url?: string;
  thumbnail?: string;
  duration?: string;
  duration_seconds?: number | null;
  category?: string;
  type?: string;
  mood?: string;
  credits?: string;
  created_at: string;
  uid?: string;
  thumbnail_timestamp_pct?: number | null;
}

interface VideoLibraryProps {
  videos: Video[];
}

const durationToSeconds = (durationStr?: string): number => {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};


export default function VideoLibrary({ videos }: VideoLibraryProps) {
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'duration'>('newest');

  const sortedVideos = useMemo(() => {
    const sorted = [...videos];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
        case 'oldest':
          return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'duration':
          return durationToSeconds(a.duration) - durationToSeconds(b.duration);
        default:
          return 0;
      }
    });
    return sorted;
  }, [videos, sortBy]);

  const formatDuration = (duration?: string | number) => {
    if (!duration) return '';
    if (typeof duration === 'string' && duration.includes(':')) return duration;
    const seconds = typeof duration === 'string' ? parseFloat(duration) : duration;
    if (isNaN(seconds)) return String(duration);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getVideoThumbnail = (video: Video) => {
    if (video.poster_url) return video.poster_url;
    if (video.thumbnail) return video.thumbnail;
    if (video.uid) {
      const pct = typeof video.thumbnail_timestamp_pct === 'number' && video.thumbnail_timestamp_pct >= 0 && video.thumbnail_timestamp_pct <= 1
        ? video.thumbnail_timestamp_pct : 0.5;
      const dur = typeof video.duration_seconds === 'number' && isFinite(video.duration_seconds) ? Math.max(0, video.duration_seconds) : null;
      const timeSec = dur ? Math.max(0, Math.floor(pct * dur)) : null;
      const base = `https://videodelivery.net/${video.uid}/thumbnails/thumbnail.jpg`;
      const params = new URLSearchParams();
      params.set('width', '640');
      if (timeSec !== null) params.set('time', `${timeSec}s`);
      return `${base}?${params.toString()}`;
    }
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMUExQTFBIi8+PC9zdmc+';
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Sort - minimal left-aligned */}
      <div className="flex-shrink-0 px-4 py-3 flex gap-4">
        {(['newest', 'oldest', 'title'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setSortBy(option)}
            className={`text-xs transition-colors ${
              sortBy === option
                ? 'text-[#ede8df]'
                : 'text-[#726d6c] hover:text-[#b2a491]'
            }`}
          >
            {option === 'newest' ? 'Latest' : option === 'oldest' ? 'Oldest' : 'A–Z'}
          </button>
        ))}
      </div>

      {/* Video Grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
        {/* For You Section */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#843c2d] to-[#502d26]" />
            <h2 className="text-sm font-semibold text-[#ede8df] uppercase tracking-wider">
              For You
            </h2>
          </div>
          <div className="p-6 rounded-2xl glass-surface border border-[#502d26]/30 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-[#502d26]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            <p className="text-sm text-[#b2a491]">Personalized recommendations coming soon</p>
            <p className="text-xs text-[#726d6c] mt-1">We&apos;ll learn your taste as you watch</p>
          </div>
        </div>

        {/* All Videos Label */}
        {sortedVideos.length > 0 && (
          <div className="flex items-center gap-3 px-4 mb-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#726d6c] to-[#502d26]" />
            <h2 className="text-sm font-semibold text-[#ede8df] uppercase tracking-wider">
              All Videos
            </h2>
          </div>
        )}

        <div className="px-4">
        {sortedVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedVideos.map((video) => (
              <Link
                key={video.id}
                href={`/media/${video.id}`}
                className="group block rounded-xl overflow-hidden border border-[#502d26]/20 hover:border-[#843c2d]/30 transition-all duration-300"
              >
                <div className="aspect-video relative bg-[#0a0908]">
                  <Image
                    src={getVideoThumbnail(video)}
                    alt={video.title}
                    fill
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />

                  {/* Play icon on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 rounded-full bg-[#171616]/60 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#ede8df] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>

                  {/* Duration */}
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-[#171616]/80 text-[#ede8df] text-[11px] rounded">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                </div>

                {/* Title only */}
                <div className="p-3">
                  <h3 className="text-sm text-[#ede8df] line-clamp-2 leading-snug">
                    {video.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <div className="w-16 h-16 rounded-xl border border-[#502d26]/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
