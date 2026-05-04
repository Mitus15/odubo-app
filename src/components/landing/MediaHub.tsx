'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';

interface Video {
  id: number;
  title: string;
  description?: string;
  poster_url?: string;
  thumbnail?: string;
  uid?: string;
  url?: string;
  mp4_url?: string;
  duration_seconds?: number;
  created_at?: string;
}

interface MediaHubProps {
  videos: Video[];
}

export default function MediaHub({ videos }: MediaHubProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10%' });

  const featuredVideo = videos[0];
  const libraryVideos = videos.slice(1, 7);

  if (!videos.length) return null;

  return (
    <section ref={ref} id="media" className="relative py-24 px-8 bg-[#0d0c0a]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-[#843c2d] text-sm font-medium uppercase tracking-[0.2em] mb-2">
            Media Hub
          </p>
          <h2 className="text-4xl xl:text-5xl font-bold text-[#ede8df]">
            Long-Form Content
          </h2>
        </motion.div>

        {/* Featured Video */}
        {featuredVideo && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <button
              className="group relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-[#1a1816]"
            >
              {featuredVideo.poster_url ? (
                <Image
                  src={featuredVideo.poster_url}
                  alt={featuredVideo.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="80vw"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#843c2d]/20 to-[#1a1816]" />
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* Play Button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-20 h-20 glass-surface rounded-full flex items-center justify-center"
                >
                  <svg className="w-10 h-10 text-[#ede8df] ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </motion.div>
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h3 className="text-[#ede8df] text-2xl font-semibold mb-2">
                  {featuredVideo.title}
                </h3>
                {featuredVideo.description && (
                  <p className="text-[#ede8df]/60 text-sm line-clamp-2 max-w-2xl">
                    {featuredVideo.description}
                  </p>
                )}
                {featuredVideo.duration_seconds && (
                  <p className="text-[#ede8df]/40 text-xs mt-2">
                    {Math.floor(featuredVideo.duration_seconds / 60)}:{String(featuredVideo.duration_seconds % 60).padStart(2, '0')}
                  </p>
                )}
              </div>
            </button>
          </motion.div>
        )}

        {/* Video Library Grid */}
        {libraryVideos.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {libraryVideos.map((video, index) => (
              <motion.button
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.05 }}
                className="group relative aspect-video rounded-xl overflow-hidden bg-[#1a1816]"
              >
                {video.poster_url ? (
                  <Image
                    src={video.poster_url}
                    alt={video.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="33vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#502d26]/20 to-[#1a1816]" />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 glass-surface rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#ede8df] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h4 className="text-[#ede8df] text-sm font-medium line-clamp-2 mb-1">
                    {video.title}
                  </h4>
                  {video.duration_seconds && (
                    <p className="text-[#ede8df]/40 text-xs">
                      {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
                    </p>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
