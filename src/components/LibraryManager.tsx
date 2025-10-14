'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
const AlbumsClient = dynamic(() => import('./AlbumsClient'));
const TracksClient = dynamic(() => import('./TracksClient'));
import { Album, Track } from '@/types/music';

type LibraryTab = 'albums' | 'tracks';

export default function LibraryManager() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('albums');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const albumPickerList = useMemo(() =>
    albums.map(({ id, title, artist_name }) => ({ id, title, artist_name })),
    [albums]
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [albumsRes, tracksRes] = await Promise.all([
        fetch('/api/albums', { credentials: 'include' }),
        fetch('/api/tracks', { credentials: 'include' })
      ]);
      if (!albumsRes.ok) throw new Error('Failed to load albums');
      if (!tracksRes.ok) throw new Error('Failed to load tracks');
      const albumsJson = await albumsRes.json() as { success: boolean; albums: Album[] };
      const tracksJson = await tracksRes.json() as { success: boolean; tracks: Track[] };
      setAlbums(albumsJson.albums || []);
      setTracks(tracksJson.tracks || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load library data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-2">
          <button
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              activeTab === 'albums' ? 'bg-[#ede8df] text-[#171616]' : 'bg-[#302927] text-[#b2a491]'
            }`}
            onClick={() => setActiveTab('albums')}
          >
            Albums
          </button>
          <button
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              activeTab === 'tracks' ? 'bg-[#ede8df] text-[#171616]' : 'bg-[#302927] text-[#b2a491]'
            }`}
            onClick={() => setActiveTab('tracks')}
          >
            Tracks
          </button>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-2 rounded-md text-sm font-medium bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="text-[#b2a491]">Loading library…</div>
      )}
      {error && (
        <div className="text-red-400">{error}</div>
      )}

      {!loading && !error && (
        activeTab === 'albums' ? (
          <AlbumsClient albums={albums} />
        ) : (
          <TracksClient initialTracks={tracks} albums={albumPickerList} />
        )
      )}
    </div>
  );
}


