'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';

interface ClipsHeaderProps {
  isMuted: boolean;
  onMuteToggle: () => void;
  versePhase: 'collapsed' | 'expanded';
  onVerseClick: (e: React.MouseEvent) => void;
  onConnectClick: () => void;
}

/**
 * ClipsHeader — Minimal glass header bar for the clips page (mobile only).
 *
 * Layout:
 * - Left: odubo logo
 * - Right: Words button | Mute button | Connect button
 */
export default function ClipsHeader({
  isMuted,
  onMuteToggle,
  versePhase,
  onVerseClick,
  onConnectClick,
}: ClipsHeaderProps) {
  return (
    <header
      className="fixed left-0 right-0 z-40 md:hidden bg-black/30 backdrop-blur-xl border-b border-white/5"
      style={{
        top: 0,
        paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
      }}
    >
      <div className="flex items-center justify-between px-3 h-12">
        {/* Left — Logo */}
        <Image
           src="/brand-logos/Danceman_Logo_Red.png"
          alt="Odubo"
          width={28}
          height={28}
          className="h-6 w-auto opacity-80"
        />

        {/* Right — Action buttons */}
        <div className="flex items-center gap-1">
          {/* Words / Verse button */}
          <AnimatePresence mode="wait">
            <motion.button
              key={versePhase}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={onVerseClick}
              className="flex items-center justify-center rounded-full active:scale-90 transition-transform"
              style={{
                width: 36,
                height: 36,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label={versePhase === 'expanded' ? 'Close verse' : 'Show verse'}
            >
              {versePhase === 'expanded' ? (
                <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </motion.button>
          </AnimatePresence>

          {/* Mute button */}
          <button
            onClick={onMuteToggle}
            className="flex items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{
              width: 36,
              height: 36,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>

          {/* Connect button */}
          <button
            onClick={onConnectClick}
            className="flex items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{
              width: 36,
              height: 36,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Connect"
          >
            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
