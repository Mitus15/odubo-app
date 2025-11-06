"use client";
import { useState } from 'react';

export default function JoinMomentsPage() {
  const [code, setCode] = useState('');
  const [gallery, setGallery] = useState<any | null>(null);
  const [error, setError] = useState('');

  async function lookup() {
    setError('');
    try {
      const res = await fetch(`/api/moments/join?code=${encodeURIComponent(code)}`);
      const data = (await res.json()) as any; // typed as any to satisfy TS and allow error extraction
      if (!res.ok) throw new Error(data?.error || 'Failed to find');
      setGallery(data.gallery);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Moments Gallery</h1>
      <div className="mb-4">
        <label className="block text-sm">Enter gallery code</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full px-3 py-2 rounded bg-[#171616] text-[#ede8df]" />
      </div>
      <button onClick={lookup} className="px-4 py-2 rounded bg-[#ede8df] text-[#171616]">Join</button>

      {error && <div className="mt-4 text-red-400">{error}</div>}

      {gallery && (
        <div className="mt-6 p-4 bg-[#302927]/40 border border-[#b2a491]/20 rounded">
          <h2 className="font-semibold">{gallery.title}</h2>
          <div className="text-sm text-[#b2a491]">Event runs from {gallery.starts_at || 'N/A'} to {gallery.ends_at || 'N/A'}</div>
          <div className="mt-3 flex gap-2">
            <a
              href={`/moments?galleryId=${gallery.id}&code=${encodeURIComponent(gallery.code)}&starts_at=${encodeURIComponent(gallery.starts_at || '')}&ends_at=${encodeURIComponent(gallery.ends_at || '')}`}
              className="px-4 py-2 rounded bg-[#502d26] text-[#ede8df] hover:bg-[#6b4c3b] transition-colors"
            >
              Open Camera
            </a>
            <a
              href={`/moments/gallery/${gallery.id}?code=${encodeURIComponent(gallery.code)}`}
              className="px-4 py-2 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] hover:bg-[#2a2626] transition-colors"
            >
              View Gallery
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
