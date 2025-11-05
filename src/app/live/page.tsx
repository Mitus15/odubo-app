"use client";
import { useEffect, useState } from 'react';

export default function LivePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stream/live-input');
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load');
        setUid(data?.liveInput?.uid || null);
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0a0a] text-[#ede8df]">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold">Live</h1>
        <p className="text-sm text-white/70 mt-1">Live stream player (Cloudflare Stream)</p>
        {loading && <div className="mt-4 text-white/80">Loading…</div>}
        {error && <div className="mt-4 p-3 rounded border border-red-600 bg-red-900/20 text-red-300">{error}</div>}
        {uid ? (
          <div className="mt-6">
            <div className="aspect-video w-full rounded border border-white/10 overflow-hidden">
              <iframe
                src={`https://iframe.videodelivery.net/${uid}`}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                className="w-full h-full"
                title="Live"
              />
            </div>
          </div>
        ) : (!loading && !error ? (
          <div className="mt-6 text-white/70">Live stream is not yet configured.</div>
        ) : null)}
      </div>
    </main>
  );
}
