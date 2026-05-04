'use client';

import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import type { Track, Album } from '@/types/music';

interface MusicZoneProps {
  albums: Album[];
  tracks: Track[];
  onPlayTrack?: (track: Track) => void;
}

export default function MusicZone({ albums, tracks, onPlayTrack }: MusicZoneProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10%' });
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  const featuredAlbum = albums.find(a => a.featured) || albums[0];

  if (!featuredAlbum) return null;

  return (
    <section ref={ref} id="music" className="relative py-24 px-8 bg-[#0d0c0a]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-[#843c2d] text-sm font-medium uppercase tracking-[0.2em] mb-2">
            Latest Release
          </p>
          <h2 className="text-4xl xl:text-5xl font-bold text-[#ede8df]">
            {featuredAlbum.title}
          </h2>
        </motion.div>

        {/* Album + Tracks Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Album Art */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-5"
          >
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#1a1816] shadow-2xl shadow-black/40">
              {featuredAlbum.cover_art_url ? (
                <Image
                  src={featuredAlbum.cover_art_url}
                  alt={featuredAlbum.title}
                  fill
                  className="object-cover"
                  sizes="50vw"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-32 h-32 text-[#502d26]/30" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Album Info */}
            <div className="mt-6">
              <p className="text-[#ede8df]/60 text-sm">
                {featuredAlbum.release_type?.toUpperCase()}
                {featuredAlbum.release_date && ` • ${new Date(featuredAlbum.release_date).getFullYear()}`}
              </p>
              {featuredAlbum.description && (
                <p className="text-[#ede8df]/40 text-sm mt-2 line-clamp-3">
                  {featuredAlbum.description}
                </p>
              )}
            </div>
          </motion.div>

          {/* Track List */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-7"
          >
            <div className="space-y-2">
              {tracks.slice(0, 8).map((track, index) => {
                const isActive = activeTrackId === track.id;
                return (
                  <motion.button
                    key={track.id}
                    onClick={() => {
                      setActiveTrackId(isActive ? null : track.id);
                      onPlayTrack?.(track);
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-[#843c2d]/10 border border-[#843c2d]/20'
                        : 'hover:bg-[#1a1816] border border-transparent'
                    }`}
                  >
                    {/* Track Number / Playing Indicator */}
                    <div className="w-8 text-center">
                      {isActive ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <motion.div
                            animate={{ scaleY: [0.4, 1, 0.4] }}
                            transition={{ duration: 0.6, repeat: Infinity }}
                            className="w-0.5 h-4 bg-[#843c2d]"
                          />
                          <motion.div
                            animate={{ scaleY: [0.6, 1, 0.6] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                            className="w-0.5 h-4 bg-[#843c2d]"
                          />
                          <motion.div
                            animate={{ scaleY: [0.3, 1, 0.3] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                            className="w-0.5 h-4 bg-[#843c2d]"
                          />
                        </div>
                      ) : (
                        <span className="text-[#ede8df]/30 text-sm group-hover:text-[#ede8df]/60">
                          {track.track_number}
                        </span>
                      )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 text-left">
                      <p className={`font-medium ${isActive ? 'text-[#843c2d]' : 'text-[#ede8df]'}`}>
                        {track.title}
                      </p>
                      {track.audio_status === 'ready' && track.preview_url && (
                        <p className="text-[#ede8df]/40 text-xs mt-0.5">
                          Preview available
                        </p>
                      )}
                    </div>

                    {/* Duration */}
                    <span className="text-[#ede8df]/30 text-sm">
                      {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '--:--'}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
