"use client";
import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

type MomentsTab = 'view' | 'capture';

interface Gallery {
  id: number;
  title: string;
  code?: string;
  created_at?: string;
  photo_count?: number;
  preview_photos?: Array<{ id: number; thumbnail_url?: string; r2_url: string }>;
}

function MomentsIndex() {
  const params = useSearchParams();
  const prefillGalleryId = params?.get('galleryId') ?? '';
  const prefillIg = params?.get('ig') ?? '';
  const prefillCode = params?.get('code') ?? '';

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryId, setGalleryId] = useState<string>(prefillGalleryId);
  const [ig, setIg] = useState<string>(prefillIg ? (prefillIg.startsWith('@') ? prefillIg : `@${prefillIg}`) : '');
  const [eventCode, setEventCode] = useState<string>(prefillCode);
  const [tab, setTab] = useState<MomentsTab>('view');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleOpenCamera = () => setShowTermsModal(true);
  const handleAcceptTerms = () => { setShowTermsModal(false); setShowCameraModal(true); };
  const handleDeclineTerms = () => setShowTermsModal(false);

  const refreshGalleries = useCallback(async () => {
    try {
      setGalleryLoading(true);
      const res = await fetch('/api/moments/galleries/public?limit=12&preview=true');
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.galleries)) setGalleries(data.galleries);
    } catch {
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  useEffect(() => { refreshGalleries(); }, [refreshGalleries]);

  useEffect(() => {
    if (prefillIg) {
      try { localStorage.setItem('instagramHandle', prefillIg.replace(/^@/, '')); } catch {}
    } else {
      try {
        const stored = localStorage.getItem('instagramHandle');
        if (stored && !ig) setIg(stored.startsWith('@') ? stored : `@${stored}`);
      } catch {}
    }
  }, [prefillIg, ig]);

  useEffect(() => {
    if (!galleryId || eventCode) return;
    fetch(`/api/moments/galleries/${encodeURIComponent(galleryId)}`)
      .then(res => res.json())
      .then(data => { if (data?.gallery?.code) setEventCode(String(data.gallery.code)); })
      .catch(() => {});
  }, [galleryId, eventCode]);

  return (
    <div className="min-h-full bg-[#171616]">
      {/* Tab Navigation - mobile only, desktop just shows Galleries */}
      <div className="md:hidden sticky top-0 z-30 bg-[#171616]/95 backdrop-blur-md border-b border-[#502d26]/20">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="inline-flex p-1 rounded-xl bg-[#1a1918]/80 border border-[#502d26]/30 backdrop-blur-sm">
            {(['view', 'capture'] as MomentsTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? 'bg-gradient-to-r from-[#843c2d] via-[#9a4535] to-[#6d3224] text-[#f8f2ea] shadow-lg shadow-[#843c2d]/25'
                    : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-white/5'
                }`}
              >
                {t === 'view' ? 'Galleries' : 'Capture'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {/* Desktop always shows galleries, mobile respects tab state */}
        <div className="hidden md:block">
          <GalleryGrid galleries={galleries} loading={galleryLoading} />
        </div>
        <div className="md:hidden">
          {tab === 'view' ? (
            <GalleryGrid galleries={galleries} loading={galleryLoading} />
          ) : (
            <CapturePanel
              onOpenCamera={handleOpenCamera}
              galleryId={galleryId}
              setGalleryId={setGalleryId}
              ig={ig}
              setIg={setIg}
            />
          )}
        </div>
      </main>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171616] border border-[#502d26]/40 rounded-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-[#502d26]/30">
              <h2 className="text-lg font-semibold text-[#ede8df]">Terms</h2>
            </div>
            <div className="px-6 py-4 text-sm text-[#b2a491] space-y-3 max-h-[40vh] overflow-y-auto">
              <p>By uploading, you grant a perpetual license to use your content for any lawful purpose.</p>
              <p>Your content may be publicly displayed, shared on social media, or used in marketing materials.</p>
              <p>You confirm you own the content and it does not violate any third-party rights.</p>
            </div>
            <div className="px-6 py-4 border-t border-[#502d26]/30 flex gap-3">
              <button onClick={handleDeclineTerms} className="flex-1 py-2.5 rounded-lg border border-[#502d26]/40 text-[#b2a491] text-sm font-medium hover:border-[#ede8df]/30 transition-colors">
                Decline
              </button>
              <button onClick={handleAcceptTerms} className="flex-1 py-2.5 rounded-lg bg-[#ede8df] text-[#171616] text-sm font-semibold">
                Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {showCameraModal && (
        <CameraModal
          galleryId={galleryId}
          ig={ig}
          code={eventCode}
          onClose={() => setShowCameraModal(false)}
          onUploadSuccess={refreshGalleries}
        />
      )}
    </div>
  );
}

export default function MomentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#171616] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" /></div>}>
      <MomentsIndex />
    </Suspense>
  );
}

function GalleryGrid({ galleries, loading }: { galleries: Gallery[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-8">
        {/* Hero skeleton */}
        <div className="animate-pulse">
          <div className="aspect-[16/9] sm:aspect-[21/9] rounded-2xl bg-[#252221]" />
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] rounded-xl bg-[#252221]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (galleries.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#302927] to-[#252221] flex items-center justify-center border border-[#502d26]/20">
          <svg className="w-10 h-10 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[#ede8df] mb-1">No galleries yet</h3>
        <p className="text-sm text-[#726d6c]">Check back soon for event photos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {galleries.map((gallery, index) => (
          <Link
            key={gallery.id}
            href={`/moments/gallery/${gallery.id}`}
            className={`group block ${index === 0 ? 'col-span-2 sm:col-span-2' : ''}`}
          >
            <div className={`relative rounded-xl overflow-hidden bg-[#1a1918] border border-[#502d26]/20 group-hover:border-[#843c2d]/40 transition-colors ${
              index === 0 ? 'aspect-video' : 'aspect-square'
            }`}>
              {gallery.preview_photos && gallery.preview_photos.length > 0 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gallery.preview_photos[0].thumbnail_url || gallery.preview_photos[0].r2_url}
                    alt={gallery.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#252221] via-[#1a1918] to-[#252221]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/odubo_logo_emboss.png"
                    alt=""
                    className="w-16 h-16 object-contain opacity-20"
                    draggable={false}
                  />
                  <span className="mt-2 text-[10px] text-[#502d26]/60 uppercase tracking-widest">
                    Coming Soon
                  </span>
                </div>
              )}

              {/* Photo count badge */}
              {gallery.photo_count !== undefined && gallery.photo_count > 0 && (
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-xs text-white font-medium flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                  </svg>
                  {gallery.photo_count}
                </div>
              )}

              {/* Featured badge for first item */}
              {index === 0 && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#843c2d] text-xs text-white font-semibold uppercase tracking-wide">
                  Featured
                </div>
              )}

              {/* Content overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className={`font-semibold text-white mb-1 line-clamp-2 group-hover:text-[#f0e4d8] transition-colors ${
                  index === 0 ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
                }`}>
                  {gallery.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  {gallery.created_at && (
                    <span>{new Date(gallery.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  )}
                  {gallery.photo_count !== undefined && gallery.photo_count > 0 && index === 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/40" />
                      <span>{gallery.photo_count} photos</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CapturePanel({ onOpenCamera, galleryId, setGalleryId, ig, setIg }: {
  onOpenCamera: () => void;
  galleryId: string;
  setGalleryId: (v: string) => void;
  ig: string;
  setIg: (v: string) => void;
}) {
  const [error, setError] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => {
    if (!galleryId?.trim()) { setStartsAt(null); setEndsAt(null); return; }
    setScheduleLoading(true);
    fetch(`/api/moments/galleries/${encodeURIComponent(galleryId)}`)
      .then(res => res.json())
      .then(data => {
        if (data?.gallery) {
          setStartsAt(data.gallery.starts_at ? new Date(data.gallery.starts_at) : null);
          setEndsAt(data.gallery.ends_at ? new Date(data.gallery.ends_at) : null);
        }
      })
      .catch(() => {})
      .finally(() => setScheduleLoading(false));
  }, [galleryId]);

  const now = new Date();
  const beforeStart = startsAt ? now < startsAt : false;
  const afterEnd = endsAt ? now > endsAt : false;
  const windowOpen = !beforeStart && !afterEnd;
  const canOpen = !!(galleryId?.trim());

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-2xl border border-[#502d26]/30 bg-[#1a1918] p-6">
        <h2 className="text-lg font-semibold text-[#ede8df] mb-4">Capture Photos</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#726d6c] mb-1.5">Event ID</label>
            <input
              value={galleryId}
              onChange={e => setGalleryId(e.target.value)}
              placeholder="Enter gallery ID"
              className="w-full px-3 py-2.5 rounded-lg bg-[#302927] border border-[#502d26]/30 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:border-[#843c2d]/50"
            />
          </div>

          <div>
            <label className="block text-xs text-[#726d6c] mb-1.5">Instagram (optional)</label>
            <input
              value={ig}
              onChange={e => {
                const v = e.target.value.trim();
                setIg(v.startsWith('@') ? v : (v ? `@${v}` : ''));
                try { localStorage.setItem('instagramHandle', v.replace(/^@/, '')); } catch {}
              }}
              placeholder="@yourhandle"
              className="w-full px-3 py-2.5 rounded-lg bg-[#302927] border border-[#502d26]/30 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:border-[#843c2d]/50"
            />
          </div>

          {scheduleLoading && <p className="text-xs text-[#726d6c]">Checking schedule...</p>}
          {!scheduleLoading && startsAt && (
            <p className="text-xs text-[#726d6c]">
              {beforeStart ? `Opens ${startsAt.toLocaleString()}` : afterEnd ? 'Event ended' : 'Live now'}
            </p>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          {windowOpen ? (
            <button
              onClick={() => {
                if (!canOpen) { setError('Enter Event ID'); return; }
                setError('');
                onOpenCamera();
              }}
              disabled={!canOpen}
              className="w-full py-3 rounded-lg bg-[#ede8df] text-[#171616] font-semibold text-sm disabled:opacity-50"
            >
              Open Camera
            </button>
          ) : afterEnd ? (
            <Link
              href={`/moments/gallery/${galleryId}`}
              className="block w-full py-3 rounded-lg bg-[#302927] text-[#b2a491] font-medium text-sm text-center"
            >
              View Gallery
            </Link>
          ) : (
            <div className="text-center py-4 text-[#726d6c] text-sm">
              Event not yet open
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Camera Modal types
type UploadQueueItem = {
  id: string;
  preview: string;
  blob: Blob;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
};

function CameraModal({ galleryId, ig, code, onClose, onUploadSuccess }: {
  galleryId: string;
  ig: string;
  code?: string;
  onClose: () => void;
  onUploadSuccess?: () => void | Promise<void>;
}) {
  const [aspect, setAspect] = useState<'9:16' | '3:4'>('9:16');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [hasFlash, setHasFlash] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const aspectRatio = useMemo(() => (aspect === '9:16' ? 9 / 16 : 3 / 4), [aspect]);

  async function startCamera() {
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('Camera requires HTTPS');
        return;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: facing === 'environment' ? 1920 : 1280 },
          height: { ideal: facing === 'environment' ? 1080 : 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.() as any;
        setHasFlash(!!(capabilities?.torch));
        if (capabilities?.torch && flashMode === 'on') {
          await videoTrack.applyConstraints({ advanced: [{ torch: true } as any] }).catch(() => {});
        }
      }

      if (videoRef) {
        videoRef.srcObject = stream;
        videoRef.playsInline = true;
        videoRef.muted = true;
        videoRef.autoplay = true;
        await videoRef.play().catch(() => {});
      }
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Camera failed');
    }
  }

  useEffect(() => {
    if (videoRef && streamRef.current) {
      videoRef.srcObject = streamRef.current;
      videoRef.play().catch(() => {});
    }
  }, [videoRef]);

  useEffect(() => {
    if (streamRef.current) startCamera();
  }, [facing, aspect]);

  useEffect(() => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    const capabilities = videoTrack.getCapabilities?.() as any;
    if (capabilities?.torch) {
      videoTrack.applyConstraints({ advanced: [{ torch: flashMode === 'on' } as any] }).catch(() => {});
    }
  }, [flashMode]);

  function cropAndDraw() {
    if (!videoRef || !canvasRef) return null;
    const vw = videoRef.videoWidth || 0;
    const vh = videoRef.videoHeight || 0;
    if (!vw || !vh) return null;
    const target = aspect === '9:16' ? 9 / 16 : 3 / 4;
    const srcAspect = vw / vh;
    let sw = vw, sh = vh, sx = 0, sy = 0;
    if (srcAspect > target) {
      sw = Math.round(vh * target);
      sx = Math.round((vw - sw) / 2);
    } else if (srcAspect < target) {
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
    const dataUrl = cropAndDraw();
    if (!dataUrl) return;
    const b = dataURLToBlob(dataUrl);
    const queueItem: UploadQueueItem = {
      id: `${Date.now()}_${Math.random()}`,
      preview: dataUrl,
      blob: b,
      status: 'pending',
    };
    setUploadQueue(prev => [...prev, queueItem]);
  }

  function removeFromQueue(id: string) {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
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

  async function tryDirectUpload(filename: string, blob: Blob) {
    const u = await timeoutFetch('/api/moments/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ galleryId, fileName: filename, mediaType: 'photo' }),
    });
    const uj: any = await u.json();
    if (!u.ok) throw new Error(uj?.error || 'Upload URL failed');
    await timeoutFetch(uj.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob }, 20000);
    return uj.key as string;
  }

  async function tryProxyUpload(filename: string, blob: Blob) {
    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('galleryId', galleryId);
    if (code) fd.append('code', code);
    fd.append('mediaType', 'photo');
    fd.append('fileName', filename);
    const p = await timeoutFetch('/api/moments/upload-proxy', { method: 'POST', body: fd }, 30000);
    const pj: any = await p.json();
    if (!p.ok) throw new Error(pj?.error || 'Proxy upload failed');
    return pj.key as string;
  }

  async function uploadItem(item: UploadQueueItem) {
    if (!galleryId) throw new Error('Missing gallery ID');
    const filename = `photo_${Date.now()}.jpg`;
    let key: string | null = null;
    const attempts = [
      () => tryDirectUpload(filename, item.blob),
      () => tryDirectUpload(filename, item.blob),
      () => tryProxyUpload(filename, item.blob),
      () => tryProxyUpload(filename, item.blob),
    ];
    let lastErr: any = null;
    for (const fn of attempts) {
      try { key = await fn(); break; } catch (e) { lastErr = e; }
    }
    if (!key) throw lastErr || new Error('Upload failed');
    const r = await timeoutFetch('/api/moments/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ galleryId, r2_key: key, original_filename: filename, user_name: ig || undefined, media_type: 'photo' }),
    });
    const rj: any = await r.json();
    if (!r.ok) throw new Error(rj?.error || 'Record failed');
  }

  async function batchUploadAll() {
    const pending = uploadQueue.filter(item => item.status === 'pending');
    if (pending.length === 0) return;
    setIsBatchUploading(true);
    setError('');
    for (const item of pending) {
      setUploadQueue(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'uploading' } : i)));
      try {
        await uploadItem(item);
        setUploadQueue(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'success' } : i)));
        setTimeout(() => setUploadQueue(prev => prev.filter(i => i.id !== item.id)), 1500);
      } catch (e: any) {
        setUploadQueue(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'error', error: e?.message } : i)));
      }
    }
    setIsBatchUploading(false);
    if (onUploadSuccess) onUploadSuccess();
  }

  const pendingCount = uploadQueue.filter(i => i.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 bg-[#171616] flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-[#502d26]/30">
        <span className="text-[#ede8df] font-medium text-sm">Camera</span>
        <div className="flex items-center gap-3">
          {galleryId && (
            <Link href={`/moments/gallery/${galleryId}`} className="text-xs text-[#843c2d]">
              View Gallery
            </Link>
          )}
          <button onClick={onClose} className="text-[#b2a491] hover:text-[#ede8df]">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Upload queue */}
      {uploadQueue.length > 0 && (
        <div className="flex-none px-4 py-3 border-b border-[#502d26]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#726d6c]">{pendingCount} ready</span>
            {pendingCount > 0 && (
              <button
                onClick={batchUploadAll}
                disabled={isBatchUploading}
                className="px-3 py-1 rounded-full bg-[#843c2d] text-white text-xs font-medium disabled:opacity-50"
              >
                {isBatchUploading ? 'Uploading...' : `Upload ${pendingCount}`}
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {uploadQueue.map(item => (
              <div
                key={item.id}
                onClick={() => setPreviewImage(item.preview)}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer ${
                  item.status === 'uploading' ? 'border-[#843c2d]' : item.status === 'success' ? 'border-green-500' : item.status === 'error' ? 'border-red-500' : 'border-[#502d26]/40'
                }`}
              >
                <img src={item.preview} alt="" className="w-full h-full object-cover" />
                {item.status === 'pending' && (
                  <button
                    onClick={e => { e.stopPropagation(); removeFromQueue(item.id); }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {item.status !== 'pending' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    {item.status === 'uploading' && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {item.status === 'success' && <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>}
                    {item.status === 'error' && <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Viewfinder */}
      <div className="flex-1 flex items-center justify-center bg-black p-4 overflow-hidden">
        <div className="relative rounded-xl overflow-hidden bg-[#0a0908]" style={{ aspectRatio: aspectRatio.toString(), maxHeight: '100%', maxWidth: '100%', width: 'auto', height: 'auto' }}>
          <video
            ref={setVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined}
          />
          {!streamRef.current && !isStarting && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => { setIsStarting(true); startCamera().finally(() => setIsStarting(false)); }}
                className="px-5 py-2.5 rounded-full bg-[#ede8df] text-[#171616] font-semibold text-sm"
              >
                Start Camera
              </button>
            </div>
          )}
          <canvas ref={setCanvasRef} className="hidden" />
        </div>
        {error && <p className="absolute bottom-4 left-0 right-0 text-center text-red-400 text-xs">{error}</p>}
      </div>

      {/* Controls */}
      <div className="flex-none px-4 py-4 pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-[#502d26]/30 flex items-center justify-center gap-3">
        <div className="flex rounded-full overflow-hidden border border-[#502d26]/40">
          <button onClick={() => setAspect('9:16')} className={`px-3 py-1.5 text-xs ${aspect === '9:16' ? 'bg-[#302927] text-[#ede8df]' : 'text-[#726d6c]'}`}>9:16</button>
          <button onClick={() => setAspect('3:4')} className={`px-3 py-1.5 text-xs ${aspect === '3:4' ? 'bg-[#302927] text-[#ede8df]' : 'text-[#726d6c]'}`}>3:4</button>
        </div>
        {hasFlash && (
          <button onClick={() => setFlashMode(m => m === 'off' ? 'on' : 'off')} className={`p-2 rounded-full border ${flashMode === 'on' ? 'border-[#843c2d] text-[#843c2d]' : 'border-[#502d26]/40 text-[#726d6c]'}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 2v11h3v9l7-12h-4l4-8z" />
            </svg>
          </button>
        )}
        <button onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')} className="p-2 rounded-full border border-[#502d26]/40 text-[#726d6c]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button onClick={takePhoto} disabled={isBatchUploading} className="px-6 py-2.5 rounded-full bg-[#ede8df] text-[#171616] font-semibold text-sm disabled:opacity-50">
          Capture
        </button>
      </div>

      {/* Preview modal */}
      {previewImage && (
        <div className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={previewImage} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
