'use client';

/**
 * Music Tab - Album and track management
 * Uses AlbumsClientWrapper since the page is a server component
 */
import AlbumsClientWrapper from '../albums/AlbumsClientWrapper';
import { useEffect, useState } from 'react';

export default function MusicTab() {
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAlbums() {
      try {
        const res = await fetch('/api/albums');
        if (res.ok) {
          const data = await res.json();
          setAlbums(data.albums || []);
        }
      } catch (e) {
        console.error('Failed to load albums:', e);
      } finally {
        setLoading(false);
      }
    }
    loadAlbums();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full pt-4 pb-20">
      <div className="container mx-auto px-4 py-8">
        <AlbumsClientWrapper albums={albums} />
      </div>
    </div>
  );
}
