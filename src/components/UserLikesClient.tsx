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
    <div key={track.id} className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors">
      <div className="flex items-center space-x-4">
        {/* Album Cover */}
        <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-700 flex-shrink-0">
          {track.cover_art_url ? (
            <Image
              src={track.cover_art_url}
              alt={track.album_title || 'Album'}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{track.title}</h4>
          <p className="text-sm text-gray-400 truncate">{track.artist_name}</p>
          {track.album_title && (
            <p className="text-xs text-gray-500 truncate">{track.album_title}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Liked {formatDate(track.liked_at)}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          <LikeButton
            userId="demo-user"
            itemId={track.id}
            itemType="track"
            size="sm"
          />
          <span className="text-sm text-gray-400">{formatDuration(track.duration)}</span>
        </div>
      </div>
    </div>
  );

  const renderAlbumCard = (album: any) => (
    <div key={album.id} className="bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-800/70 transition-colors">
      <Link href={`/music/albums/${album.id}`}>
        <div className="aspect-square relative">
          {album.cover_art_url ? (
            <Image
              src={album.cover_art_url}
              alt={album.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
        </div>
      </Link>
      <div className="p-4">
        <Link href={`/music/albums/${album.id}`}>
          <h4 className="font-medium text-white truncate hover:text-purple-300 transition-colors">{album.title}</h4>
        </Link>
        <p className="text-sm text-gray-400 truncate">{album.artist_name}</p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">Liked {formatDate(album.liked_at)}</p>
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
    <div key={video.id} className="bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-800/70 transition-colors">
      <div className="aspect-video relative bg-gray-700">
        {video.poster_url ? (
          <Image
            src={video.poster_url}
            alt={video.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-4">
        <h4 className="font-medium text-white truncate">{video.title}</h4>
        <p className="text-sm text-gray-400 truncate">{video.publisher}</p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">Liked {formatDate(video.liked_at)}</p>
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
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No liked tracks yet</h3>
          <p className="text-gray-500">Start exploring and like your favorite tracks!</p>
        </div>
      );
    }

    if (activeTab === 'albums') {
      return albums.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          {albums.map(renderAlbumCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No liked albums yet</h3>
          <p className="text-gray-500">Start exploring and like your favorite albums!</p>
        </div>
      );
    }

    if (activeTab === 'videos') {
      return videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map(renderVideoCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No liked videos yet</h3>
          <p className="text-gray-500">Start exploring and like your favorite videos!</p>
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
      <div className="space-y-6">
        {allItems.map((item) => {
          if (item.type === 'track') {
            return renderTrackCard(item);
          } else if (item.type === 'album') {
            return (
              <div key={item.id} className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-700 flex-shrink-0">
                    {item.cover_art_url ? (
                      <Image
                        src={item.cover_art_url}
                        alt={item.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">ALBUM</span>
                      <h4 className="font-medium text-white truncate">{item.title}</h4>
                    </div>
                    <p className="text-sm text-gray-400 truncate">{item.artist_name}</p>
                    <p className="text-xs text-gray-500 mt-1">Liked {formatDate(item.liked_at)}</p>
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
              <div key={item.id} className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-9 rounded-md overflow-hidden bg-gray-700 flex-shrink-0">
                    {item.poster_url ? (
                      <Image
                        src={item.poster_url}
                        alt={item.title}
                        width={64}
                        height={36}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">VIDEO</span>
                      <h4 className="font-medium text-white truncate">{item.title}</h4>
                    </div>
                    <p className="text-sm text-gray-400 truncate">{item.publisher}</p>
                    <p className="text-xs text-gray-500 mt-1">Liked {formatDate(item.liked_at)}</p>
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
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-full mb-4">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-400 mb-2">No likes yet</h3>
        <p className="text-gray-500">Start exploring and like your favorite content!</p>
        <Link
          href="/music"
          className="inline-block mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
        >
          Browse Music
        </Link>
      </div>
    );
  };

  return (
    <div>
      {/* Tabs */}
      <div className="mb-8">
        <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg backdrop-blur-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-black shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  activeTab === tab.id
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-gray-700 text-gray-300'
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
