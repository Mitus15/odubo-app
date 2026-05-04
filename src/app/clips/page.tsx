"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import ClipsFeed from '@/components/clips/ClipsFeed';
import SingleVideoPlayer from '@/components/clips/SingleVideoPlayer';
import ClipsErrorBoundary from '@/components/clips/ClipsErrorBoundary';
import FilmGrain from '@/components/ui/FilmGrain';
import DesktopClipsGallery from '@/components/clips/DesktopClipsGallery';
import CinematicModal from '@/components/clips/CinematicModal';
import { useAudio } from '@/contexts/AudioContext';
import type { ClipItem } from '@/types/clips';

export default function ClipsPage() {
  const { isMuted, toggleMute } = useAudio();

  // Mobile state
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'forward' | 'backward' | null>(null);

  // Desktop state
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);
  const [allClips, setAllClips] = useState<ClipItem[]>([]);

  const scrollToNextRef = useRef<(() => void) | null>(null);

  const handleClipsReady = useCallback((newClips: ClipItem[], newActiveIndex: number) => {
    setClips(newClips);
    setActiveIndex(newActiveIndex);
  }, []);

  const handleAdvanceToNext = useCallback(() => {
    scrollToNextRef.current?.();
  }, []);

  const handleClipClick = useCallback((clip: ClipItem) => {
    setSelectedClip(clip);
  }, []);

  const handleModalNavigate = useCallback((clip: ClipItem) => {
    setSelectedClip(clip);
  }, []);

  const handleAllClipsReady = useCallback((loadedClips: ClipItem[]) => {
    setAllClips(loadedClips);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="relative bg-black text-[#ede8df] h-[100dvh] overflow-hidden">
      <FilmGrain opacity={0.03} />

      {/* DEBUG: Big red text top of clips page */}
      <div className="fixed top-0 left-0 right-0 z-[9999] text-center py-2 bg-red-600 text-white text-2xl font-bold pointer-events-none">
        CLIPS PAGE DESKTOP TEST - CAN YOU SEE THIS?
      </div>

      <ClipsErrorBoundary>
        {/* MOBILE: Full-screen TikTok feed */}
        <div className="lg:hidden">
          {clips.length > 0 && (
            <SingleVideoPlayer
              clips={clips}
              activeIndex={activeIndex}
              onVideoReady={setVideoReady}
              scrollDirection={scrollDirection}
              onAdvanceToNext={handleAdvanceToNext}
              onWatchMilestone={() => {}}
              onWatchComplete={() => {}}
            />
          )}
          <div className="fixed inset-0 bg-transparent z-20" style={{ overscrollBehavior: 'none' }}>
            <ClipsFeed
              navHeight={0}
              onClipsReady={handleClipsReady}
              onScrollDirectionChange={setScrollDirection}
              videoReady={videoReady}
              scrollToNextRef={scrollToNextRef}
            />
          </div>
          <button
            onClick={toggleMute}
            className="fixed z-40 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white shadow-lg active:scale-90 transition-transform"
            style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', right: 12, width: 44, height: 44, touchAction: 'manipulation' }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            )}
          </button>
          <a href="/" className="fixed z-40 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/80 shadow-lg active:scale-90 transition-transform no-underline" style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', left: 12, width: 44, height: 44, touchAction: 'manipulation' }} aria-label="Back to home">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </a>
        </div>

        {/* DESKTOP: Gallery with natural aspect ratios */}
        <div className="hidden lg:block">
          <DesktopClipsGallery
            onClipClick={handleClipClick}
            onClipsLoaded={handleAllClipsReady}
          />
        </div>
      </ClipsErrorBoundary>

      <CinematicModal
        clip={selectedClip}
        allClips={allClips}
        onClose={() => setSelectedClip(null)}
        onNavigate={handleModalNavigate}
      />
    </div>
  );
}
