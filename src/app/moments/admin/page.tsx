"use client";

import { useEffect, useState } from 'react';
import Moderation from './moderation';

export default function MomentsAdminPage({ searchParams }: { searchParams?: { galleryId?: string } }) {
  const [galleries, setGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [galleryId, setGalleryId] = useState(searchParams?.galleryId || '');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/moments/list?limit=20');
        const data = (await res.json()) as any;
        if (!res.ok) throw new Error(data?.error || 'Failed');
        setGalleries(data.photos || []);
        if (!galleryId && data.photos && data.photos.length > 0) setGalleryId(String(data.photos[0].gallery_id || data.photos[0].galleryId || ''));
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function deleteGallery() {
    if (!galleryId) return;
    if (!confirm('Delete this entire gallery and all of its photos?')) return;
    try {
      const res = await fetch(`/api/moments/galleries/${encodeURIComponent(galleryId)}`, { method: 'DELETE' });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      alert('Gallery deleted');
      window.location.href = '/admin';
    } catch (e: any) {
      alert(e?.message || 'Failed');
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Moments Admin</h1>
      {loading && <div>Loading...</div>}
      {!loading && (
        <div>
          <div className="mb-4">
            <label className="block text-sm">Gallery ID</label>
            <input value={galleryId} onChange={(e) => setGalleryId(e.target.value)} className="mt-1 px-3 py-2 rounded bg-[#171616] text-[#ede8df]" />
            <div className="mt-3 flex gap-2">
              <a href={`/moments/gallery/${encodeURIComponent(galleryId)}`} className="px-3 py-2 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733]">Open Public View</a>
              <button onClick={deleteGallery} className="px-3 py-2 rounded bg-red-800 text-white">Delete Gallery</button>
            </div>
          </div>

          <div className="mb-6">
            <Moderation galleryId={galleryId} />
          </div>
        </div>
      )}
    </div>
  );
}
