"use client";
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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

function MomentsIndex() {
  const params = useSearchParams();
  const prefillGalleryId = params?.get('galleryId') ?? '';
  const prefillIg = params?.get('ig') ?? '';
  const prefillCode = params?.get('code') ?? '';
  const wantOpen = params?.get('open') === '1';
  const [galleries, setGalleries] = useState<Array<{ id: number; title: string; created_at?: string; cover_url?: string | null; cover_thumb_url?: string | null }>>([]);
  const [galleryId, setGalleryId] = useState<string>(prefillGalleryId);
  const [ig, setIg] = useState<string>(prefillIg ? (prefillIg.startsWith('@') ? prefillIg : `@${prefillIg}`) : '');
  const [eventCode, setEventCode] = useState<string>(prefillCode);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<MomentsTab>(prefillGalleryId ? 'capture' : 'view');
  const [showCameraModal, setShowCameraModal] = useState(false);

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
    // Auto-open modal when directed from Featured button
    if (prefillGalleryId && (prefillIg || ig) && wantOpen) {
      setShowCameraModal(true);
    }
  }, [prefillGalleryId, prefillIg]);

  // If a galleryId is known but code is missing, resolve it for smoother uploads (Featured deep-link or manual ID)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!galleryId || eventCode) return;
      try {
        const res = await fetch(`/api/moments/galleries/${encodeURIComponent(galleryId)}`);
        const data: any = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && data?.gallery?.code) {
          setEventCode(String(data.gallery.code));
        }
      } catch {}
    })();
    return () => { active = false; };
  }, [galleryId, eventCode]);

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
              <CapturePanel onOpenCamera={() => setShowCameraModal(true)} galleryId={galleryId} setGalleryId={setGalleryId} ig={ig} setIg={setIg} />
            </section>
          )}
        </div>
      </main>
      {showCameraModal && (
        <CameraModal
          galleryId={galleryId}
          ig={ig}
          code={eventCode}
          onClose={() => setShowCameraModal(false)}
        />
      )}
    </div>
  );
}

export default function MomentsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-6 py-10 text-[#b2a491]">Loading…</div>}>
      <MomentsIndex />
    </Suspense>
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

function CapturePanel({ onOpenCamera, galleryId, setGalleryId, ig, setIg }: { onOpenCamera: () => void; galleryId: string; setGalleryId: (v: string) => void; ig: string; setIg: (v: string) => void }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canOpenCamera = !!(galleryId && galleryId.trim().length > 0);

  return (
    <div className="relative text-[#ede8df] rounded-3xl overflow-hidden min-h-[60vh] md:min-h-[50vh] border border-[#3b3733]/60 bg-gradient-to-b from-[#1a1511] via-[#141110] to-[#0c0b0a]">
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

            {/* Actions */}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if (!canOpenCamera) { setError('Enter Event ID to open camera'); return; }
                  onOpenCamera();
                }}
                disabled={!canOpenCamera}
                className="px-5 py-2.5 rounded-full bg-[#ede8df] text-[#171616] font-extrabold tracking-wide shadow-[0_10px_28px_rgba(237,232,223,0.25)] enabled:active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Open Camera
              </button>
            </div>

            {success && <div className="mt-4 p-3 rounded-lg border border-emerald-700/60 bg-emerald-900/30 text-emerald-200">{success}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CameraModal({ galleryId, ig, code, onClose }: { galleryId: string; ig: string; code?: string; onClose: () => void }) {
  const [aspect, setAspect] = useState<'9:16' | '3:4'>('9:16');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const headerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState<{width: number; height: number}>({ width: 0, height: 0 });
  const [isStarting, setIsStarting] = useState(false);

  const aspectRatio = useMemo(() => (aspect === '9:16' ? 9/16 : 3/4), [aspect]);

  async function waitForVideoReady(video: HTMLVideoElement) {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
    await new Promise<void>((resolve) => {
      const onReady = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          video.removeEventListener('loadedmetadata', onReady);
          video.removeEventListener('canplay', onReady);
          resolve();
        }
      };
      video.addEventListener('loadedmetadata', onReady);
      video.addEventListener('canplay', onReady);
      setTimeout(() => { video.removeEventListener('loadedmetadata', onReady); video.removeEventListener('canplay', onReady); resolve(); }, 2500);
    });
  }

  async function startCamera() {
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('Camera requires HTTPS (or localhost).');
        return;
      }
      // Stop any existing
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      // Prefer high quality while avoiding iOS Safari zooming; avoid aspectRatio constraint to prevent forced crop/zoom
      const idealWidth = facing === 'environment' ? 1920 : 1280;
      const idealHeight = facing === 'environment' ? 1080 : 720;
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing } as any,
          width: { ideal: idealWidth } as any,
          height: { ideal: idealHeight } as any,
          frameRate: { ideal: 30, max: 30 } as any
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef) {
        (videoRef as any).srcObject = stream;
        (videoRef as any).playsInline = true;
        (videoRef as any).muted = true;
        (videoRef as any).autoplay = true;
        try { await waitForVideoReady(videoRef); } catch {}
        await (videoRef as any).play?.().catch(() => {});
      }
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Camera failed');
    }
  }

  // Attach stream to video if ref becomes available after starting
  useEffect(() => {
    if (videoRef && streamRef.current) {
      try {
        (videoRef as any).srcObject = streamRef.current;
        (videoRef as any).playsInline = true;
        (videoRef as any).muted = true;
        (videoRef as any).autoplay = true;
        (videoRef as any).play?.().catch(() => {});
      } catch {}
    }
  }, [videoRef]);

  // Restart camera when facing/aspect change, but only after user starts once
  useEffect(() => {
    if (streamRef.current) {
      startCamera();
    }
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, aspect]);

  // Compute a preview box that fits in viewport along with header and controls (no scrolling needed for controls)
  useEffect(() => {
    function compute() {
      const vw = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
      const vh = Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight);
      const headerH = headerRef.current?.offsetHeight || 0;
      const controlsH = controlsRef.current?.offsetHeight || 0;
      const sidePadding = 16 * 2; // px-4 left+right
      const verticalGaps = 12 + 12; // approximate top/bottom gaps around box
      const availableH = Math.max(120, vh - headerH - controlsH - verticalGaps);
      // Width limited by viewport minus padding, and by available height * aspect
      const maxByHeight = availableH * aspectRatio;
      const maxByWidth = vw - sidePadding;
      const width = Math.max(240, Math.min(maxByWidth, maxByHeight));
      const height = Math.round(width / aspectRatio);
      setBoxSize({ width: Math.round(width), height });
    }
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(document.documentElement);
    window.addEventListener('orientationchange', compute);
    window.addEventListener('resize', compute);
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('orientationchange', compute);
      window.removeEventListener('resize', compute);
    };
  }, [aspectRatio]);

  function cropAndDrawToCanvas() {
    if (!videoRef || !canvasRef) return null;
    const vw = (videoRef as any).videoWidth || 0;
    const vh = (videoRef as any).videoHeight || 0;
    if (!vw || !vh) return null;
    // Compute crop to desired aspect
    const target = aspect === '9:16' ? 9/16 : 3/4;
    const srcAspect = vw / vh;
    let sw = vw, sh = vh, sx = 0, sy = 0;
    if (srcAspect > target) {
      // too wide, crop width
      sw = Math.round(vh * target);
      sx = Math.round((vw - sw) / 2);
    } else if (srcAspect < target) {
      // too tall, crop height
      sh = Math.round(vw / target);
      sy = Math.round((vh - sh) / 2);
    }
    canvasRef.width = sw;
    canvasRef.height = sh;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return null;
    const mirror = facing === 'user';
    if (mirror) {
      ctx.save();
      ctx.translate(sw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef, sx, sy, sw, sh, 0, 0, sw, sh);
      ctx.restore();
    } else {
      ctx.drawImage(videoRef, sx, sy, sw, sh, 0, 0, sw, sh);
    }
    return canvasRef.toDataURL('image/jpeg', 0.92);
  }

  function takePhoto() {
    const dataUrl = cropAndDrawToCanvas();
    if (!dataUrl) return;
    setPreview(dataUrl);
    const b = dataURLToBlob(dataUrl);
    setBlob(b);
  }

  function resetPhoto() {
    setPreview('');
    setBlob(null);
  }

  function dataURLToBlob(dataURL: string) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  function timeoutFetch(input: RequestInfo | URL, init: RequestInit = {}, ms = 15000): Promise<Response> {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
  }

  async function tryDirectUpload(filename: string) {
    // Get presigned URL
    const u = await timeoutFetch('/api/moments/upload-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ galleryId, fileName: filename, mediaType: 'photo' })
    });
    const uj: any = await u.json();
    if (!u.ok) throw new Error(uj?.error || 'Upload URL failed');
    // PUT to R2
    await timeoutFetch(uj.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob as Blob }, 20000);
    return uj.key as string;
  }

  async function tryProxyUpload(filename: string) {
    const fd = new FormData();
    fd.append('file', blob as Blob, filename);
    fd.append('galleryId', galleryId);
    if (code) fd.append('code', code);
    fd.append('mediaType', 'photo');
    fd.append('fileName', filename);
    const p = await timeoutFetch('/api/moments/upload-proxy', { method: 'POST', body: fd }, 30000);
    const pj: any = await p.json();
    if (!p.ok) throw new Error(pj?.error || 'Proxy upload failed');
    return pj.key as string;
  }

  async function upload() {
    if (!blob || !galleryId) { setError('Missing photo or Event ID'); return; }
    setUploading(true); setError('');
    try {
      const filename = `photo_${Date.now()}.jpg`;
      let key: string | null = null;
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      // Try direct first (2 attempts), then proxy (2 attempts)
      const attempts: Array<() => Promise<string>> = [
        () => tryDirectUpload(filename),
        () => tryDirectUpload(filename),
        () => tryProxyUpload(filename),
        () => tryProxyUpload(filename)
      ];
      if (!online) {
        // Prefer proxy first if offline status is reported (may still fail if no connectivity)
        attempts.unshift(() => tryProxyUpload(filename));
      }
      let lastErr: any = null;
      for (const fn of attempts) {
        try { key = await fn(); break; } catch (e) { lastErr = e; continue; }
      }
      if (!key) throw lastErr || new Error('Upload failed');

      const r = await timeoutFetch('/api/moments/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ galleryId, r2_key: key, original_filename: filename, user_name: ig || undefined, media_type: 'photo' }) });
      const rj: any = await r.json();
      if (!r.ok) throw new Error(rj?.error || 'Record failed');
  // Reset and auto-close shortly after success for smooth UX
  resetPhoto();
  setTimeout(() => { try { onClose(); } catch {} }, 700);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-[#1a1511]/95 via-[#0f0d0c]/90 to-[#0b0a09]/90 supports-[backdrop-filter]:backdrop-blur overflow-y-auto">
      <div className="min-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[calc(96px+env(safe-area-inset-bottom))]">
        {/* Header */}
        <div ref={headerRef} className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#1a1511]/70 supports-[backdrop-filter]:backdrop-blur border-b border-[#3b3733]/70">
          <div className="text-[#ede8df] font-semibold">Camera</div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/5 supports-[backdrop-filter]:backdrop-blur border border-[#3b3733] text-[#ede8df] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">Close</button>
        </div>

        {/* Preview area */}
        <div className="w-full max-w-screen mx-auto px-4">
          <div
            className="mx-auto rounded-2xl overflow-hidden border border-[#3b3733]/70 relative bg-[#0f0d0c] shadow-[0_10px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]"
            style={{ width: boxSize.width ? `${boxSize.width}px` : undefined, height: boxSize.height ? `${boxSize.height}px` : undefined }}
          >
            {!preview && (
              <>
                <video
                  ref={setVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full ${facing==='user' ? 'object-contain' : 'object-cover'}`}
                  style={facing==='user' ? { transform: 'scaleX(-1)' } : undefined}
                />
                {(!streamRef.current && !isStarting) && (
                  <div className="absolute inset-0 grid place-items-center bg-[#0b0a09]/50">
                    <button
                      onClick={() => { setIsStarting(true); startCamera().catch(() => setIsStarting(false)); }}
                      className="px-5 py-3 rounded-full bg-gradient-to-b from-[#ffb067] to-[#ff7a1a] text-[#171616] font-extrabold tracking-wide shadow-[0_10px_30px_rgba(255,122,26,0.25)] active:scale-95"
                    >
                      Open Camera
                    </button>
                  </div>
                )}
              </>
            )}
            <canvas ref={setCanvasRef} className="hidden" />
            {preview && (
              <img src={preview} alt="preview" className="h-full w-full object-contain bg-[#0f0d0c]" />
            )}
          </div>
          {error && <div className="mt-3 text-center text-red-300 text-sm">{error}</div>}
        </div>

        {/* Bottom controls bar (always visible) */}
        <div ref={controlsRef} className="fixed bottom-0 inset-x-0 z-20 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-[#140f0c]/90 to-[#0c0b0a]/50 supports-[backdrop-filter]:backdrop-blur border-t border-[#3b3733]/70">
          <div className="mx-auto max-w-[min(95vw,900px)] flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex rounded-full overflow-hidden border border-[#3b3733]/80 bg-white/5">
              <button onClick={() => setAspect('9:16')} className={`px-3 py-1.5 text-sm ${aspect==='9:16'?'bg-[#ff8a3d]/30 text-[#ffeedd]':'text-[#e8ded2]'}`}>9:16</button>
              <button onClick={() => setAspect('3:4')} className={`px-3 py-1.5 text-sm ${aspect==='3:4'?'bg-[#ff8a3d]/30 text-[#ffeedd]':'text-[#e8ded2]'}`}>3:4</button>
            </div>
            <button onClick={() => { setFacing(f => f==='environment'?'user':'environment'); }} className="px-3 py-1.5 rounded-full bg-white/5 supports-[backdrop-filter]:backdrop-blur border border-[#3b3733]/80 text-[#ede8df]">Switch</button>
            {!preview ? (
              <button onClick={takePhoto} className="px-4 py-2 rounded-full bg-gradient-to-b from-[#ffb067] to-[#ff7a1a] text-[#171616] font-extrabold tracking-wide shadow-[0_10px_30px_rgba(255,122,26,0.25)] active:scale-95">Capture</button>
            ) : (
              <>
                <button onClick={resetPhoto} className="px-3 py-1.5 rounded-full bg-white/5 supports-[backdrop-filter]:backdrop-blur border border-[#3b3733]/80 text-[#ede8df]">Reset</button>
                <button onClick={upload} disabled={uploading} className="px-4 py-2 rounded-full bg-[#1f1e1d] text-[#ede8df] border border-[#3b3733] disabled:opacity-50">{uploading ? 'Uploading…' : 'Upload'}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
