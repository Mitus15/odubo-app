'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import type { ClipItem } from '@/types/clips';

interface ClipsShowcaseProps {
  clips: ClipItem[];
  onClipClick?: (clip: ClipItem) => void;
}

export default function ClipsShowcase({ clips, onClipClick }: ClipsShowcaseProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10%' });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    };

    container.addEventListener('scroll', checkScroll);
    checkScroll();
    return () => container.removeEventListener('scroll', checkScroll);
  }, [clips]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.7;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!clips.length) return null;

  return (
    <section ref={ref} id="clips" className="relative py-24 px-8 bg-[#0d0c0a]">
      {/* Section Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[#843c2d] text-sm font-medium uppercase tracking-[0.2em] mb-2">
            Latest Clips
          </p>
          <h2 className="text-4xl xl:text-5xl font-bold text-[#ede8df]">
            Watch What's New
          </h2>
        </motion.div>
      </div>

      {/* Carousel */}
      <div className="relative max-w-7xl mx-auto">
        {/* Scroll Buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 glass-surface rounded-full flex items-center justify-center text-[#ede8df] hover:bg-[#843c2d]/20 transition-colors"
            aria-label="Scroll left"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 glass-surface rounded-full flex items-center justify-center text-[#ede8df] hover:bg-[#843c2d]/20 transition-colors"
            aria-label="Scroll right"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        {/* Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
        >
          {clips.map((clip, index) => (
            <motion.div
              key={clip.id}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="flex-none w-[320px] xl:w-[400px] snap-start"
            >
              <button
                onClick={() => onClipClick?.(clip)}
                className="group relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-[#1a1816]"
              >
                {clip.poster && (
                  <Image
                    src={clip.poster}
                    alt={clip.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="400px"
                  />
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-16 h-16 glass-surface rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#ede8df] ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Info */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-[#ede8df] font-semibold text-lg mb-1 line-clamp-2">
                    {clip.title}
                  </h3>
                  {clip.artist && (
                    <p className="text-[#ede8df]/60 text-sm">
                      {clip.artist}
                    </p>
                  )}
                  {clip.duration && (
                    <p className="text-[#ede8df]/40 text-xs mt-1">
                      {Math.floor(clip.duration / 60)}:{String(clip.duration % 60).padStart(2, '0')}
                    </p>
                  )}
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
