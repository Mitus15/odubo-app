'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Album, Track } from '@/types/music';
import LikeButton from './LikeButton';

interface UserLikesClientProps {
  tracks: Track[];
  albums: Album[];
  videos: any[]; // Would need proper video type
}

type TabType = 'all' | 'tracks' | 'albums' | 'videos';

export default function UserLikesClient({ tracks, albums, videos }: UserLikesClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const tabs = [
    { id: 'all', label: 'All', count: tracks.length + albums.length + videos.length },
    { id: 'tracks', label: 'Tracks', count: tracks.length },
    { id: 'albums', label: 'Albums', count: albums.length },
    { id: 'videos', label: 'Videos', count: videos.length },
  ] as const;

  const renderTrackCard = (track: any) => (
    <div key={track.id} className="glass-surface border border-[#502d26]/20 rounded-xl p-4 hover:bg-[#843c2d]/5 hover:border-[#843c2d]/30 transition-all duration-300">
      <div className="flex items-center space-x-4">
        {/* Album Cover */}
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#1a1817] flex-shrink-0 shadow-lg">
          {track.cover_art_url ? (
            <Image
              src={track.cover_art_url}
              alt={track.album_title || 'Album'}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#502d26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[#ede8df] truncate">{track.title}</h4>
          <p className="text-sm text-[#b2a491] truncate">{track.artist_name}</p>
          {track.album_title && (
            <p className="text-xs text-[#726d6c] truncate">{track.album_title}</p>
          )}
          <p className="text-[10px] text-[#502d26] mt-1 uppercase tracking-wider">Liked {formatDate(track.liked_at)}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          <LikeButton
            userId="demo-user"
            itemId={track.id}
            itemType="track"
            size="sm"
          />
          <span className="text-sm text-[#b2a491] tabular-nums">{formatDuration(track.duration)}</span>
        </div>
      </div>
    </div>
  );

  const renderAlbumCard = (album: any) => (
    <div key={album.id} className="glass-surface border border-[#502d26]/20 rounded-xl overflow-hidden hover:border-[#843c2d]/30 transition-all duration-300 group">
      <Link href={`/music/albums/${album.id}`}>
        <div className="aspect-square relative bg-[#1a1817]">
          {album.cover_art_url ? (
            <Image
              src={album.cover_art_url}
              alt={album.title}
              fill
              className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-[#502d26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#171616]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      </Link>
      <div className="p-4">
        <Link href={`/music/albums/${album.id}`}>
          <h4 className="font-medium text-[#ede8df] truncate hover:text-[#843c2d] transition-colors">{album.title}</h4>
        </Link>
        <p className="text-sm text-[#b2a491] truncate">{album.artist_name}</p>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-[#502d26] uppercase tracking-wider">Liked {formatDate(album.liked_at)}</p>
          <LikeButton
            userId="demo-user"
            itemId={album.id}
            itemType="album"
            size="sm"
          />
        </div>
      </div>
    </div>
  );

  const renderVideoCard = (video: any) => (
    <div key={video.id} className="glass-surface border border-[#502d26]/20 rounded-xl overflow-hidden hover:border-[#843c2d]/30 transition-all duration-300 group">
      <div className="aspect-video relative bg-[#1a1817]">
        {video.poster_url ? (
          <Image
            src={video.poster_url}
            alt={video.title}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-[#502d26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#171616]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full glass-surface border border-[#ede8df]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#ede8df] ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
      <div className="p-4">
        <h4 className="font-medium text-[#ede8df] truncate">{video.title}</h4>
        <p className="text-sm text-[#b2a491] truncate">{video.publisher}</p>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-[#502d26] uppercase tracking-wider">Liked {formatDate(video.liked_at)}</p>
          <LikeButton
            userId="demo-user"
            itemId={video.id}
            itemType="video"
            size="sm"
          />
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (activeTab === 'tracks') {
      return tracks.length > 0 ? (
        <div className="space-y-3">
          {tracks.map(renderTrackCard)}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 glass-surface border border-[#502d26]/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-[#502d26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[#b2a491] mb-2">No liked tracks yet</h3>
          <p className="text-[#726d6c] text-sm">Start exploring and like your favorite tracks!</p>
        </div>
      );
    }

    if (activeTab === 'albums') {
      return albums.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {albums.map(renderAlbumCard)}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 glass-surface border border-[#502d26]/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-[#502d26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[#b2a491] mb-2">No liked albums yet</h3>
          <p className="text-[#726d6c] text-sm">Start exploring and like your favorite albums!</p>
        </div>
      );
    }

    if (activeTab === 'videos') {
      return videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map(renderVideoCard)}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 glass-surface border border-[#502d26]/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-[#502d26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[#b2a491] mb-2">No liked videos yet</h3>
          <p className="text-[#726d6c] text-sm">Start exploring and like your favorite videos!</p>
        </div>
      );
    }

    // All tab - mixed content
    const allItems = [
      ...tracks.map(item => ({ ...item, type: 'track' })),
      ...albums.map(item => ({ ...item, type: 'album' })),
      ...videos.map(item => ({ ...item, type: 'video' }))
    ].sort((a, b) => new Date(b.liked_at).getTime() - new Date(a.liked_at).getTime());

    return allItems.length > 0 ? (
      <div className="space-y-3">
        {allItems.map((item) => {
          if (item.type === 'track') {
            return renderTrackCard(item);
          } else if (item.type === 'album') {
            return (
              <div key={item.id} className="glass-surface border border-[#502d26]/20 rounded-xl p-4 hover:bg-[#843c2d]/5 hover:border-[#843c2d]/30 transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#1a1817] flex-shrink-0 shadow-lg">
                    {item.cover_art_url ? (
                      <Image
                        src={item.cover_art_url}
                        alt={item.title}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#502d26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] bg-[#843c2d]/20 text-[#843c2d] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium">Album</span>
                    </div>
                    <h4 className="font-medium text-[#ede8df] truncate">{item.title}</h4>
                    <p className="text-sm text-[#b2a491] truncate">{item.artist_name}</p>
                    <p className="text-[10px] text-[#502d26] mt-1 uppercase tracking-wider">Liked {formatDate(item.liked_at)}</p>
                  </div>
                  <LikeButton
                    userId="demo-user"
                    itemId={item.id}
                    itemType="album"
                    size="sm"
                  />
                </div>
              </div>
            );
          } else {
            return (
              <div key={item.id} className="glass-surface border border-[#502d26]/20 rounded-xl p-4 hover:bg-[#843c2d]/5 hover:border-[#843c2d]/30 transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-11 rounded-lg overflow-hidden bg-[#1a1817] flex-shrink-0 shadow-lg">
                    {item.poster_url ? (
                      <Image
                        src={item.poster_url}
                        alt={item.title}
                        width={80}
                        height={44}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#502d26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] bg-[#b2a491]/20 text-[#b2a491] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium">Video</span>
                    </div>
                    <h4 className="font-medium text-[#ede8df] truncate">{item.title}</h4>
                    <p className="text-sm text-[#b2a491] truncate">{item.publisher}</p>
                    <p className="text-[10px] text-[#502d26] mt-1 uppercase tracking-wider">Liked {formatDate(item.liked_at)}</p>
                  </div>
                  <LikeButton
                    userId="demo-user"
                    itemId={item.id}
                    itemType="video"
                    size="sm"
                  />
                </div>
              </div>
            );
          }
        })}
      </div>
    ) : (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 glass-surface border border-[#843c2d]/30 rounded-full mb-4 shadow-[0_0_40px_rgba(132,60,45,0.15)]">
          <svg className="w-8 h-8 text-[#843c2d]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <h3 className="text-lg font-medium text-[#b2a491] mb-2">No likes yet</h3>
        <p className="text-[#726d6c] text-sm mb-6">Start exploring and like your favorite content!</p>
        <Link
          href="/media"
          className="inline-block px-6 py-3 glass-surface border border-[#843c2d]/30 text-[#ede8df] rounded-xl hover:bg-[#843c2d]/10 transition-all duration-300 text-sm font-medium tracking-wide"
        >
          Browse Media
        </Link>
      </div>
    );
  };

  return (
    <div>
      {/* Tabs - warm glass design */}
      <div className="mb-8">
        <div className="flex gap-1 p-1 glass-surface border border-[#502d26]/20 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-[#ede8df] text-[#302927] shadow-lg'
                  : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#843c2d]/10'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#302927]/10 text-[#302927]'
                    : 'bg-[#502d26]/30 text-[#b2a491]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}
