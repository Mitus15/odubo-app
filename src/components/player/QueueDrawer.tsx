"use client";

import React, { useMemo, useRef, useState } from "react";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QueueDrawer({ isOpen, onClose }: Props) {
  const { state, playFromQueue, removeFromQueue, reorderQueue } = useMusicPlayer();

  // Split into Now Playing and Up Next
  const nowIndex = state.currentIndex;
  const nowPlaying = nowIndex >= 0 ? state.queue[nowIndex] : null;
  const upNext = useMemo(() => state.queue.slice(Math.max(0, nowIndex + 1)), [state.queue, nowIndex]);

  // Drag state for Up Next items (indices relative to full queue)
  const [dragging, setDragging] = useState<{ from: number; over: number } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const startDrag = (fromGlobalIndex: number) => setDragging({ from: fromGlobalIndex, over: fromGlobalIndex });
  const onMove = (clientY: number) => {
    if (!dragging || !listRef.current) return;
    const items = Array.from(listRef.current.querySelectorAll<HTMLDivElement>("[data-q-index]"));
    for (const el of items) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY < rect.bottom) {
        const overIndex = Number(el.dataset.qIndex);
        if (!Number.isNaN(overIndex) && overIndex !== dragging.over) {
          setDragging({ from: dragging.from, over: overIndex });
        }
        break;
      }
    }
  };
  const endDrag = () => {
    if (!dragging) return;
    // Constrain both indices to be after currentIndex
    const minIdx = nowIndex + 1;
    const from = Math.max(minIdx, dragging.from);
    const to = Math.max(minIdx, dragging.over);
    if (from !== to) reorderQueue(from, to);
    setDragging(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-[90%] max-w-md bg-gradient-to-br from-[#302927] to-[#171616] border-l border-[#502d26]/40"
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
              {/* Now Playing */}
              {nowPlaying && (
                <div className="px-4 py-3 border-b border-[#502d26]/30 bg-[#843c2d]/15">
                  <div className="text-xs uppercase tracking-wider text-[#b2a491] mb-2">Now Playing</div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 text-center text-[#ede8df]">♪</div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[#ede8df] font-medium">{nowPlaying.title}</div>
                      <div className="text-[#726d6c] text-xs truncate">{state.currentAlbum?.artist_name || 'Unknown Artist'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Up Next (reorderable) */}
              <div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-[#b2a491]">Up Next</div>
              <div ref={listRef} className="pb-8">
                {upNext.length === 0 && (
                  <div className="px-4 py-2 text-[#726d6c] text-sm">No upcoming tracks</div>
                )}
                {upNext.map((track, i) => {
                  const globalIndex = nowIndex + 1 + i;
                  const isDragging = dragging && dragging.from === globalIndex;
                  const isOver = dragging && dragging.over === globalIndex;
                  return (
                    <div
                      key={`${track.id}-${globalIndex}`}
                      data-q-index={globalIndex}
                      className={`px-4 py-3 border-b border-[#502d26]/20 transition-colors relative ${isOver ? 'bg-[#302927]/50' : 'hover:bg-[#302927]/30'}`}
                      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startDrag(globalIndex); }}
                      onPointerMove={(e) => dragging && onMove(e.clientY)}
                      onPointerUp={(e) => { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); endDrag(); }}
                      onPointerCancel={() => setDragging(null)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="w-6 h-6 flex items-center justify-center text-[#726d6c] cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4h4v2h-4V4zm0 14h4v2h-4v-2zM4 10h2v4H4v-4zm14 0h2v4h-2v-4zM7 7h2v2H7V7zm8 0h2v2h-2V7zM7 15h2v2H7v-2zm8 0h2v2h-2v-2z"/></svg>
                        </button>
                        <div className="w-6 text-center text-[#726d6c] text-sm">{globalIndex + 1}</div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => playFromQueue(globalIndex)}>
                          <div className="truncate text-[#b2a491]">{track.title}</div>
                          <div className="text-[#726d6c] text-xs truncate">{state.currentAlbum?.artist_name || 'Unknown Artist'}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => reorderQueue(globalIndex, Math.max(nowIndex + 1, globalIndex - 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927]/50 transition-colors"
                            aria-label="Move up"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
                          </button>
                          <button
                            onClick={() => reorderQueue(globalIndex, Math.min(state.queue.length - 1, globalIndex + 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927]/50 transition-colors"
                            aria-label="Move down"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>
                          </button>
                          <button onClick={() => removeFromQueue(globalIndex)} className="w-8 h-8 flex items-center justify-center rounded-full text-[#726d6c] hover:text-red-400 hover:bg-[#302927]/50 transition-colors" aria-label="Remove from queue">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                          </button>
                        </div>
                      </div>
                      {isDragging && (
                        <div className="absolute inset-0 border-2 border-dashed border-[#843c2d]/60 rounded-md pointer-events-none" />
                      )}
                      {dragging && dragging.over === globalIndex && dragging.from !== dragging.over && (
                        <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-[#843c2d]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
