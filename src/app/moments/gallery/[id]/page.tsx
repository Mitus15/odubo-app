"use client";
import { useEffect, useMemo, useState } from 'react';

export default function GalleryViewer({ params, searchParams }: { params: { id: string }; searchParams?: { code?: string } }) {
  const id = Number(params.id);
  const [code, setCode] = useState<string>(searchParams?.code || '');
  const [photos, setPhotos] = useState<Array<any>>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const canFetch = useMemo(() => Number.isFinite(id), [id]);

  async function fetchPhotos() {
    if (!canFetch) return;
    setLoading(true);
    setError('');
    try {
      const url = new URL('/api/moments/list', window.location.origin);
      url.searchParams.set('galleryId', String(id));
  if (code) url.searchParams.set('code', code);
      url.searchParams.set('limit', '200');
  const res = await fetch(url.toString());
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load photos');
  setPhotos(Array.isArray(data?.photos) ? data.photos : []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canFetch) fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch]);

  // Auto-refresh while tab is visible
  useEffect(() => {
    if (!canFetch) return;
    let timer: any;
    let cancelled = false;
    function onVisibility() {
      if (document.hidden) return;
      fetchPhotos();
    }
    // staggered interval ~12s
    function start() {
      clearInterval(timer);
      timer = setInterval(() => {
        if (!document.hidden) fetchPhotos();
      }, 12000);
    }
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, id, code]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 pb-24">
        <h1 className="text-2xl font-bold mb-1">Gallery</h1>
        <div className="text-xs opacity-70 mb-4">ID: {id} • Public view (uploads require event code)</div>

        {error && <div className="mb-3 p-3 rounded border border-red-600 bg-red-900/20 text-red-300">{error}</div>}
        {loading && <div className="mb-3 text-sm text-[#b2a491]">Loading…</div>}

        {photos.length === 0 && !loading && (
          <div className="text-sm text-[#b2a491]">No photos yet.</div>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((p: any) => (
              <figure key={p.id} className="rounded overflow-hidden border border-[#3b3733] bg-[#1f1e1d]">
                {p.media_type === 'video' ? (
                  <video src={p.r2_url} controls className="w-full h-auto" />
                ) : (
                  <img src={p.thumbnail_url || p.r2_url} alt={p.original_filename || 'photo'} className="w-full h-auto" />
                )}
                <figcaption className="p-2 text-xs text-[#b2a491] flex items-center justify-between">
                  <span>{p.user_name || 'Anon'}</span>
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
