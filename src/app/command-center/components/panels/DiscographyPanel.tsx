'use client';

import { useState, useEffect } from 'react';

type Album = {
  id: string;
  title: string;
  artist_name: string;
  cover_art_url?: string;
  release_date?: string;
};

export function DiscographyPanel() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load albums
  useEffect(() => {
    const loadAlbums = async () => {
      try {
        const res = await fetch('/api/albums', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { albums?: Album[] };
          setAlbums(data.albums || []);
        }
      } catch (e) {
        console.warn('Failed to load albums', e);
      } finally {
        setLoading(false);
      }
    };
    loadAlbums();
  }, []);

  const filteredAlbums = albums.filter(
    (album) =>
      album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.artist_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="flex-shrink-0 p-3 border-b border-[#502d26]/30">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#726d6c]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search discography..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAlbums.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💿</div>
            <p className="text-sm text-[#726d6c]">
              {searchQuery ? 'No results found' : 'No albums in catalog'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAlbums.map((album) => (
              <button
                key={album.id}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#302927] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-[#302927] overflow-hidden flex-shrink-0">
                  {album.cover_art_url ? (
                    <img
                      src={album.cover_art_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">
                      💿
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{album.title}</p>
                  <p className="text-xs text-[#726d6c] truncate">{album.artist_name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" title="Linked" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Apple Music sync placeholder */}
        {!loading && albums.length > 0 && (
          <div className="mt-4 p-4 rounded-xl border border-dashed border-[#502d26]/40 text-center">
            <p className="text-xs text-[#726d6c]">
              Apple Music catalog sync coming in Phase 4
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
