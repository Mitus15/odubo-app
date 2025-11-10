"use client";

import { Suspense, useEffect, useState } from 'react';
import Moderation from './moderation';
import { useSearchParams } from 'next/navigation';

function AdminInner() {
  const sp = useSearchParams();
  const initialId = sp?.get('galleryId') || '';
  const [galleryId, setGalleryId] = useState(initialId);
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('authToken')) : null;
  const [pickerLoading, setPickerLoading] = useState(false);
  const [galleries, setGalleries] = useState<Array<{ id: number; title?: string }>>([]);
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPicker() {
      try {
        setPickerLoading(true);
        const res = await fetch('/api/moments/galleries/public?limit=50', { credentials: 'include' });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && data.error) ? data.error : 'Failed to load galleries');
        if (!cancelled) setGalleries(data.galleries || []);
      } catch (e: any) {
        if (!cancelled) setBanner({ type: 'error', message: e?.message || 'Failed to load galleries' });
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    }
    loadPicker();
    return () => { cancelled = true; };
  }, []);

  async function deleteGallery() {
    if (!galleryId) return;
    if (!confirm('Delete this entire gallery and all of its photos?')) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/moments/galleries/${encodeURIComponent(galleryId)}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && data.error) ? data.error : 'Delete failed');
      setBanner({ type: 'success', message: 'Gallery deleted. Redirecting…' });
      window.location.href = '/admin';
    } catch (e: any) {
      setBanner({ type: 'error', message: e?.message || 'Failed to delete gallery' });
    }
    finally { setDeleting(false); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">Moments Admin</h1>
      {banner && (
        <div className={`mb-4 rounded border px-4 py-3 ${banner.type === 'error' ? 'border-red-700 bg-red-900/30 text-red-200' : 'border-green-700 bg-green-900/30 text-green-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>{banner.message}</div>
            <button className="opacity-80 hover:opacity-100" onClick={() => setBanner(null)}>✕</button>
          </div>
        </div>
      )}
      <div>
        <div className="mb-4">
          <label className="block text-sm mb-1">Select gallery</label>
          <div className="flex gap-2 items-center">
            <select
              value={galleryId}
              onChange={(e) => setGalleryId(e.target.value)}
              className="px-3 py-2 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] min-w-[240px]"
            >
              <option value="">{pickerLoading ? 'Loading…' : '— Choose a gallery —'}</option>
              {galleries.map((g) => (
                <option key={g.id} value={String(g.id)}>{g.title ? `${g.title} (#${g.id})` : `#${g.id}`}</option>
              ))}
            </select>
            <span className="text-sm opacity-70">or enter ID</span>
            <input value={galleryId} onChange={(e) => setGalleryId(e.target.value)} placeholder="Gallery ID" className="px-3 py-2 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733]" />
          </div>
          <div className="mt-3 flex gap-2">
            <a href={galleryId ? `/moments/gallery/${encodeURIComponent(galleryId)}` : '#'} aria-disabled={!galleryId} className="px-3 py-2 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] opacity-90 disabled:opacity-50">Open Public View</a>
            <button onClick={deleteGallery} disabled={!galleryId || deleting} className="px-3 py-2 rounded bg-red-800 text-white disabled:opacity-50 flex items-center gap-2">
              {deleting && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />}
              Delete Gallery
            </button>
          </div>
        </div>

        <div className="mb-6">
          <Moderation galleryId={galleryId} />
        </div>
      </div>
    </div>
  );
}

export default function MomentsAdminPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <AdminInner />
    </Suspense>
  );
}
