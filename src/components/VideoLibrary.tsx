'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Video {
  id: number;
  title: string;
  description: string;
  url: string;
  poster_url?: string;
  thumbnail?: string;
  duration?: string;
  category?: string;
  type?: string;
  mood?: string;
  credits?: string;
  created_at: string;
}

interface VideoLibraryProps {
  videos: Video[];
}

// Helper function to convert "mm:ss" or "h:mm:ss" to seconds
const durationToSeconds = (durationStr?: string): number => {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) { // h:mm:ss
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) { // mm:ss
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

export default function VideoLibrary({ videos }: VideoLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('music-video');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'duration'>('newest');

  const { categories, types } = useMemo(() => {
    const categorySet = new Set<string>();
    const typeSet = new Set<string>();
    
    videos.forEach(video => {
      if (video.category) categorySet.add(video.category);
      if (video.type) typeSet.add(video.type);
    });

    return {
      categories: Array.from(categorySet).sort(),
      types: Array.from(typeSet).sort()
    };
  }, [videos]);

  const filteredAndSortedVideos = useMemo(() => {
    let filtered = videos.filter(video => {
      const matchesCategory = selectedCategory === 'all' || video.category === selectedCategory;
      const matchesType = selectedType === 'all' || video.type === selectedType;
      return matchesCategory && matchesType;
    });

    filtered.sort((a, b) => {
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

    return filtered;
  }, [videos, selectedCategory, selectedType, sortBy]);

  const formatDuration = (duration?: string) => {
    if (!duration) return '';
    return duration;
  };

  const getVideoThumbnail = (video: Video) => {
    return video.poster_url || video.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMUExQTFBIi8+CjxwYXRoIGQ9Ik0xNTAgMTIwTDI1MCA4NVYyMTVMMTUwIDE4MFYxMjBaIiBmaWxsPSIjNEM0QzRDIi8+CjxjaXJjbGUgY3g9IjIwMCIgY3k9IjE1MCIgcj0iMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzRDNEM0QyIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjx0ZXh0IHg9IjIwMCIgeT0iMjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNEM0QzRDIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+VmlkZW88L3RleHQ+Cjwvc3ZnPgo=';
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* FIXED HEADER SECTION - Never scrolls */}
      <div className="flex-shrink-0 px-4 pt-4">
        {/* Compact Mobile Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pb-2"
        >
          <div className="relative overflow-hidden rounded-2xl glass-morphism shadow-lg">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-2 -left-2 w-8 h-8 bg-[#843c2d]/10 rounded-full blur-lg animate-pulse"></div>
              <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-[#ede8df]/10 rounded-full blur-md animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>
            
            <div className="relative p-2 sm:p-3">
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-[#ede8df] via-[#b2a491] to-[#ede8df] bg-clip-text text-transparent mb-0.5">
                Video Vault
              </h1>
              <div className="flex items-center space-x-2 text-xs sm:text-sm">
                <span className="text-[#b2a491]/80">Latest Collection</span>
                <span className="text-[#726d6c]/60">•</span>
                <span className="text-[#b2a491]/80">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Video Type Tabs and Sort */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="px-0 pb-2.5 space-y-2"
        >
          {/* Video Type Tabs */}
          <div className="glass-card rounded-2xl p-1">
            <div className="flex">
              <button
                onClick={() => setSelectedType('music-video')}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedType === 'music-video'
                    ? 'bg-[#843c2d] text-[#ede8df] shadow-lg'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]/50'
                }`}
              >
                Music Videos
              </button>
              <button
                onClick={() => setSelectedType('film')}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedType === 'film'
                    ? 'bg-[#843c2d] text-[#ede8df] shadow-lg'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]/50'
                }`}
              >
                Film
              </button>
            </div>
          </div>

          {/* Sort Options */}
          <div className="glass-card rounded-2xl p-1">
            <div className="flex gap-1">
              <button
                onClick={() => setSortBy('newest')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  sortBy === 'newest'
                    ? 'bg-[#843c2d] text-[#ede8df]'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]/50'
                }`}
              >
                Newest
              </button>
              <button
                onClick={() => setSortBy('oldest')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  sortBy === 'oldest'
                    ? 'bg-[#843c2d] text-[#ede8df]'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]/50'
                }`}
              >
                Oldest
              </button>
              <button
                onClick={() => setSortBy('title')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  sortBy === 'title'
                    ? 'bg-[#843c2d] text-[#ede8df]'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]/50'
                }`}
              >
                Title
              </button>
              <button
                onClick={() => setSortBy('duration')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  sortBy === 'duration'
                    ? 'bg-[#843c2d] text-[#ede8df]'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]/50'
                }`}
              >
                Duration
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* SCROLLABLE CONTENT AREA - Only this section scrolls */}
      <div className="flex-1 min-h-0 px-4 pb-24">
        <div className="h-full overflow-hidden rounded-2xl glass-surface border border-[#502d26]/20">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedCategory}-${selectedType}-${sortBy}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full overflow-y-auto scrollable-container p-4"
            >
              {filteredAndSortedVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {filteredAndSortedVideos.map((video) => (
                    <motion.div
                      key={video.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="group glass-surface rounded-2xl overflow-hidden border border-[#502d26]/30 hover:border-[#843c2d]/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[#843c2d]/10"
                    >
                      <Link href={`/media/${video.id}`} className="block">
                        <div className="aspect-video relative overflow-hidden">
                          <Image
                            src={getVideoThumbnail(video)}
                            alt={video.title}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full glass-surface flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <svg className="w-6 h-6 text-[#ede8df] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                          {video.duration && (
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded-md">
                              {formatDuration(video.duration)}
                            </div>
                          )}
                          {/* Video title overlaid on image */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-8">
                            <h3 className="text-sm font-semibold text-white group-hover:text-[#ede8df] transition-colors line-clamp-2 leading-tight">
                              {video.title}
                            </h3>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center py-8 space-y-4 max-w-sm">
                    <div className="w-16 h-16 mx-auto glass-surface rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-[#726d6c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-[#b2a491]">
                        {'No videos found'}
                      </h3>
                      <p className="text-sm text-[#726d6c] leading-relaxed">
                        {'Try adjusting your filters to find what you\'re looking for.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
