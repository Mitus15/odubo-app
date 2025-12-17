"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { Track, Album } from "@/types/music";
import Image from "next/image";

type Tab = 'queue' | 'history' | 'browse';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QueueDrawer({ isOpen, onClose }: Props) {
  const {
    state,
    playFromQueue,
    removeFromQueue,
    reorderQueue,
    playTrack,
    addToQueue,
    clearQueue,
    clearHistory,
    shuffleQueue,
    shuffleAllLibrary,
  } = useMusicPlayer();

  const [tab, setTab] = useState<Tab>('queue');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumTracks, setAlbumTracks] = useState<Track[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Split into Now Playing and Up Next
  const nowIndex = state.currentIndex;
  const nowPlaying = nowIndex >= 0 ? state.queue[nowIndex] : null;
  const upNext = useMemo(() => state.queue.slice(Math.max(0, nowIndex + 1)), [state.queue, nowIndex]);

  // Drag state
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
    const minIdx = nowIndex + 1;
    const from = Math.max(minIdx, dragging.from);
    const to = Math.max(minIdx, dragging.over);
    if (from !== to) reorderQueue(from, to);
    setDragging(null);
  };

  // Load albums when browse tab is selected
  useEffect(() => {
    if (tab === 'browse' && albums.length === 0 && !loadingAlbums) {
      setLoadingAlbums(true);
      fetch('/api/albums')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAlbums(data);
        })
        .catch(() => {})
        .finally(() => setLoadingAlbums(false));
    }
  }, [tab, albums.length, loadingAlbums]);

  // Load tracks when album is selected
  useEffect(() => {
    if (!selectedAlbum) {
      setAlbumTracks([]);
      return;
    }
    setLoadingTracks(true);
    fetch(`/api/albums/${selectedAlbum.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.tracks && Array.isArray(data.tracks)) {
          setAlbumTracks(data.tracks);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTracks(false));
  }, [selectedAlbum]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const handlePlayFromHistory = (entry: { track: Track; album: Album | null }) => {
    if (!entry.track.audio_url) return;
    playTrack(entry.track, entry.album || undefined, [entry.track], 0);
  };

  const handleAddTrackToQueue = (track: Track) => {
    if (!track.audio_url) return;
    addToQueue([track]);
  };

  const handleAddAlbumToQueue = () => {
    if (!selectedAlbum || albumTracks.length === 0) return;
    const playable = albumTracks.filter(t => t.audio_url);
    if (playable.length > 0) addToQueue(playable);
  };

  const handlePlayAlbum = (album: Album, tracks: Track[], startIndex = 0) => {
    const playable = tracks.filter(t => t.audio_url);
    if (playable.length === 0) return;
    const track = playable[startIndex] || playable[0];
    playTrack(track, album, playable, playable.findIndex(t => t.id === track.id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-[90%] max-w-md bg-[#171616] border-l border-[#502d26]/40 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#502d26]/40 flex items-center justify-between">
          <h2 className="text-[#ede8df] font-medium">Queue</h2>
          <button onClick={onClose} className="text-[#b2a491] hover:text-[#ede8df] transition-colors">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="p-3 border-b border-[#502d26]/30">
          <div className="inline-flex p-1 rounded-xl bg-[#1a1918]/80 border border-[#502d26]/30 backdrop-blur-sm w-full">
            {(['queue', 'history', 'browse'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelectedAlbum(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? 'bg-gradient-to-r from-[#843c2d] via-[#9a4535] to-[#6d3224] text-[#f8f2ea] shadow-lg shadow-[#843c2d]/25'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-white/5'
                }`}
              >
                {t === 'queue' ? 'Queue' : t === 'history' ? 'History' : 'Browse'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'queue' && (
            <div className="flex flex-col h-full">
              {/* Shuffle controls */}
              <div className="px-4 py-3 flex items-center gap-2 border-b border-[#502d26]/20">
                <button
                  onClick={shuffleQueue}
                  disabled={state.queue.length <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#302927] text-[#b2a491] hover:text-[#ede8df] disabled:opacity-40 transition-colors"
                >
                  Shuffle Queue
                </button>
                <button
                  onClick={shuffleAllLibrary}
                  disabled={state.libraryTracks.length === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#302927] text-[#b2a491] hover:text-[#ede8df] disabled:opacity-40 transition-colors"
                >
                  Shuffle All
                </button>
                {state.queue.length > 0 && (
                  <button
                    onClick={clearQueue}
                    className="ml-auto px-3 py-1.5 text-xs font-medium rounded-full text-[#726d6c] hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Now Playing */}
              {nowPlaying && (
                <div className="px-4 py-3 border-b border-[#502d26]/30 bg-[#843c2d]/10">
                  <div className="text-xs uppercase tracking-wider text-[#843c2d] mb-2">Now Playing</div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#302927] overflow-hidden flex-shrink-0">
                      {state.currentAlbum?.cover_art_url ? (
                        <Image
                          src={state.currentAlbum.cover_art_url}
                          alt=""
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[#ede8df] font-medium text-sm">{nowPlaying.title}</div>
                      <div className="text-[#726d6c] text-xs truncate">{state.currentAlbum?.artist_name}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Up Next */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-[#726d6c]">
                  Up Next ({upNext.length})
                </div>
                <div ref={listRef} className="pb-8">
                  {upNext.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[#726d6c] text-sm">
                      Queue is empty
                    </div>
                  ) : (
                    upNext.map((track, i) => {
                      const globalIndex = nowIndex + 1 + i;
                      const isDragging = dragging && dragging.from === globalIndex;
                      const isOver = dragging && dragging.over === globalIndex;
                      return (
                        <div
                          key={`${track.id}-${globalIndex}`}
                          data-q-index={globalIndex}
                          className={`px-4 py-2 border-b border-[#502d26]/10 transition-colors relative ${isOver ? 'bg-[#302927]/50' : 'hover:bg-[#302927]/30'}`}
                          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startDrag(globalIndex); }}
                          onPointerMove={(e) => dragging && onMove(e.clientY)}
                          onPointerUp={(e) => { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); endDrag(); }}
                          onPointerCancel={() => setDragging(null)}
                        >
                          <div className="flex items-center gap-3">
                            <button className="w-6 h-6 flex items-center justify-center text-[#726d6c] cursor-grab active:cursor-grabbing">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                              </svg>
                            </button>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => playFromQueue(globalIndex)}>
                              <div className="truncate text-[#b2a491] text-sm">{track.title}</div>
                            </div>
                            <button
                              onClick={() => removeFromQueue(globalIndex)}
                              className="w-8 h-8 flex items-center justify-center rounded-full text-[#726d6c] hover:text-red-400 transition-colors"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                              </svg>
                            </button>
                          </div>
                          {isDragging && (
                            <div className="absolute inset-0 border-2 border-dashed border-[#843c2d]/60 rounded-md pointer-events-none" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="flex flex-col h-full">
              {/* History header */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-[#502d26]/20">
                <span className="text-xs text-[#726d6c]">{state.listenHistory.length} tracks</span>
                {state.listenHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-[#726d6c] hover:text-red-400 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {/* History list */}
              <div className="flex-1 overflow-y-auto pb-8">
                {state.listenHistory.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[#726d6c] text-sm">
                    No listening history yet
                  </div>
                ) : (
                  state.listenHistory.map((entry, i) => (
                    <div
                      key={`${entry.track.id}-${entry.playedAt}`}
                      onClick={() => handlePlayFromHistory(entry)}
                      className="px-4 py-3 border-b border-[#502d26]/10 hover:bg-[#302927]/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#302927] overflow-hidden flex-shrink-0">
                          {entry.album?.cover_art_url ? (
                            <Image
                              src={entry.album.cover_art_url}
                              alt=""
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-[#ede8df] text-sm">{entry.track.title}</div>
                          <div className="text-[#726d6c] text-xs truncate">{entry.album?.artist_name}</div>
                        </div>
                        <div className="text-[#726d6c] text-xs">{formatTime(entry.playedAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'browse' && (
            <div className="flex flex-col h-full">
              {selectedAlbum ? (
                <>
                  {/* Album detail header */}
                  <div className="px-4 py-3 border-b border-[#502d26]/20">
                    <button
                      onClick={() => setSelectedAlbum(null)}
                      className="flex items-center gap-2 text-[#b2a491] hover:text-[#ede8df] transition-colors mb-3"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                      <span className="text-sm">Back</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-[#302927] overflow-hidden flex-shrink-0">
                        {selectedAlbum.cover_art_url ? (
                          <Image
                            src={selectedAlbum.cover_art_url}
                            alt=""
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[#ede8df] font-medium">{selectedAlbum.title}</div>
                        <div className="text-[#726d6c] text-sm truncate">{selectedAlbum.artist_name}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handlePlayAlbum(selectedAlbum, albumTracks)}
                        disabled={loadingTracks || albumTracks.filter(t => t.audio_url).length === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#ede8df] text-[#302927] disabled:opacity-40"
                      >
                        Play
                      </button>
                      <button
                        onClick={handleAddAlbumToQueue}
                        disabled={loadingTracks || albumTracks.filter(t => t.audio_url).length === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#302927] text-[#b2a491] disabled:opacity-40"
                      >
                        Add All
                      </button>
                    </div>
                  </div>

                  {/* Album tracks */}
                  <div className="flex-1 overflow-y-auto pb-8">
                    {loadingTracks ? (
                      <div className="px-4 py-8 text-center text-[#726d6c] text-sm">Loading...</div>
                    ) : (
                      albumTracks.map((track, idx) => {
                        const isDisabled = !track.audio_url;
                        return (
                          <div
                            key={track.id}
                            className={`px-4 py-3 border-b border-[#502d26]/10 flex items-center gap-3 ${
                              isDisabled ? 'opacity-40' : 'hover:bg-[#302927]/30 cursor-pointer'
                            }`}
                            onClick={() => !isDisabled && handlePlayAlbum(selectedAlbum, albumTracks, idx)}
                          >
                            <span className="w-6 text-center text-xs text-[#726d6c]">{track.track_number || idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-[#b2a491] text-sm">{track.title}</div>
                            </div>
                            {!isDisabled && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAddTrackToQueue(track); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-[#726d6c] hover:text-[#ede8df] transition-colors"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Albums grid */}
                  <div className="px-4 py-3 text-xs text-[#726d6c] border-b border-[#502d26]/20">
                    {albums.length} albums
                  </div>
                  <div className="flex-1 overflow-y-auto pb-8">
                    {loadingAlbums ? (
                      <div className="px-4 py-8 text-center text-[#726d6c] text-sm">Loading...</div>
                    ) : albums.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[#726d6c] text-sm">No albums found</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 p-4">
                        {albums.map(album => (
                          <div
                            key={album.id}
                            onClick={() => setSelectedAlbum(album)}
                            className="cursor-pointer group"
                          >
                            <div className="aspect-square rounded-lg bg-[#302927] overflow-hidden mb-2">
                              {album.cover_art_url ? (
                                <Image
                                  src={album.cover_art_url}
                                  alt=""
                                  width={160}
                                  height={160}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-10 h-10 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                    <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="truncate text-[#ede8df] text-sm font-medium">{album.title}</div>
                            <div className="truncate text-[#726d6c] text-xs">{album.artist_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
