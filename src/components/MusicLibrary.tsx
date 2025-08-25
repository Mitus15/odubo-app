'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Album } from '@/types/music';
import LikeButton, { LikeCount } from './LikeButton';

interface MusicLibraryProps {
  albums: Album[];
}

export default function MusicLibrary({ albums }: MusicLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'artist'>('newest');

  // Get unique genres and types for filters
  const { genres, types, hasAlbums, hasSingles } = useMemo(() => {
    const genreSet = new Set<string>();
    const typeSet = new Set<string>();
    
    albums.forEach(album => {
      if (album.genre) genreSet.add(album.genre);
      typeSet.add(album.release_type);
    });

    return {
      genres: Array.from(genreSet).sort(),
      types: Array.from(typeSet).sort(),
      hasAlbums: typeSet.has('album'),
      hasSingles: typeSet.has('single')
    };
  }, [albums]);

  // Filter and sort albums
  const filteredAndSortedAlbums = useMemo(() => {
    let filtered = albums.filter(album => {
      const matchesSearch = album.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           album.artist_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGenre = selectedGenre === 'all' || album.genre === selectedGenre;
      const matchesType = selectedType === 'all' || album.release_type === selectedType;
      
      return matchesSearch && matchesGenre && matchesType;
    });

    // Sort albums
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
        case 'oldest':
          return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
        case 'name':
          return a.title.localeCompare(b.title);
        case 'artist':
          return a.artist_name.localeCompare(b.artist_name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [albums, searchTerm, selectedGenre, selectedType, sortBy]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* FIXED HEADER SECTION - Never scrolls */}
      {/* Only show header when there are multiple albums or when filtering/searching */}
      {filteredAndSortedAlbums.length !== 1 && (
        <div className="flex-shrink-0">
          {/* Compact Mobile Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="px-4 pt-0 pb-2"
          >
            <div className="relative overflow-hidden rounded-2xl glass-morphism shadow-lg">
              {/* Floating glass orbs effect - reduced */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-2 -left-2 w-8 h-8 bg-[#843c2d]/10 rounded-full blur-lg animate-pulse"></div>
                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-[#ede8df]/10 rounded-full blur-md animate-pulse" style={{ animationDelay: '1s' }}></div>
              </div>
              
              <div className="relative p-2 sm:p-3">
                <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-[#ede8df] via-[#b2a491] to-[#ede8df] bg-clip-text text-transparent mb-0.5">
                  Music Vault
                </h1>
                <div className="flex items-center space-x-2 text-xs sm:text-sm">
                  <span className="text-[#b2a491]/80">Recently Added</span>
                  <span className="text-[#726d6c]/60">•</span>
                  <span className="text-[#b2a491]/80">{albums.length} albums</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Compact Search Bar */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-shrink-0 px-4 pb-1.5 hidden"
          >
            <div className="relative group">
              <input
                type="text"
                placeholder="Search music..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="relative w-full px-3 py-2 pl-9 glass-card text-sm text-[#ede8df] placeholder-[#726d6c]/70 min-h-[40px] sm:min-h-[44px] touch-manipulation transition-all duration-300 hover:shadow-[#843c2d]/20 focus:shadow-[#843c2d]/40 focus:outline-none focus:ring-1 focus:ring-[#843c2d]/50 rounded-2xl"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#726d6c]/80">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Compact Filter Pills */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex-shrink-0 px-4 pb-2.5"
          >
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto horizontal-scroll pb-1" style={{ overscrollBehavior: 'contain' }}>
                {/* Only show type filters if there are multiple types present */}
                {types.length > 1 && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedType('all')}
                      className={`px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300 min-h-[32px] sm:min-h-[36px] glass-card ${
                        selectedType === 'all' 
                          ? 'bg-gradient-to-r from-[#843c2d] to-[#502d26] text-[#ede8df] shadow-[#843c2d]/25' 
                          : 'text-[#b2a491] hover:text-[#ede8df] hover:shadow-[#843c2d]/20'
                      }`}
                    >
                      All
                    </motion.button>
                    {hasAlbums && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedType('album')}
                        className={`px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300 min-h-[32px] sm:min-h-[36px] glass-card ${
                          selectedType === 'album' 
                            ? 'bg-gradient-to-r from-[#843c2d] to-[#502d26] text-[#ede8df] shadow-[#843c2d]/25' 
                            : 'text-[#b2a491] hover:text-[#ede8df] hover:shadow-[#843c2d]/20'
                        }`}
                      >
                        Albums
                      </motion.button>
                    )}
                    {hasSingles && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedType('single')}
                        className={`px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300 min-h-[32px] sm:min-h-[36px] glass-card ${
                          selectedType === 'single' 
                            ? 'bg-gradient-to-r from-[#843c2d] to-[#502d26] text-[#ede8df] shadow-[#843c2d]/25' 
                            : 'text-[#b2a491] hover:text-[#ede8df] hover:shadow-[#843c2d]/20'
                        }`}
                      >
                        Singles
                      </motion.button>
                    )}
                  </>
                )}
                {genres.length > 0 && (
                  <motion.select
                    whileHover={{ scale: 1.05 }}
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="px-3 py-1.5 glass-card text-[#b2a491] rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#843c2d]/50 min-h-[32px] sm:min-h-[36px] touch-manipulation transition-all duration-300 hover:text-[#ede8df] hover:shadow-[#843c2d]/20"
                  >
                    <option value="all">Genres</option>
                    {genres.map(genre => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </motion.select>
                )}
              </div>
              {/* Compact scroll indicator */}
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#171616]/60 to-transparent pointer-events-none"></div>
            </div>
          </motion.div>
        </div>
      )}

      {/* SCROLLABLE CONTENT AREA - Only this section scrolls (mobile safe) */}
      <div className="flex-1 min-h-0 px-4 pb-24 sm:pb-4 overflow-hidden">
        <div className="h-full overflow-y-auto overscroll-contain scrollable-container">
          {filteredAndSortedAlbums.length === 0 ? (
            // No albums found
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center py-20"
            >
              <div className="relative">
                {/* Liquid glass background */}
                <div className="absolute inset-0 -m-8 bg-gradient-to-br from-[#302927]/20 via-[#171616]/10 to-[#302927]/20 backdrop-blur-xl rounded-3xl border border-[#502d26]/20"></div>
                
                <div className="relative">
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="mb-6"
                  >
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-[#843c2d]/20 rounded-full blur-xl"></div>
                      <svg className="relative w-16 h-16 mx-auto text-[#726d6c]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  </motion.div>
                  
                  <h3 className="text-lg font-medium bg-gradient-to-r from-[#b2a491] to-[#726d6c] bg-clip-text text-transparent mb-2">
                    No Music Found
                  </h3>
                  <p className="text-[#726d6c]/70 text-sm">
                    {searchTerm || selectedGenre !== 'all' || selectedType !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Your music vault is empty'
                    }
                  </p>
                </div>
              </div>
            </motion.div>
          ) : filteredAndSortedAlbums.length === 1 ? (
            // Single album hero layout
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center justify-center py-6"
            >
              <div className="relative max-w-xl mx-auto text-center">
                {/* Hero Album Cover */}
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="mb-6"
                >
                  <Link href={`/music/albums/${filteredAndSortedAlbums[0].id}`}>
                    <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-[#302927]/60 via-[#171616]/40 to-[#302927]/60 backdrop-blur-sm cursor-pointer shadow-2xl border border-[#502d26]/20 hover:border-[#843c2d]/30 transition-all duration-500 hover:scale-105">
                      {/* Enhanced floating glass particles effect */}
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-4 left-4 w-8 h-8 bg-[#ede8df]/15 rounded-full blur-lg animate-pulse"></div>
                        <div className="absolute bottom-6 right-6 w-12 h-12 bg-[#843c2d]/15 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                        <div className="absolute top-1/2 left-1/4 w-6 h-6 bg-[#b2a491]/10 rounded-full blur-md animate-pulse" style={{ animationDelay: '1s' }}></div>
                      </div>
                      
                      {filteredAndSortedAlbums[0].cover_art_url ? (
                        <Image
                          src={filteredAndSortedAlbums[0].cover_art_url}
                          alt={filteredAndSortedAlbums[0].title}
                          fill
                          priority
                          className="object-cover transition-transform duration-500 hover:scale-110"
                          sizes="(max-width: 640px) 256px, 288px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#502d26]/60 to-[#302927]/60 backdrop-blur-sm">
                          <svg className="w-20 h-20 text-[#726d6c]/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}

                      {/* Hero Play Overlay */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-gradient-to-br from-[#171616]/80 via-[#171616]/60 to-[#171616]/80 backdrop-blur-md flex items-center justify-center"
                      >
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="w-16 h-16 bg-gradient-to-r from-[#ede8df] via-[#b2a491] to-[#ede8df] rounded-full flex items-center justify-center backdrop-blur-xl shadow-2xl border border-[#ede8df]/20"
                        >
                          <svg className="w-6 h-6 text-[#171616] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </motion.div>
                      </motion.div>

                      {/* Hero Like Button */}
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-6 right-6"
                      >
                        <LikeButton
                          userId="demo-user"
                          itemId={filteredAndSortedAlbums[0].id}
                          itemType="album"
                          size="lg"
                          className="bg-[#171616]/60 backdrop-blur-xl hover:bg-[#171616]/80 shadow-xl border border-[#502d26]/30 rounded-2xl"
                        />
                      </motion.div>
                    </div>
                  </Link>
                </motion.div>

                {/* Hero Album Info */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="space-y-3"
                >
                  <div>
                    <Link href={`/music/albums/${filteredAndSortedAlbums[0].id}`}>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight cursor-pointer hover:text-gray-200 transition-all duration-300 mb-1">
                        {filteredAndSortedAlbums[0].title}
                      </h2>
                    </Link>
                    <p className="text-lg text-[#b2a491] font-medium">
                      {filteredAndSortedAlbums[0].artist_name}
                    </p>
                  </div>

                  {/* Album Details */}
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[#726d6c]">
                    {filteredAndSortedAlbums[0].genre && (
                      <span className="px-3 py-1 bg-[#302927]/40 rounded-full border border-[#502d26]/30">
                        {filteredAndSortedAlbums[0].genre}
                      </span>
                    )}
                    {filteredAndSortedAlbums[0].release_date && (
                      <span className="px-3 py-1 bg-[#302927]/40 rounded-full border border-[#502d26]/30">
                        {new Date(filteredAndSortedAlbums[0].release_date).getFullYear()}
                      </span>
                    )}
                    {filteredAndSortedAlbums[0].release_type && (
                      <span className="px-3 py-1 bg-[#843c2d]/20 text-[#b2a491] rounded-full border border-[#843c2d]/30">
                        {filteredAndSortedAlbums[0].release_type}
                      </span>
                    )}
                  </div>

                  {/* Description if available */}
                  {filteredAndSortedAlbums[0].description && (
                    <p className="text-[#b2a491]/80 text-sm leading-relaxed max-w-md mx-auto line-clamp-2">
                      {filteredAndSortedAlbums[0].description}
                    </p>
                  )}
                </motion.div>
              </div>
            </motion.div>
          ) : (
            // Grid layout for multiple albums
            <motion.div 
              layout
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            >
              <AnimatePresence>
                {filteredAndSortedAlbums.map((album, index) => (
                <motion.div 
                  key={album.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: index * 0.05,
                    ease: "easeOut"
                  }}
                  whileHover={{ 
                    y: -4,
                    transition: { duration: 0.2 }
                  }}
                  className="group flex flex-col min-w-0"
                >
                  {/* Liquid Glass Album Cover */}
                  <Link href={`/music/albums/${album.id}`}> 
                    <div className="relative aspect-square mb-3 rounded-3xl overflow-hidden bg-gradient-to-br from-[#302927]/60 via-[#171616]/40 to-[#302927]/60 backdrop-blur-sm cursor-pointer shadow-2xl border border-[#502d26]/20 group-hover:border-[#843c2d]/30 transition-all duration-300">
                      {/* Floating glass particles effect */}
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-2 left-2 w-4 h-4 bg-[#ede8df]/10 rounded-full blur-md animate-pulse"></div>
                        <div className="absolute bottom-3 right-3 w-6 h-6 bg-[#843c2d]/10 rounded-full blur-lg animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      </div>
                      
                      {album.cover_art_url ? (
                        <Image
                          src={album.cover_art_url}
                          alt={album.title}
                          fill
                          priority
                          className="object-cover transition-transform duration-300"
                          sizes="(max-width: 480px) 45vw, (max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#502d26]/60 to-[#302927]/60 backdrop-blur-sm">
                          <svg className="w-10 h-10 sm:w-8 sm:h-8 text-[#726d6c]/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}

                      {/* Enhanced Play Overlay with Liquid Glass Effect */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-gradient-to-br from-[#171616]/80 via-[#171616]/60 to-[#171616]/80 backdrop-blur-md flex items-center justify-center"
                      >
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="w-12 h-12 sm:w-10 sm:h-10 bg-gradient-to-br from-[#ede8df] via-[#b2a491] to-[#ede8df] rounded-full flex items-center justify-center backdrop-blur-xl shadow-2xl border border-[#ede8df]/20"
                        >
                          <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#171616] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </motion.div>
                      </motion.div>

                      {/* Like Button */}
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-3 right-3"
                      >
                        <LikeButton
                          userId="demo-user"
                          itemId={album.id}
                          itemType="album"
                          size="sm"
                          className="bg-[#171616]/60 backdrop-blur-xl hover:bg-[#171616]/80 shadow-xl border border-[#502d26]/30 rounded-2xl"
                        />
                      </motion.div>
                    </div>
                  </Link>

                  {/* Enhanced Album Info with Glass Effect */}
                  <div className="flex-1 space-y-2 min-h-0">
                    <Link href={`/music/albums/${album.id}`}> 
                      <h3 className="font-medium text-white text-sm leading-tight line-clamp-2 cursor-pointer hover:text-gray-200 transition-all duration-300">
                        {album.title}
                      </h3>
                    </Link>
                    <p className="text-[#b2a491]/80 text-xs font-normal truncate">
                      {album.artist_name}
                    </p>

                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        </div>
      </div>
    </div>
  );
}
