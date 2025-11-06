"use client";
import { useEffect, useState } from 'react';

export default function AdminLivePage() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState<any>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stream/live-input');
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load');
  setInfo((data as any).liveInput);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createLive() {
    setCreating(true);
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/stream/live-input', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to create');
  setInfo((data as any).liveInput);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#0b0a0a] text-[#ede8df]">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold">Live Stream</h1>
        <p className="text-sm text-white/70 mt-1">Create/retrieve a Cloudflare Stream Live Input for event streaming. Recording is automatic.</p>

        {error && <div className="mt-3 p-3 rounded border border-red-600 bg-red-900/20 text-red-300">{error}</div>}

        <div className="mt-4 flex gap-2">
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded bg-white/10 border border-white/20">{loading ? 'Refreshing…' : 'Refresh'}</button>
          <button onClick={createLive} disabled={creating} className="px-3 py-2 rounded bg-white/80 text-[#171616] font-semibold">{creating ? 'Ensuring…' : 'Ensure Live Input'}</button>
        </div>

        {info && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded border border-white/15 bg-white/5">
              <div className="font-semibold mb-2">Ingest</div>
              <div className="text-xs text-white/80">RTMPS URL</div>
              <div className="text-sm break-all">{info?.rtmps?.url || '–'}</div>
              <div className="mt-2 text-xs text-white/80">Stream Key</div>
              <div className="text-sm break-all">{info?.rtmps?.streamKey || '–'}</div>
            </div>
            <div className="p-4 rounded border border-white/15 bg-white/5">
              <div className="font-semibold mb-2">Playback</div>
              <div className="text-xs text-white/80">HLS</div>
              <div className="text-sm break-all">{info?.playback?.hls || '–'}</div>
              <div className="mt-2 text-xs text-white/80">Embed</div>
              <div className="text-sm break-all">{info?.playback?.embed || '–'}</div>
            </div>
            {info?.uid && (
              <div className="p-4 rounded border border-white/15 bg-white/5">
                <div className="font-semibold mb-2">Preview</div>
                <iframe
                  src={`https://iframe.videodelivery.net/${info.uid}`}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  className="w-full h-64 rounded border border-white/10"
                  title="Live Preview"
                />
              </div>
            )}
            <div className="text-xs text-white/70">
              Use OBS/Streamlabs to stream to the RTMPS URL with the provided Stream Key. Recording is automatic; after the stream ends, import the VOD via Admin → Videos → Sync All.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
