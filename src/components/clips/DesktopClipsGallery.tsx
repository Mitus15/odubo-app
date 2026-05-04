"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { ClipItem, ClipApiRow } from '@/types/clips';
import { mapClipRows } from '@/lib/clipsMapper';
import type { SortMode } from '@/components/clips/ClipFeedMenu';

interface DesktopClipsGalleryProps {
  onClipClick: (clip: ClipItem) => void;
  onClipsLoaded?: (clips: ClipItem[]) => void;
}

const PAGE_SIZE = 20;

export default function DesktopClipsGallery({ onClipClick, onClipsLoaded }: DesktopClipsGalleryProps) {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('shuffle');
  const [filterParentId, setFilterParentId] = useState<number | null>(null);
  const [parentVideos, setParentVideos] = useState<Array<{ id: number; title: string }>>([]);

  const pageRef = useRef(0);
  const inflightRef = useRef(0);
  const sessionSeedRef = useRef(Math.random().toString(36).substring(2, 12));
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (p: number) => {
    if (inflightRef.current > 0) return;
    inflightRef.current++;
    if (p === 0) setLoading(true);
    setError('');

    try {
      const url = new URL('/api/clips', window.location.origin);
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(p * PAGE_SIZE));

      if (sortMode === 'shuffle') {
        url.searchParams.set('seed', sessionSeedRef.current);
      }
      if (sortMode !== 'shuffle') {
        url.searchParams.set('sort', sortMode);
      }
      if (filterParentId) {
        url.searchParams.set('parentId', String(filterParentId));
      }

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      const data = await res.json().catch(() => ({})) as { error?: string; clips?: ClipApiRow[]; hasMore?: boolean };
      if (!res.ok) throw new Error(data?.error || 'Failed to load clips');

      const rows: ClipApiRow[] = Array.isArray(data?.clips) ? data.clips : [];
      const mapped = mapClipRows(rows);

      setClips(prev => p === 0 ? mapped : [...prev, ...mapped]);
      setHasMore(data.hasMore ?? mapped.length === PAGE_SIZE);
      pageRef.current = p;
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || String(e));
      }
    } finally {
      inflightRef.current--;
      setLoading(false);
    }
  }, [sortMode, filterParentId]);

  useEffect(() => {
    if (clips.length > 0 && onClipsLoaded) {
      onClipsLoaded(clips);
    }
  }, [clips, onClipsLoaded]);

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  useEffect(() => {
    fetch('/api/clips/parents')
      .then(res => res.json() as Promise<{ parents?: Array<{ id: number; title: string }> }>)
      .then((data) => {
        if (data.parents) setParentVideos(data.parents);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    sessionSeedRef.current = Math.random().toString(36).substring(2, 12);
    pageRef.current = 0;
    setClips([]);
    setHasMore(true);
    fetchPage(0);
  }, [sortMode, filterParentId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && inflightRef.current === 0) {
          fetchPage(pageRef.current + 1);
        }
      },
      { root: container, rootMargin: '400px' }
    );

    const sentinel = container.querySelector('.scroll-sentinel');
    if (sentinel) observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, fetchPage]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-semibold text-white/90">Clips</h1>
          <div className="flex items-center gap-2">
            {(['shuffle', 'newest', 'oldest', 'popular'] as SortMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  sortMode === mode
                    ? 'bg-white/15 text-white/90'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {parentVideos.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => setFilterParentId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filterParentId === null
                  ? 'bg-white/15 text-white/90'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
              }`}
            >
              All Videos
            </button>
            {parentVideos.map(p => (
              <button
                key={p.id}
                onClick={() => setFilterParentId(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all truncate max-w-[160px] ${
                  filterParentId === p.id
                    ? 'bg-white/15 text-white/90'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable gallery */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-hide"
      >
        {loading && clips.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-white/60">
              <div className="w-10 h-10 border-3 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <p className="text-sm">Loading clips...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button onClick={() => { setError(''); fetchPage(0); }} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors">
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="desktop-clips-gallery">
              {clips.map((clip, index) => (
                <GalleryClipCard
                  key={`${clip.id}-${index}`}
                  clip={clip}
                  index={index}
                  onClick={onClipClick}
                />
              ))}
            </div>
            <div className="scroll-sentinel h-1" />
            {hasMore && clips.length > 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GalleryClipCard({ clip, index, onClick }: { clip: ClipItem; index: number; onClick: (clip: ClipItem) => void }) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoUrl = clip.mp4Url || clip.hlsUrl || null;

  // Detect aspect ratio from poster image
  useEffect(() => {
    if (!clip.poster) {
      setAspectRatio(9 / 16);
      return;
    }
    const img = document.createElement('img');
    img.onload = () => {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => {
      setAspectRatio(9 / 16);
    };
    img.src = clip.poster;
  }, [clip.poster]);

  // Auto-play muted on hover
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    if (isHovered && !video.src) {
      video.src = videoUrl;
      video.muted = true;
      video.play().then(() => {
        setIsPlaying(true);
        setHasLoaded(true);
      }).catch(() => {});
    } else if (!isHovered) {
      video.pause();
      video.src = '';
      setIsPlaying(false);
    }

    return () => {
      video.pause();
    };
  }, [isHovered, videoUrl]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const aspectStyle = aspectRatio ? { aspectRatio: `${aspectRatio}` } : { aspectRatio: '9/16' };

  return (
    <motion.div
      className="gallery-clip-card cursor-pointer"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.6), ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.02, y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onClick(clip)}
    >
      <div className="relative overflow-hidden rounded-xl" style={aspectStyle}>
        {/* Video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          loop
          preload="none"
        />

        {/* Poster */}
        {clip.poster && (
          <Image
            src={clip.poster}
            alt={clip.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 20vw"
            className={`object-cover transition-opacity duration-300 ${hasLoaded ? 'opacity-0' : 'opacity-100'}`}
            priority={index < 8}
          />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

        {/* Hover glow */}
        <div className={`absolute inset-0 rounded-xl transition-opacity duration-300 pointer-events-none ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          style={{ boxShadow: '0 0 30px rgba(255, 180, 120, 0.1), 0 0 60px rgba(120, 180, 255, 0.08)' }}
        />

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-3 z-10">
          {clip.duration && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 text-xs font-mono">
              {formatDuration(clip.duration)}
            </div>
          )}

          <h3 className="text-white font-medium text-sm leading-tight mb-0.5 line-clamp-2 clip-title-glass">
            {clip.title}
          </h3>
          {(clip.artist || clip.parentTitle) && (
            <p className="text-white/50 text-xs line-clamp-1 clip-subtitle-glass">
              {clip.artist || clip.parentTitle}
            </p>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 mt-1.5">
            {clip.viewCount !== undefined && clip.viewCount > 0 && (
              <span className="text-white/40 text-[10px]">
                {clip.viewCount > 999 ? `${(clip.viewCount / 1000).toFixed(1)}k` : clip.viewCount} views
              </span>
            )}
            {clip.productHandle && (
              <span className="text-white/40 text-[10px] flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                Shop
              </span>
            )}
          </div>
        </div>

        {/* Play icon on hover */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={false}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {!isPlaying && (
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
