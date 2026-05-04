'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ClipItem } from '@/types/clips';
import AmbientClipCard from './AmbientClipCard';
import FocusedClipCard from './FocusedClipCard';

interface WaterfallClipGridProps {
  clips: ClipItem[];
  featuredClipId?: number | null;
  onClipClick: (clip: ClipItem) => void;
}

export default function WaterfallClipGrid({ 
  clips, 
  featuredClipId = null, 
  onClipClick 
}: WaterfallClipGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleItems, setVisibleItems] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const PAGE_SIZE = 24; // Number of clips to load per batch

  // Find the featured clip
  const featuredClip = clips.find(clip => clip.id === featuredClipId);
  const otherClips = clips.filter(clip => clip.id !== featuredClipId);

  // Load initial batch
  useEffect(() => {
    loadMoreClips();
  }, []);

  const loadMoreClips = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    
    try {
      // Simulate loading more clips - in reality, this would fetch from API
      // For now, we'll work with what we have in the clips array
      const startIndex = pageRef.current * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const newClips = otherClips.slice(startIndex, endIndex);
      
      if (newClips.length === 0) {
        setHasMore(false);
        return;
      }
      
      setVisibleItems(prev => [...prev, ...newClips]);
      pageRef.current += 1;
      
      // Check if we've loaded all clips
      if (endIndex >= otherClips.length) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more clips:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, otherClips, PAGE_SIZE]);

  // Intersection observer for loading more clips when user scrolls near bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          loadMoreClips();
        }
      },
      { root: container, rootMargin: '200px' }
    );

    const sentinel = document.createElement('div');
    sentinel.className = 'scroll-sentinel';
    container.appendChild(sentinel);
    
    observer.observe(sentinel);
    
    return () => {
      observer.disconnect();
      if (sentinel.parentNode) {
        sentinel.parentNode.removeChild(sentinel);
      }
    };
  }, [hasMore, loading, loadMoreClips]);

  // Determine which clips are near viewport for video playback optimization
  // This is a simplified version - in practice, you'd want to calculate actual viewport positions
  const getClipViewportStatus = useCallback((index: number): boolean => {
    // Simple heuristic: clips near the center of the visible array are more likely to be in viewport
    const centerIndex = Math.floor(visibleItems.length / 2);
    const distanceFromCenter = Math.abs(index - centerIndex);
    const viewportBuffer = Math.floor(visibleItems.length * 0.3); // 30% buffer around center
    
    return distanceFromCenter <= viewportBuffer;
  }, [visibleItems]);

  if (clips.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/40">No clips available</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="relative waterfall-grid pt-8"
      style={{ 
        // Add subtle ambient animation to container
        position: 'relative'
      }}
    >
      {/* Featured clip at the top */}
      {featuredClip && (
        <div className="mb-12">
          <FocusedClipCard 
            clip={featuredClip} 
            onClipClick={onClipClick} 
          />
        </div>
      )}
      
      {/* Waterfall grid container */}
      <div className="grid grid-cols-[25%_20%_30%_25%] gap-6">
        {/* Render clips in asymmetric layout */}
        {visibleItems.map((clip, index) => {
          // Calculate position in the asymmetric grid
          // This creates a Masonry-like layout by distributing items across columns
          const columnIndex = index % 4;
          
          // Determine if clip should be tall (spanning multiple rows) based on position
          // This creates the asymmetric/waterfall effect
          const isTall = 
            (columnIndex === 0 && index % 3 === 0) ||  // First column: every 3rd item is tall
            (columnIndex === 1 && index % 4 === 1) ||  // Second column: every 4th item is tall
            (columnIndex === 2 && index % 5 === 2) ||  // Third column: every 5th item is tall
            (columnIndex === 3 && index % 6 === 3);    // Fourth column: every 6th item is tall
            
          const isNearViewport = getClipViewportStatus(index);
          
          return (
            <div 
              key={clip.id} 
              className={`relative ${isTall ? 'row-span-2' : 'row-span-1'} `}
              style={{
                // Add subtle stagger animation based on position
                transitionDelay: `${index * 0.03}s`
              }}
            >
              <AmbientClipCard 
                clip={clip} 
                index={index} 
                isNearViewport={isNearViewport} 
              />
            </div>
          );
        })}
        
        {/* Loading indicator */}
        {loading && hasMore && visibleItems.length > 0 && (
          <div className="col-span-4 flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
        
        {/* End indicator */}
        {!hasMore && visibleItems.length > 0 && !loading && (
          <div className="col-span-4 text-center py-6 text-white/40">
            <p>That's all for now</p>
          </div>
        )}
      </div>
    </div>
  );
}