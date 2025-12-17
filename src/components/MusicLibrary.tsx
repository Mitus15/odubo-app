'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Album } from '@/types/music';
import ForYouSection from './ForYouSection';

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
      {/* Filter - minimal left-aligned */}
      {filteredAndSortedAlbums.length !== 1 && types.length > 1 && (
        <div className="flex-shrink-0 px-4 py-3 flex gap-4">
          <button
            onClick={() => setSelectedType('all')}
            className={`text-xs transition-colors ${
              selectedType === 'all' ? 'text-[#ede8df]' : 'text-[#726d6c] hover:text-[#b2a491]'
            }`}
          >
            All
          </button>
          {hasAlbums && (
            <button
              onClick={() => setSelectedType('album')}
              className={`text-xs transition-colors ${
                selectedType === 'album' ? 'text-[#ede8df]' : 'text-[#726d6c] hover:text-[#b2a491]'
              }`}
            >
              Albums
            </button>
          )}
          {hasSingles && (
            <button
              onClick={() => setSelectedType('single')}
              className={`text-xs transition-colors ${
                selectedType === 'single' ? 'text-[#ede8df]' : 'text-[#726d6c] hover:text-[#b2a491]'
              }`}
            >
              Singles
            </button>
          )}
        </div>
      )}

      {/* SCROLLABLE CONTENT AREA - Only this section scrolls (mobile safe) */}
      <div className="flex-1 min-h-0 pb-24 sm:pb-4 overflow-hidden">
        <div className="h-full overflow-y-auto overscroll-contain scrollable-container">
          {/* For You Section - Recently Played & Suggestions */}
          <ForYouSection albums={albums} type="music" />

          {/* All Music Label */}
          {filteredAndSortedAlbums.length > 0 && (
            <div className="flex items-center gap-3 px-4 mb-3 mt-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#726d6c] to-[#502d26]" />
              <h2 className="text-sm font-semibold text-[#ede8df] uppercase tracking-wider">
                All Music
              </h2>
            </div>
          )}

          <div className="px-4">
          {filteredAndSortedAlbums.length === 0 ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="w-20 h-20 glass-surface border border-[#502d26]/30 rounded-2xl flex items-center justify-center">
                <svg className="w-10 h-10 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553m0 0a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.053z" />
                </svg>
              </div>
            </div>
          ) : filteredAndSortedAlbums.length === 1 ? (
            // Single album - centered
            <div className="flex flex-col items-center justify-center py-8">
              <Link href={`/music/albums/${filteredAndSortedAlbums[0].id}`} className="group">
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-xl overflow-hidden border border-[#502d26]/20 group-hover:border-[#843c2d]/30 transition-all">
                  {filteredAndSortedAlbums[0].cover_art_url ? (
                    <Image
                      src={filteredAndSortedAlbums[0].cover_art_url}
                      alt={filteredAndSortedAlbums[0].title}
                      fill
                      priority
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      sizes="256px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1a1615]">
                      <svg className="w-16 h-16 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                      </svg>
                    </div>
                  )}
                  {/* Play on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-[#171616]/60 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#ede8df] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <h2 className="text-base font-medium text-[#ede8df]">{filteredAndSortedAlbums[0].title}</h2>
                  <p className="text-xs text-[#726d6c] mt-1">{filteredAndSortedAlbums[0].artist_name}</p>
                </div>
              </Link>
            </div>
          ) : (
            // Grid layout for multiple albums
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredAndSortedAlbums.map((album) => (
                <Link key={album.id} href={`/music/albums/${album.id}`} className="group">
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-[#502d26]/20 group-hover:border-[#843c2d]/30 transition-all">
                    {album.cover_art_url ? (
                      <Image
                        src={album.cover_art_url}
                        alt={album.title}
                        fill
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        sizes="(max-width: 480px) 45vw, (max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#1a1615]">
                        <svg className="w-8 h-8 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                        </svg>
                      </div>
                    )}
                    {/* Play on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-[#171616]/60 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#ede8df] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <h3 className="text-sm text-[#ede8df] line-clamp-1">{album.title}</h3>
                    <p className="text-xs text-[#726d6c] mt-0.5 truncate">{album.artist_name}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
