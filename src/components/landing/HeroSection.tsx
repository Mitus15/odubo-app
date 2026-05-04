'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ClipItem, VerseOfTheDay } from '@/types/clips';
import WaterfallClipGrid from './WaterfallClipGrid';
import { getFeaturedClip } from '@/lib/homepageHelpers';

interface HeroSectionProps {
  initialClips: ClipItem[];
  verseOfTheDay: VerseOfTheDay;
}

export default function HeroSection({ 
  initialClips, 
  verseOfTheDay 
}: HeroSectionProps) {
  const [clips, setClips] = useState<ClipItem[]>(initialClips);
  const [featuredClipId, setFeaturedClipId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Select a featured clip (could be based on engagement, recency, or random)
  useEffect(() => {
    if (clips.length === 0) return;
    
    // Try to get a featured clip from helpers, fallback to first clip
    const featured = getFeaturedClip(clips);
    setFeaturedClipId(featured?.id || clips[0].id);
    
    // Load more clips in background
    setLoading(true);
    // In a real implementation, we might fetch more clips here
    // For now, we'll work with what we have
    setTimeout(() => setLoading(false), 100);
  }, [clips]);

  const handleClipClick = (clip: ClipItem) => {
    // In a full implementation, this would open a clip player modal
    // or navigate to a dedicated clip page
    console.log('Clip clicked:', clip);
    // For now, we'll just log - actual implementation would use routing or modal
  };

  if (clips.length === 0) {
    return (
      <section className="relative h-screen w-full overflow-hidden bg-[#0d0c0a]">
        <div className="flex items-center justify-center h-full">
          <p className="text-white/40">Loading clips...</p>
        </div>
      </section>
    );
  }

  return (
    <section 
      id="hero"
      className="relative h-screen w-full overflow-hidden bg-[#0d0c0a]"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-8 pt-8 pb-4 bg-gradient-to-b from-[#0d0c0a] via-[#0d0c0a]/80 to-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl xl:text-4xl font-bold text-[#ede8df]"
            >
              Odubo Studio
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[#ede8df]/40 text-sm mt-1"
            >
              Music, clips, shop.
            </motion.p>
          </div>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onClick={() => {
              // Navigate to clips section or open explore mode
              console.log('Explore clips clicked');
            }}
            className="px-6 py-3 bg-[#843c2d] text-[#ede8df] text-sm font-medium rounded-full hover:bg-[#9a4535] transition-colors"
          >
            Explore Clips
          </motion.button>
        </div>
      </div>

      {/* Main Content: Featured Clip + Waterfall Grid */}
      <div className="relative h-full flex flex-col">
        {/* Featured Clip Area (Top 20%) */}
        <div className="flex-0 w-full flex items-center justify-center pt-28">
          <div className="relative w-[70%] max-w-4xl">
            <WaterfallClipGrid
              clips={clips}
              featuredClipId={featuredClipId}
              onClipClick={handleClipClick}
              className="h-[320px]"
            />
          </div>
        </div>
        
        {/* Waterfall Grid Area (Remaining 80%) */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="relative h-full">
            <WaterfallClipGrid
              clips={clips}
              featuredClipId={featuredClipId}
              onClipClick={handleClipClick}
              className="h-full"
            />
            
            {/* Loading indicator for grid section */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0d0c0a]/50">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Verse Interlude (positioned over bottom of hero) */}
      {verseOfTheDay?.text && (
        <div className="absolute bottom-16 left-0 right-0 z-20 flex items-center justify-center px-8 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center"
          >
            <p className="text-[#ede8df]/60 text-xl font-light italic max-w-2xl">
              “{verseOfTheDay.text}”
            </p>
            {verseOfTheDay.reference && (
              <p className="text-[#ede8df]/40 text-sm mt-2">
                — {verseOfTheDay.reference}
              </p>
            )}
          </motion.div>
        </div>
      )}
    </section>
  );
}