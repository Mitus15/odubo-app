'use client';

import { useState } from 'react';
import { Album } from '@/types/music';
import dynamic from 'next/dynamic';
const AlbumModal = dynamic(() => import('./AlbumModal'));

interface AlbumActionsProps {
  album: Album;
  onAlbumUpdate?: (updatedAlbum: Album) => void;
}

export default function AlbumActions({ album, onAlbumUpdate }: AlbumActionsProps) {
  const [showModal, setShowModal] = useState(false);
  const [albumTracks, setAlbumTracks] = useState<any[]>([]); // Changed from Track[] to any[] as Track is removed
  const [loading, setLoading] = useState(false);
  const [currentAlbum, setCurrentAlbum] = useState<Album>(album);

  const handleView = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tracks?album_id=${album.id}`);
      const data = await response.json() as { success: boolean; tracks: any[] }; // Changed from Track[] to any[]
      if (data.success) {
        setAlbumTracks(data.tracks);
      }
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching album tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this album? This will also delete all tracks in the album.')) {
      return;
    }

    try {
      const response = await fetch(`/api/albums/${album.id}`, {
        method: 'DELETE'
      });

      const result = await response.json() as { success: boolean; error?: string };

      if (result.success) {
        // Refresh the page to show updated albums
        window.location.reload();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting album:', error);
      alert('Failed to delete album');
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-2">
        <button
          onClick={handleView}
          disabled={loading}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'View & Add Tracks'}
        </button>
        <button
          onClick={() => window.location.href = `/admin/albums/edit/${currentAlbum.id}`}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Edit Album
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Delete
        </button>
      </div>

      {showModal && (
        <AlbumModal 
          album={currentAlbum} 
          tracks={albumTracks}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
