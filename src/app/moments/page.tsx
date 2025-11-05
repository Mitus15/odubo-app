"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Minimal inline icons (no extra deps)
function IconCamera(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 8.5h3l1.5-2h8L17 8.5h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/>
      <circle cx="12" cy="14" r="3.5"/>
    </svg>
  );
}
function IconKey(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="8" cy="9" r="3"/>
      <path d="M10.5 10.5l5 5v2h2v-2h2v-2l-5-5"/>
    </svg>
  );
}
function IconQr(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 14h4v4h-4zM14 18h2v3h-2z"/>
    </svg>
  );
}
function IconFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H3z"/>
    </svg>
  );
}

type MomentsTab = 'view' | 'capture';

export default function MomentsIndex() {
  const params = useSearchParams();
  const prefillGalleryId = params?.get('galleryId') ?? '';
  const prefillIg = params?.get('ig') ?? '';
  const [galleries, setGalleries] = useState<Array<{ id: number; title: string; created_at?: string; cover_url?: string | null; cover_thumb_url?: string | null }>>([]);
  const [galleryId, setGalleryId] = useState<string>(prefillGalleryId);
  const [ig, setIg] = useState<string>(prefillIg ? (prefillIg.startsWith('@') ? prefillIg : `@${prefillIg}`) : '');
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<MomentsTab>(prefillGalleryId ? 'capture' : 'view');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/moments/galleries/public?limit=12');
        const data: any = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.galleries)) {
          setGalleries(
            data.galleries.map((g: any) => ({ id: g.id, title: g.title, created_at: g.created_at, cover_url: g.cover_url, cover_thumb_url: g.cover_thumb_url }))
          );
        }
      } catch (e) {
        console.error('Failed loading galleries', e);
      }
    })();
  }, []);

  useEffect(() => {
    // Prefill IG from URL or localStorage
    if (prefillIg) {
      try { localStorage.setItem('instagramHandle', prefillIg.replace(/^@/, '')); } catch {}
    } else {
      try {
        const stored = localStorage.getItem('instagramHandle');
        if (stored && !ig) setIg(stored.startsWith('@') ? stored : `@${stored}`);
      } catch {}
    }
    if (prefillGalleryId) setTab('capture');
  }, [prefillGalleryId, prefillIg]);

  return (
    // Scroll within the app layout's overflow-hidden main area
    <div className="h-full overflow-y-auto bg-gradient-to-b from-[#171616] via-[#1b1a19] to-[#171616]">
      {/* Sticky minimal tabs */}
      <div className="sticky top-0 z-30 bg-[#141312]/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-[#262321]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          {(['view','capture'] as MomentsTab[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={'text-[15px] font-semibold transition-colors ' + (tab === k ? 'text-[#ede8df]' : 'text-[#8f8271] hover:text-[#cfc2ae]')}
            >
              {k === 'view' ? 'View' : 'Capture'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-24">
        <div className="mt-6">
          {tab === 'view' ? (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[18px] font-semibold text-[#ede8df]">Galleries</h2>
              </div>
              <GalleryGrid galleries={galleries} />
            </section>
          ) : (
            <section ref={captureRef}>
              <CapturePanel galleryId={galleryId} setGalleryId={setGalleryId} ig={ig} setIg={setIg} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
function GalleryGrid({ galleries }: { galleries: Array<{ id: number; title: string; created_at?: string; cover_url?: string | null; cover_thumb_url?: string | null }> }) {
  if (!galleries?.length) return <div className="text-[13px] text-[#b2a491]">No galleries yet.</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {galleries.map((g) => (
        <Link key={g.id} href={`/moments/gallery/${g.id}`} className="group block rounded-xl overflow-hidden border border-[#3b3733] bg-[#1f1e1d] hover:border-white/30">
          <div className="aspect-[4/3] bg-[#2a2626] overflow-hidden">
            {g.cover_thumb_url || g.cover_url ? (
              <img src={(g.cover_thumb_url || g.cover_url)!} alt={g.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#502d26] to-[#6b4c3b]" />
            )}
          </div>
          <div className="p-3">
            <div className="text-sm font-semibold text-[#ede8df] line-clamp-2">{g.title}</div>
            <div className="text-[11px] text-[#b2a491]">ID: {g.id}{g.created_at ? ` • ${new Date(g.created_at).toLocaleDateString()}` : ''}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CapturePanel({ galleryId, setGalleryId, ig, setIg }: { galleryId: string; setGalleryId: (v: string) => void; ig: string; setIg: (v: string) => void }) {
  const [cameraStarted, setCameraStarted] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canOpenCamera = !!(galleryId && galleryId.trim().length > 0);

  async function startCamera() {
    try {
      if (!canOpenCamera) { setError('Enter Event ID to open camera'); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (videoRef) {
        (videoRef as any).srcObject = stream;
        await (videoRef as any).play?.();
        setCameraStarted(true);
      }
    } catch (e: any) {
      setError(e?.message || 'Camera failed');
    }
  }

  function takePhoto() {
    if (!videoRef || !canvasRef) return;
    const vw = (videoRef as any).videoWidth || 0;
    const vh = (videoRef as any).videoHeight || 0;
    if (!vw || !vh) return;
    canvasRef.width = vw;
    canvasRef.height = vh;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef, 0, 0, vw, vh);
    const dataUrl = canvasRef.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    const b = dataURLToBlob(dataUrl);
    setBlob(b);
  }

  function dataURLToBlob(dataURL: string) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  async function upload() {
    if (!blob || !galleryId) { setError('Missing photo or Event ID'); return; }
    setUploading(true); setError(''); setSuccess('');
    try {
      const filename = `photo_${Date.now()}.jpg`;
      const u = await fetch('/api/moments/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ galleryId, fileName: filename, mediaType: 'photo' }) });
      const uj: any = await u.json();
      if (!u.ok) throw new Error(uj?.error || 'Upload URL failed');
      await fetch(uj.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      const r = await fetch('/api/moments/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ galleryId, r2_key: uj.key, original_filename: filename, user_name: ig || undefined, media_type: 'photo' }) });
      const rj: any = await r.json();
      if (!r.ok) throw new Error(rj?.error || 'Record failed');
      setSuccess('Uploaded! It will appear in the gallery shortly.');
      setBlob(null); setPreview('');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative text-[#ede8df] rounded-3xl overflow-hidden min-h-[100vh] md:min-h-[80vh] border border-[#3b3733]/60 bg-gradient-to-b from-[#1a1511] via-[#141110] to-[#0c0b0a]">
      {/* Ambient liquid highlights */}
      <div
        className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, #ff8a3d, rgba(255,138,61,0.2) 70%, transparent 100%)' }}
      />
      <div
        className="pointer-events-none absolute bottom-[-80px] left-[-40px] h-72 w-72 rounded-full blur-3xl opacity-20"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, #6b4c3b, rgba(107,76,59,0.15) 70%, transparent 100%)' }}
      />

      {/* Glass panel for controls */}
      <div className="relative p-5 md:p-8">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white/5 supports-[backdrop-filter]:backdrop-blur border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="p-5 md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold tracking-tight">Capture</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-sm col-span-1 md:col-span-1">Event ID
                <input
                  value={galleryId}
                  onChange={(e) => setGalleryId(e.target.value)}
                  placeholder="123"
                  className="mt-1 w-full rounded-lg bg-[#1f1a17]/80 border border-white/10 px-4 py-2.5 text-[#efe9df] placeholder-[#9f9381] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/50 focus:border-[#ff8a3d]/40"
                />
              </label>
              <label className="text-sm col-span-1 md:col-span-2">Instagram (optional)
                <input
                  value={ig}
                  onChange={(e) => { const v = e.target.value.trim(); setIg(v.startsWith('@')? v : (v ? `@${v}` : '')); try { localStorage.setItem('instagramHandle', (e.target.value || '').replace(/^@/, '')); } catch {} }}
                  placeholder="@yourhandle"
                  className="mt-1 w-full rounded-lg bg-[#1f1a17]/80 border border-white/10 px-4 py-2.5 text-[#efe9df] placeholder-[#9f9381] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/50 focus:border-[#ff8a3d]/40"
                />
              </label>
            </div>

            {error && <div className="mt-4 p-3 rounded-lg border border-red-700/70 bg-red-900/30 text-red-200">{error}</div>}

            {/* Camera area */}
            {cameraStarted && (
              <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-black/90 shadow-lg">
                <video ref={setVideoRef} autoPlay playsInline muted className="w-full h-auto" />
                <canvas ref={setCanvasRef} style={{ display: 'none' }} />
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex flex-wrap gap-3">
              {!cameraStarted ? (
                <button
                  onClick={startCamera}
                  disabled={!canOpenCamera}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-b from-[#ffb067] to-[#ff7a1a] text-[#171616] font-extrabold tracking-wide shadow-[0_10px_30px_rgba(255,122,26,0.25)] enabled:active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Open Camera
                </button>
              ) : (
                <>
                  <button onClick={takePhoto} className="px-5 py-2.5 rounded-full bg-[#efe9df] text-[#171616] font-semibold enabled:active:scale-95">Capture</button>
                  <button
                    onClick={upload}
                    disabled={!blob || uploading}
                    className="px-5 py-2.5 rounded-full bg-[#1f1e1d] text-[#ede8df] border border-[#3b3733] enabled:active:scale-95 disabled:opacity-50"
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </>
              )}
            </div>

            {preview && (
              <div className="mt-4">
                <img src={preview} alt="preview" className="rounded-xl border border-white/10 max-h-72" />
              </div>
            )}
            {success && <div className="mt-4 p-3 rounded-lg border border-emerald-700/60 bg-emerald-900/30 text-emerald-200">{success}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
