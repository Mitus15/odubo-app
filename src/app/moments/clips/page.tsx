"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Clip {
  id: number;
  event_id: number;
  event_title: string;
  event_code: string;
  user_name: string | null;
  r2_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  caption: string | null;
  view_count: number;
  is_pinned: number;
  created_at: string;
}

function MomentsClipsContent() {
  const params = useSearchParams();
  const eventId = params?.get('eventId');
  const code = params?.get('code');

  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const fetchClips = useCallback(async (append = false) => {
    if (!eventId && !code) {
      setError('No event specified');
      setLoading(false);
      return;
    }

    if (append) setLoadingMore(true); else setLoading(true);
    setError('');

    try {
      const url = new URL('/api/moments/clips/list', window.location.origin);
      if (eventId) url.searchParams.set('eventId', eventId);
      if (code) url.searchParams.set('galleryId', code);
      if (append) url.searchParams.set('offset', String(clips.length));

      const res = await fetch(url.toString());
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'Failed to load clips');

      const newClips = data.clips || [];
      setClips(prev => append ? [...prev, ...newClips] : newClips);
      setHasMore(data.pagination?.has_more || false);
    } catch (e: any) {
      setError(e?.message || 'Failed to load clips');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [eventId, code, clips.length]);

  useEffect(() => {
    fetchClips(false);
  }, [fetchClips]);

  // Intersection observer for auto-play
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const clipId = Number(entry.target.getAttribute('data-clip-id'));
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setCurrentIndex(clipId);
            const video = videoRefs.current.get(clipId);
            if (video) {
              video.currentTime = 0;
              video.play().catch(() => {});
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    document.querySelectorAll('.clip-video').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [clips]);

  const toggleMute = () => setMuted(m => !m);

  const currentClip = clips[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error && clips.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-4">Clips</h1>
          <p className="text-white/60 mb-4">{error}</p>
          <Link href="/moments" className="text-[#ff8a3d] underline">
            Back to Moments
          </Link>
        </div>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-4">Clips</h1>
          <p className="text-white/60 mb-4">No clips yet. Be the first to capture a highlight!</p>
          <Link href="/moments/capture" className="text-[#ff8a3d] underline">
            Go to Capture
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/moments" className="text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-white font-bold">Clips</h1>
          <button onClick={toggleMute} className="text-white p-2">
            {muted ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Clips Feed - Vertical Scroll */}
      <div ref={containerRef} className="h-screen overflow-y-scroll snap-y snap-mandatory">
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            data-clip-id={clip.id}
            className="clip-video h-screen w-full snap-start relative"
          >
            <video
              ref={(el) => { if (el) videoRefs.current.set(clip.id, el); }}
              src={clip.r2_url}
              className="w-full h-full object-cover"
              playsInline
              muted={muted || index !== currentIndex}
              loop
              poster={clip.thumbnail_url}
              onClick={() => {
                const video = videoRefs.current.get(clip.id);
                if (video?.paused) video.play();
                else video?.pause();
              }}
            />

            {/* Overlay Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  {clip.user_name && (
                    <p className="text-white/80 text-sm mb-1">@{clip.user_name}</p>
                  )}
                  {clip.caption && (
                    <p className="text-white text-sm">{clip.caption}</p>
                  )}
                  <p className="text-white/60 text-xs mt-1">
                    {clip.event_title} • {clip.view_count} views
                  </p>
                </div>
              </div>
            </div>

            {/* Side Actions */}
            <div className="absolute right-4 bottom-20 flex flex-col gap-4">
              <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 flex justify-center">
          <button
            onClick={() => fetchClips(true)}
            disabled={loadingMore}
            className="px-6 py-2 bg-white/20 rounded-full text-white text-sm"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function MomentsClipsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <MomentsClipsContent />
    </Suspense>
  );
}