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
      {/* Sort Bar - Fixed at top */}
      <div className="flex-shrink-0 p-4 pb-2">
        <div className="glass-card rounded-2xl p-1 mx-auto max-w-md">
          <div className="flex gap-1 justify-center">
            {(['newest', 'oldest', 'title', 'duration'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 capitalize ${
                  sortBy === option
                    ? 'bg-[#843c2d] text-[#ede8df]'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]/50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Video Grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {sortedVideos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedVideos.map((video) => (
              <Link 
                key={video.id} 
                href={`/media/${video.id}`}
                className="group block rounded-2xl overflow-hidden border border-[#502d26]/30 hover:border-[#843c2d]/50 transition-all duration-300 bg-[#1a1615]/60 hover:bg-[#1a1615]/80 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30"
              >
                <div className="aspect-video relative">
                  <Image
                    src={getVideoThumbnail(video)}
                    alt={video.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* Play button overlay on hover - desktop only */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                  {/* Duration badge */}
                  {video.duration && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 text-white text-xs rounded-md">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-10">
                    <h3 className="text-base font-semibold text-white line-clamp-2 group-hover:text-[#ede8df] transition-colors">
                      {video.title}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-8">
              <p className="text-[#b2a491]">No videos found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
