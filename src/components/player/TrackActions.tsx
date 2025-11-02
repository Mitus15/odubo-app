'use client';

import React, { useEffect, useState } from 'react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

export default function TrackActions() {
  const { state } = useMusicPlayer();
  const [liked, setLiked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        if (!state.currentTrack) return;
        const u = `/api/likes/check?item_id=${encodeURIComponent(state.currentAlbum?.id || state.currentTrack.id)}&type=${state.currentAlbum ? 'album' : 'track'}`;
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) { setLiked(null); return; }
  const data = (await res.json()) as { liked?: boolean };
  if (mounted) setLiked(!!data && data.liked === true);
      } catch {
        if (mounted) setLiked(null);
      }
    };
    check();
    return () => { mounted = false; };
  }, [state.currentTrack?.id]);

  const toggleLike = async () => {
    if (!state.currentTrack || busy) return;
    setBusy(true);
    try {
      const itemId = state.currentAlbum ? state.currentAlbum.id : state.currentTrack.id;
      const type = state.currentAlbum ? 'album' : 'track';
      const res = await fetch('/api/likes', {
        method: liked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, type }),
      });
      if (res.ok) setLiked(!liked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={toggleLike} disabled={busy} className={`p-2 rounded-full transition-colors ${liked ? 'text-[#843c2d]' : 'text-[#b2a491] hover:text-[#ede8df]'} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`} aria-pressed={!!liked} aria-label={liked ? 'Unlike' : 'Like'}>
        {liked ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.22 2.53C11.09 5.01 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"/></svg>
        )}
      </button>
    </div>
  );
}
