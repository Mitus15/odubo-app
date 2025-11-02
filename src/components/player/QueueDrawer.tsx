'use client';

import React from 'react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QueueDrawer({ isOpen, onClose }: Props) {
  const { state, playFromQueue, removeFromQueue } = useMusicPlayer();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-[85%] max-w-md bg-gradient-to-br from-[#302927] to-[#171616] border-l border-[#502d26]/40"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
          >
            <div className="p-4 border-b border-[#502d26]/40 flex items-center justify-between">
              <h2 className="text-[#ede8df] font-medium">Queue</h2>
              <button onClick={onClose} className="text-[#b2a491] hover:text-[#ede8df] transition-colors" aria-label="Close queue">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-full">
              {state.queue.map((track, index) => {
                const isCurrent = index === state.currentIndex;
                return (
                  <div key={`${track.id}-${index}`} className={`px-4 py-3 border-b border-[#502d26]/20 ${isCurrent ? 'bg-[#843c2d]/20' : 'hover:bg-[#302927]/30'} transition-colors`}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 text-center text-[#726d6c] text-sm">{isCurrent ? '♪' : index + 1}</div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => playFromQueue(index)}>
                        <div className={`truncate ${isCurrent ? 'text-[#ede8df] font-medium' : 'text-[#b2a491]'}`}>{track.title}</div>
                        <div className="text-[#726d6c] text-xs truncate">{state.currentAlbum?.artist_name || 'Unknown Artist'}</div>
                      </div>
                      {!isCurrent && (
                        <button onClick={() => removeFromQueue(index)} className="w-8 h-8 flex items-center justify-center rounded-full text-[#726d6c] hover:text-red-400 hover:bg-[#302927]/50 transition-colors" aria-label="Remove from queue">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
