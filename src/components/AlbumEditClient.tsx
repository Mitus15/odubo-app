'use client';

import { useState, useEffect } from 'react';
import { Album, Track } from '@/types/music';
import AdminNavigation from './AdminNavigation';
import AlbumModal from './AlbumModal';
import Image from 'next/image';

interface AlbumEditClientProps {
  album: Album;
  tracks: Track[];
}

export default function AlbumEditClient({ album, tracks }: AlbumEditClientProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [currentTracks, setCurrentTracks] = useState<Track[]>(tracks);
  const [currentAlbum, setCurrentAlbum] = useState<Album>(album);

  const refreshTracks = async () => {
    try {
      const response = await fetch(`/api/tracks?album_id=${album.id}`);
      const data = await response.json() as { success: boolean; tracks: Track[] };
      if (data.success) {
        setCurrentTracks(data.tracks);
      }
    } catch (error) {
      console.error('Error refreshing tracks:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = currentTracks.reduce((total, track) => total + track.duration, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-white">
      <AdminNavigation />
      
      <div className="pt-20 pb-6 px-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 bg-[#502d26] hover:bg-[#843c2d] rounded-lg transition-colors mr-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-[#ede8df]">Album Details</h1>
        </div>

        {/* Desktop Layout: 2-Column Layout */}
        <div className="hidden xl:grid xl:grid-cols-2 gap-6">
          {/* Left Column: Album Cover, Details, and Info */}
          <div className="space-y-6">
            {/* Album Hero Section */}
            <div className="bg-gradient-to-r from-[#302927]/80 to-[#171616]/80 backdrop-blur-sm rounded-2xl p-6 border border-[#502d26]/30">
              <div className="flex flex-col items-center text-center">
                {/* Album Cover */}
                <div className="relative w-48 h-48 md:w-64 md:h-64 mb-6 group">
                  {currentAlbum.cover_art_url ? (
                    <Image
                      src={currentAlbum.cover_art_url}
                      alt={currentAlbum.title}
                      fill
                      className="rounded-xl object-cover shadow-2xl"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#502d26] to-[#843c2d] rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-2 text-[#ede8df]/60" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                        <span className="text-[#ede8df]/60 text-sm">No Cover</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Edit Cover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex items-center justify-center">
                    <button
                      onClick={() => setShowModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#843c2d] hover:bg-[#a04834] text-white rounded-lg transition-colors font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit Cover
                    </button>
                  </div>
                </div>

                {/* Album Info */}
                <h2 className="text-3xl md:text-4xl font-bold text-[#ede8df] mb-2">{currentAlbum.title}</h2>
                <p className="text-xl text-[#b2a491] mb-4">{currentAlbum.artist_name}</p>
                
                {/* Album Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6 w-full">
                  <div className="bg-[#302927]/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-[#ede8df]">{currentTracks.length}</div>
                    <div className="text-sm text-[#b2a491]">Tracks</div>
                  </div>
                  <div className="bg-[#302927]/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-[#ede8df]">{formatDuration(totalDuration)}</div>
                    <div className="text-sm text-[#b2a491]">Duration</div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {currentAlbum.genre && (
                    <span className="px-3 py-1 bg-[#502d26] text-[#ede8df] rounded-full text-sm">
                      {currentAlbum.genre}
                    </span>
                  )}
                  {currentAlbum.featured && (
                    <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-sm">
                      Featured
                    </span>
                  )}
                  {currentAlbum.explicit_content && (
                    <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm">
                      Explicit
                    </span>
                  )}
                </div>

                {/* Additional Info */}
                {(currentAlbum.record_label || currentAlbum.description) && (
                  <div className="text-center w-full">
                    {currentAlbum.record_label && (
                      <p className="text-[#b2a491] mb-2">
                        <span className="font-medium">Label:</span> {currentAlbum.record_label}
                      </p>
                    )}
                    {currentAlbum.description && (
                      <p className="text-[#ede8df] leading-relaxed">{currentAlbum.description}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Album Details */}
            <div className="bg-gradient-to-r from-[#302927]/80 to-[#171616]/80 backdrop-blur-sm rounded-2xl p-6 border border-[#502d26]/30">
              <h3 className="text-xl font-bold text-[#ede8df] mb-4">Album Details</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[#b2a491]">Release Date:</span>
                  <span className="text-[#ede8df]">{currentAlbum.release_date ? new Date(currentAlbum.release_date).toLocaleDateString() : 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#b2a491]">Record Label:</span>
                  <span className="text-[#ede8df]">{currentAlbum.record_label || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#b2a491]">Genre:</span>
                  <span className="text-[#ede8df]">{currentAlbum.genre || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#b2a491]">Subgenre:</span>
                  <span className="text-[#ede8df]">{currentAlbum.subgenre || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#b2a491]">Featured:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    currentAlbum.featured ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  }`}>
                    {currentAlbum.featured ? 'Yes' : 'No'}
                  </span>
                </div>
                {currentAlbum.description && (
                  <div>
                    <span className="text-[#b2a491] block mb-2">Description:</span>
                    <p className="text-[#ede8df] text-sm leading-relaxed">{currentAlbum.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Tracklist */}
          <div className="bg-gradient-to-r from-[#302927]/80 to-[#171616]/80 backdrop-blur-sm rounded-2xl border border-[#502d26]/30 overflow-hidden">
            {/* Section Header */}
            <div className="p-6 border-b border-[#502d26]/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-[#ede8df] mb-1">Tracklist</h3>
                  <p className="text-[#b2a491]">Manage tracks and credits</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#843c2d] hover:bg-[#a04834] text-white rounded-lg transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Edit Tracks
                </button>
              </div>
            </div>

            {/* Track List */}
            <div className="divide-y divide-[#502d26]/30">
              {currentTracks.length > 0 ? (
                currentTracks.map((track, index) => (
                  <div key={track.id} className="p-4 hover:bg-[#302927]/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Track Number */}
                      <div className="w-8 h-8 flex items-center justify-center bg-[#502d26]/50 rounded-full text-[#ede8df] font-bold text-sm">
                        {track.track_number}
                      </div>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[#ede8df] mb-1 truncate">{track.title}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-[#b2a491]">
                          <span>{formatDuration(track.duration)}</span>
                          
                          {/* Credits */}
                          {track.credits && track.credits.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {track.credits.slice(0, 2).map((credit: any, idx: number) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-1 rounded text-xs ${
                                    credit.is_featured 
                                      ? 'bg-yellow-600 text-white' 
                                      : 'bg-[#502d26]/70 text-[#ede8df]'
                                  }`}
                                >
                                  {credit.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="text-[#b2a491] mb-4">
                    <svg className="w-16 h-16 mx-auto mb-4 text-[#502d26]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <p className="text-lg font-medium text-[#ede8df] mb-2">No tracks yet</p>
                    <p className="text-sm text-[#b2a491]">Add tracks to get started</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Layout: Stacked Layout */}
        <div className="xl:hidden space-y-6">
          {/* Album Hero Section */}
          <div className="bg-gradient-to-r from-[#302927]/80 to-[#171616]/80 backdrop-blur-sm rounded-2xl p-6 border border-[#502d26]/30">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Album Cover */}
              <div className="flex-shrink-0">
                <div className="relative w-48 h-48 md:w-64 md:h-64 mx-auto lg:mx-0 group">
                  {currentAlbum.cover_art_url ? (
                    <Image
                      src={currentAlbum.cover_art_url}
                      alt={currentAlbum.title}
                      fill
                      className="rounded-xl object-cover shadow-2xl"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#502d26] to-[#843c2d] rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-2 text-[#ede8df]/60" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                        <span className="text-[#ede8df]/60 text-sm">No Cover</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Edit Cover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex items-center justify-center">
                    <button
                      onClick={() => setShowModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#843c2d] hover:bg-[#a04834] text-white rounded-lg transition-colors font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit Cover
                    </button>
                  </div>
                </div>
              </div>

              {/* Album Info */}
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-3xl md:text-4xl font-bold text-[#ede8df] mb-2">{currentAlbum.title}</h2>
                <p className="text-xl text-[#b2a491] mb-4">{currentAlbum.artist_name}</p>
                
                {/* Album Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-[#302927]/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-[#ede8df]">{currentTracks.length}</div>
                    <div className="text-sm text-[#b2a491]">Tracks</div>
                  </div>
                  <div className="bg-[#302927]/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-[#ede8df]">{formatDuration(totalDuration)}</div>
                    <div className="text-sm text-[#b2a491]">Duration</div>
                  </div>
                  <div className="bg-[#302927]/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-[#ede8df]">{currentAlbum.release_date ? new Date(currentAlbum.release_date).getFullYear() : '—'}</div>
                    <div className="text-sm text-[#b2a491]">Year</div>
                  </div>
                  <div className="bg-[#302927]/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-[#ede8df] capitalize">{currentAlbum.release_type}</div>
                    <div className="text-sm text-[#b2a491]">Type</div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-4">
                  {currentAlbum.genre && (
                    <span className="px-3 py-1 bg-[#502d26] text-[#ede8df] rounded-full text-sm">
                      {currentAlbum.genre}
                    </span>
                  )}
                  {currentAlbum.featured && (
                    <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-sm">
                      Featured
                    </span>
                  )}
                  {currentAlbum.explicit_content && (
                    <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm">
                      Explicit
                    </span>
                  )}
                </div>

                {/* Additional Info */}
                {(currentAlbum.record_label || currentAlbum.description) && (
                  <div className="text-left">
                    {currentAlbum.record_label && (
                      <p className="text-[#b2a491] mb-2">
                        <span className="font-medium">Label:</span> {currentAlbum.record_label}
                      </p>
                    )}
                    {currentAlbum.description && (
                      <p className="text-[#ede8df] leading-relaxed">{currentAlbum.description}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tracks Section */}
          <div className="bg-gradient-to-r from-[#302927]/80 to-[#171616]/80 backdrop-blur-sm rounded-2xl border border-[#502d26]/30 overflow-hidden">
            {/* Section Header */}
            <div className="p-6 border-b border-[#502d26]/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-[#ede8df] mb-1">Tracklist</h3>
                  <p className="text-[#b2a491]">Manage tracks and credits</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#843c2d] hover:bg-[#a04834] text-white rounded-lg transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Edit Tracks
                </button>
              </div>
            </div>

            {/* Track List */}
            <div className="divide-y divide-[#502d26]/30">
              {currentTracks.length > 0 ? (
                currentTracks.map((track, index) => (
                  <div key={track.id} className="p-4 hover:bg-[#302927]/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Track Number */}
                      <div className="w-8 h-8 flex items-center justify-center bg-[#502d26]/50 rounded-full text-[#ede8df] font-bold text-sm">
                        {track.track_number}
                      </div>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[#ede8df] mb-1 truncate">{track.title}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-[#b2a491]">
                          <span>{formatDuration(track.duration)}</span>
                          
                          {/* Credits */}
                          {track.credits && track.credits.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {track.credits.slice(0, 2).map((credit: any, idx: number) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-1 rounded text-xs ${
                                    credit.is_featured 
                                      ? 'bg-yellow-600 text-white' 
                                      : 'bg-[#502d26]/70 text-[#ede8df]'
                                  }`}
                                >
                                  {credit.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="text-[#b2a491] mb-4">
                    <svg className="w-16 h-16 mx-auto mb-4 text-[#502d26]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <p className="text-lg font-medium text-[#ede8df] mb-2">No tracks yet</p>
                    <p className="text-sm text-[#b2a491]">Add tracks to get started</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <AlbumModal 
          album={currentAlbum} 
          tracks={currentTracks}
          onClose={() => {
            setShowModal(false);
            refreshTracks();
          }}
        />
      )}
    </div>
  );
}
