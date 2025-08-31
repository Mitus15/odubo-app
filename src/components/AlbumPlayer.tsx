'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Album, Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface AlbumPlayerProps {
  album: Album;
  tracks: Track[];
}

export default function AlbumPlayer({ album, tracks }: AlbumPlayerProps) {
  const { state, playTrack, playAlbum, addToQueue, toggleShuffle } = useMusicPlayer();
  const [windowHeight, setWindowHeight] = useState(800);
  const [isClient, setIsClient] = useState(false);

  // Update window height on client side
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setWindowHeight(window.innerHeight);
      
      const handleResize = () => setWindowHeight(window.innerHeight);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const playTrackFromAlbum = (track: Track, index: number) => {
    if (!track.audio_url) {
      alert('Audio not available for this track');
      return;
    }

    // Allow playing even if status is pending, as long as audio_url exists
    playTrack(track, album, tracks, index);
  };

  // Once on client, if a track duration is exactly 180 (default) but real duration differs,
  // probe it via HTMLAudioElement and persist via API.
  useEffect(() => {
    if (!isClient) return;
    const updateDurations = async () => {
      const toProbe = tracks.filter(t => t.audio_url && (t.duration === 180 || !t.duration));
      for (const t of toProbe) {
        try {
          const audio = new Audio(`/api/tracks/${t.id}/stream`);
          audio.preload = 'metadata';
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
              resolve();
              cleanup();
            };
            const onError = () => {
              reject(new Error('audio error'));
              cleanup();
            };
            const cleanup = () => {
              audio.removeEventListener('loadedmetadata', onLoaded);
              audio.removeEventListener('error', onError);
            };
            audio.addEventListener('loadedmetadata', onLoaded);
            audio.addEventListener('error', onError);
          });
          const realSeconds = Math.round(audio.duration || 0);
          if (realSeconds && realSeconds !== t.duration) {
            await fetch(`/api/tracks/${t.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ duration: realSeconds }),
            });
          }
        } catch {}
      }
    };
    updateDurations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, album.id]);

  const playEntireAlbum = (startIndex = 0) => {
    const availableTracks = tracks.filter(track => track.audio_url);
    if (availableTracks.length === 0) {
      alert('No audio tracks available in this album');
      return;
    }

    playAlbum(album, availableTracks, startIndex);
  };

  const shuffleAndPlay = () => {
    const availableTracks = tracks.filter(track => track.audio_url);
    if (availableTracks.length === 0) {
      alert('No audio tracks available in this album');
      return;
    }

    // Pick a random track to start with
    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    
    // Start playing the album from the random track
    playAlbum(album, availableTracks, randomIndex);
    
    // Enable shuffle mode after a short delay to ensure the album is loaded
    setTimeout(() => {
      if (!state.isShuffled) {
        toggleShuffle();
      }
    }, 150);
  };

  const addAlbumToQueue = () => {
    const availableTracks = tracks.filter(track => track.audio_url);
    if (availableTracks.length === 0) {
      alert('No audio tracks available in this album');
      return;
    }

    addToQueue(availableTracks);
  };

  const isCurrentTrack = (track: Track) => state.currentTrack?.id === track.id;
  const isTrackPlaying = (track: Track) => isCurrentTrack(track) && state.isPlaying;

  // Calculate dynamic container height using viewport units
  const getContainerHeight = () => {
    if (tracks.length === 0) return 'auto';
    
    // Use CSS viewport units for true dynamic scaling
    if (!isClient) {
      return 'calc(100vh - 20rem)';
    }
    
    // Mobile: More conservative height to prevent overwhelming mobile users
    // Desktop: Extended height for better space utilization
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      // Mobile/Tablet: header(3.5rem) + album_info(16rem) + controls(4rem) + paddings(6rem) + bottom_player(6rem when playing)
      const mobileHeight = state.currentTrack 
        ? 'calc(100vh - 32.5rem)' // When music playing - increased from 32.5rem
        : 'calc(100vh - 27rem)'; // When no music
      return mobileHeight;
    } else {
      // Desktop: Fixed height regardless of music playing state
      // header(3.5rem) + album_info(12rem) + controls(3.5rem) + paddings(3rem)
      return 'calc(100vh - 20rem)';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col gap-3 md:gap-4 xl:pt-0"
    >
      {/* Liquid Glass Play Controls */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex items-center justify-between gap-2 xl:pt-0"
      >
        {/* All buttons in horizontal row with glass effects */}
        <div className="flex items-center gap-2 flex-1">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => playEntireAlbum()}
            disabled={tracks.filter(t => t.audio_url).length === 0}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-all text-sm glass-surface shadow-lg border relative overflow-hidden ${
              tracks.filter(t => t.audio_url).length === 0
                ? 'text-[#726d6c]/60 cursor-not-allowed border-[#502d26]/20'
                : 'text-[#ede8df] hover:shadow-[#843c2d]/40 shadow-[#843c2d]/25 border-[#843c2d]/40 hover:border-[#843c2d]/60'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span className="hidden sm:inline">Play Album</span>
            <span className="sm:hidden">Play</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={shuffleAndPlay}
            disabled={tracks.filter(t => t.audio_url).length === 0}
            className={`flex items-center justify-center p-2 rounded-xl font-medium transition-all glass-card shadow-lg border relative overflow-hidden ${
              tracks.filter(t => t.audio_url).length === 0
                ? 'text-[#726d6c]/60 cursor-not-allowed border-[#502d26]/20'
                : 'text-[#b2a491] hover:text-[#ede8df] border-[#502d26]/40 hover:border-[#843c2d]/60 hover:shadow-[#843c2d]/40'
            }`}
            title="Shuffle play"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <polyline points="16 3 21 3 21 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="4" y1="20" x2="21" y2="3" strokeWidth="2" strokeLinecap="round" />
              <polyline points="21 16 21 21 16 21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="15" y1="15" x2="4" y2="4" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={addAlbumToQueue}
            disabled={tracks.filter(t => t.audio_url).length === 0}
            className={`flex items-center justify-center p-2 rounded-xl font-medium transition-all glass-morphism shadow-lg border relative overflow-hidden ${
              tracks.filter(t => t.audio_url).length === 0
                ? 'text-[#726d6c]/60 cursor-not-allowed border-[#502d26]/20'
                : 'text-[#b2a491] hover:text-[#ede8df] border-[#502d26]/40 hover:border-[#843c2d]/60 hover:shadow-[#843c2d]/40'
            }`}
            title="Add to queue"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
            </svg>
          </motion.button>
        </div>
      </motion.div>

      {/* Liquid Glass Track List Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="w-full"
      >
        <div className="overflow-hidden rounded-2xl glass-surface shadow-2xl relative">
          {/* Ambient background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#843c2d]/5 via-transparent to-[#502d26]/5 rounded-2xl" />
          
          {/* Liquid Glass Track List */}
          {tracks.length > 0 ? (
            <div 
              className="overflow-y-auto overscroll-contain backdrop-blur-sm"
              style={{ 
                height: getContainerHeight(),
                minHeight: '80px',
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'smooth'
              }}
            >
              <AnimatePresence>
                {tracks.map((track, index) => {
                  const isDisabled = !track.audio_url;
                  const isCurrent = isCurrentTrack(track);
                  const isPlaying = isTrackPlaying(track);

                  return (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ 
                        duration: 0.3, 
                        delay: index * 0.05,
                        ease: "easeOut"
                      }}
                      whileHover={{ 
                        x: 4,
                        transition: { duration: 0.2 }
                      }}
                      className={`flex items-center space-x-3 md:space-x-4 px-3 md:px-4 py-2 md:py-3 transition-all duration-300 cursor-pointer group touch-manipulation relative ${
                        isCurrent ? 'bg-gradient-to-r from-[#843c2d]/20 via-[#843c2d]/10 to-transparent border-l-4 border-[#843c2d]' : 'hover:bg-[#171616]/30'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !isDisabled && playTrackFromAlbum(track, index)}
                    >
                      {/* Glass highlight effect on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ede8df]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      
                      {/* Track Number / Play Button */}
                      <div className="relative w-8 md:w-8 flex items-center justify-center flex-shrink-0 z-10">
                        {isPlaying ? (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-4 h-4 flex items-center justify-center"
                          >
                            <div className="flex space-x-0.5">
                              <motion.div 
                                animate={{ scaleY: [1, 1.5, 1] }}
                                transition={{ duration: 0.5, repeat: Infinity, delay: 0 }}
                                className="w-0.5 h-4 bg-[#843c2d]" 
                              />
                              <motion.div 
                                animate={{ scaleY: [1, 1.5, 1] }}
                                transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                                className="w-0.5 h-4 bg-[#843c2d]" 
                              />
                              <motion.div 
                                animate={{ scaleY: [1, 1.5, 1] }}
                                transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                                className="w-0.5 h-4 bg-[#843c2d]" 
                              />
                            </div>
                          </motion.div>
                        ) : (
                          <span className={`text-sm md:text-sm transition-colors ${
                            isCurrent ? 'text-[#843c2d] font-bold' : 'text-[#726d6c]/80 group-hover:hidden'
                          }`}>
                            {(track.track_number && track.track_number > 0) ? track.track_number : index + 1}
                          </span>
                        )}
                        
                        {!isPlaying && !isDisabled && (
                          <motion.svg 
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileHover={{ opacity: 1, scale: 1 }}
                            className="w-4 h-4 text-[#ede8df] hidden group-hover:block absolute" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z"/>
                          </motion.svg>
                        )}
                      </div>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <h4 className={`font-medium truncate transition-colors text-base md:text-base ${
                              isCurrent ? 'text-[#843c2d]' : isDisabled ? 'text-[#726d6c]/60' : 'text-[#ede8df] group-hover:text-[#b2a491]'
                            }`}>
                              {track.title}
                            </h4>
                            
                            {Boolean(track.explicit_content) && (
                              <motion.span 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="inline-block mt-1 px-1.5 py-0.5 bg-gradient-to-r from-[#726d6c] to-[#502d26] text-white text-xs rounded-full font-bold shadow-lg backdrop-blur-sm"
                              >
                                E
                              </motion.span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status indicator with glass effect */}
                      <div className="flex items-center space-x-2 flex-shrink-0 relative z-10">
                        {isDisabled && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[#726d6c]/60 text-xs bg-[#302927]/40 backdrop-blur-sm rounded-full p-1" 
                            title="Audio not available"
                          >
                            ⚠️
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center justify-center py-12 text-center relative"
            >
              {/* Glass background effect */}
              <div className="absolute inset-0 -m-4 bg-gradient-to-br from-[#302927]/20 via-[#171616]/10 to-[#302927]/20 backdrop-blur-sm rounded-2xl"></div>
              
              <div className="relative">
                <motion.span 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="text-4xl mb-4 inline-block"
                >
                  🎵
                </motion.span>
                <h3 className="text-[#ede8df] font-medium mb-2">No tracks available</h3>
                <p className="text-[#726d6c]/70 text-sm">This album doesn't have any tracks yet.</p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
