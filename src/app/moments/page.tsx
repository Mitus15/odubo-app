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
  const [galleries, setGalleries] = useState<Array<{ id: number; title: string; created_at?: string; cover_url?: string | null; cover_thumb_url?: string | null; photo_count?: number; preview_photos?: Array<{id: number; thumbnail_url?: string; r2_url: string}> }>>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [galleryId, setGalleryId] = useState<string>(prefillGalleryId);
  const [ig, setIg] = useState<string>(prefillIg ? (prefillIg.startsWith('@') ? prefillIg : `@${prefillIg}`) : '');
  const [eventCode, setEventCode] = useState<string>(prefillCode);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<MomentsTab>('view');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleOpenCamera = () => {
    setShowTermsModal(true);
  };

  const handleAcceptTerms = () => {
    setShowTermsModal(false);
    setShowCameraModal(true);
  };

  const handleDeclineTerms = () => {
    setShowTermsModal(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setGalleryLoading(true);
        setGalleryError('');
        // Request with preview=true to get photo counts and preview photos in single request
        const res = await fetch('/api/moments/galleries/public?limit=12&preview=true');
        const data: any = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && Array.isArray(data.galleries)) {
          setGalleries(data.galleries);
        } else if (!res.ok) {
          setGalleryError(data?.error || 'Failed to load galleries');
        }
      } catch (e: any) {
        if (active) setGalleryError(e?.message || 'Failed to load galleries');
      } finally {
        if (active) setGalleryLoading(false);
      }
    })();
    return () => { active = false; };
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
    // Removed auto-switch to capture; user can manually open camera.
    // Removed auto-open camera gating via IG handle.
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
              <GalleryGrid galleries={galleries} loading={galleryLoading} error={galleryError} />
            </section>
          ) : (
            <section ref={captureRef}>
              <CapturePanel onOpenCamera={handleOpenCamera} galleryId={galleryId} setGalleryId={setGalleryId} ig={ig} setIg={setIg} />
            </section>
          )}
        </div>
      </main>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-[#1f1e1d] to-[#171616] border border-[#3b3733] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#ff8a3d] to-[#d97028] px-6 py-4">
              <h2 className="text-xl font-bold text-white">Terms & Conditions</h2>
              <p className="text-white/90 text-sm mt-1">Please read before uploading</p>
            </div>

            {/* Content */}
            <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4 text-[#ede8df]">
                <p className="text-sm leading-relaxed">
                  By uploading photos or videos to Moments, you acknowledge and agree to the following:
                </p>

                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ff8a3d]/20 flex items-center justify-center text-[#ff8a3d] text-xs font-bold mt-0.5">
                      1
                    </div>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-[#ff8a3d]">Content License:</span> You grant Odubo Studio and event organizers a perpetual, worldwide, royalty-free license to use, reproduce, distribute, display, and publish your uploaded content for any lawful purpose.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ff8a3d]/20 flex items-center justify-center text-[#ff8a3d] text-xs font-bold mt-0.5">
                      2
                    </div>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-[#ff8a3d]">Public Display:</span> Your content may be publicly displayed in event galleries, shared on social media, used in marketing materials, or published by any party associated with the event.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ff8a3d]/20 flex items-center justify-center text-[#ff8a3d] text-xs font-bold mt-0.5">
                      3
                    </div>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-[#ff8a3d]">Rights & Ownership:</span> You confirm that you own all rights to the content or have obtained necessary permissions, and that your content does not violate any third-party rights.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ff8a3d]/20 flex items-center justify-center text-[#ff8a3d] text-xs font-bold mt-0.5">
                      4
                    </div>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-[#ff8a3d]">Content Standards:</span> You agree not to upload content that is illegal, offensive, defamatory, or violates any applicable laws or regulations.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#3b3733]">
                  <p className="text-xs text-[#b2a491] leading-relaxed">
                    By clicking "I Agree," you acknowledge that you have read, understood, and agree to be bound by these terms. If you do not agree, please click "Decline."
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-[#0a0908] border-t border-[#3b3733] flex gap-3">
              <button
                onClick={handleDeclineTerms}
                className="flex-1 px-4 py-3 rounded-xl border border-[#3b3733] text-[#b2a491] font-medium hover:border-[#ede8df]/30 hover:text-[#ede8df] transition-all"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptTerms}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#ff8a3d] to-[#d97028] text-white font-semibold hover:shadow-lg hover:shadow-[#ff8a3d]/30 transition-all"
              >
                I Agree
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

function GalleryCard({ gallery }: { gallery: { id: number; title: string; created_at?: string; cover_url?: string | null; cover_thumb_url?: string | null; photo_count?: number; preview_photos?: Array<{id: number; thumbnail_url?: string; r2_url: string}> } }) {
  // Use data from API instead of separate fetch - massive performance win!
  const photoCount = gallery.photo_count || 0;
  const recentPhotos = gallery.preview_photos || [];

  return (
    <Link 
      href={`/moments/gallery/${gallery.id}`}
      className="group block rounded-2xl overflow-hidden border border-[#3b3733] bg-gradient-to-br from-[#1f1e1d] to-[#171616] hover:border-[#ede8df]/40 transition-all duration-300 hover:shadow-xl hover:shadow-[#ff8a3d]/10"
    >
      {/* Photo Grid Preview */}
      <div className="aspect-square bg-[#0a0908] overflow-hidden relative">
        {recentPhotos.length > 0 ? (
          <div className="grid grid-cols-2 gap-0.5 h-full">
            {recentPhotos.slice(0, 4).map((photo, idx) => (
              <div key={photo.id} className="relative overflow-hidden bg-[#0a0908]">
                <img 
                  src={photo.thumbnail_url || photo.r2_url} 
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  style={{ transitionDelay: `${idx * 50}ms` }}
                />
              </div>
            ))}
            {/* Fill empty slots if less than 4 photos */}
            {[...Array(Math.max(0, 4 - recentPhotos.length))].map((_, idx) => (
              <div key={`empty-${idx}`} className="bg-gradient-to-br from-[#2a2626] to-[#1f1e1d]" />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#502d26] to-[#6b4c3b] flex items-center justify-center">
            <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {/* Photo count badge */}
        {photoCount > 0 && (
          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 text-white text-xs font-medium">
            {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          </div>
        )}
      </div>

      {/* Gallery Info */}
      <div className="p-4">
        <h3 className="text-base font-bold text-[#ede8df] line-clamp-2 mb-1 group-hover:text-[#ff8a3d] transition-colors">
          {gallery.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-[#8f8271]">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {gallery.created_at ? new Date(gallery.created_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          }) : 'Date unknown'}
        </div>
      </div>
    </Link>
  );
}

function GalleryGrid({ galleries, loading, error }: { galleries: Array<{ id: number; title: string; created_at?: string; cover_url?: string | null; cover_thumb_url?: string | null; photo_count?: number; preview_photos?: Array<{id: number; thumbnail_url?: string; r2_url: string}> }>; loading: boolean; error: string }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl overflow-hidden bg-[#1f1e1d] border border-[#3b3733]">
            <div className="aspect-square bg-gradient-to-br from-[#2a2626] to-[#1f1e1d]" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-[#3b3733] rounded w-3/4" />
              <div className="h-3 bg-[#3b3733] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 rounded-2xl border border-red-600/50 bg-red-900/20 text-red-300 text-sm">
        {error}
      </div>
    );
  }
  
  if (!galleries?.length) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1f1e1d] border border-[#3b3733] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#666461]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p className="text-lg font-medium text-[#b2a491]">No galleries yet</p>
        <p className="text-sm text-[#8f8271] mt-1">Create your first event to get started</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {galleries.map((g) => (
        <GalleryCard key={g.id} gallery={g} />
      ))}
    </div>
  );
}

function CapturePanel({ onOpenCamera, galleryId, setGalleryId, ig, setIg }: { onOpenCamera: () => void; galleryId: string; setGalleryId: (v: string) => void; ig: string; setIg: (v: string) => void }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canOpenCamera = !!(galleryId && galleryId.trim().length > 0);
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [rsvpEmail, setRsvpEmail] = useState('');
  const [rsvpIg, setRsvpIg] = useState('');
  const [rsvpIgOptIn, setRsvpIgOptIn] = useState(true);
  const [rsvpPhone, setRsvpPhone] = useState('');
  const [rsvpSmsOptIn, setRsvpSmsOptIn] = useState(false);
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [rsvpOffsets, setRsvpOffsets] = useState<number[]>([]);

  // Fetch gallery schedule when galleryId entered
  useEffect(() => {
    let active = true;
    async function load() {
      if (!galleryId || !galleryId.trim()) { setStartsAt(null); setEndsAt(null); return; }
      setScheduleLoading(true);
      try {
        const res = await fetch(`/api/moments/galleries/${encodeURIComponent(galleryId)}`);
        const data: any = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && data.gallery) {
          setStartsAt(data.gallery.starts_at ? new Date(data.gallery.starts_at) : null);
          setEndsAt(data.gallery.ends_at ? new Date(data.gallery.ends_at) : null);
        }
      } finally {
        if (active) setScheduleLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [galleryId]);

  const now = new Date();
  const beforeStart = startsAt ? now < startsAt : false;
  const afterEnd = endsAt ? now > endsAt : false;
  const windowOpen = !beforeStart && !afterEnd;

  async function submitRsvp() {
  if (!galleryId || (!rsvpEmail && !rsvpIg && !rsvpPhone)) { setError('Enter email, Instagram, or phone'); return; }
    setRsvpSubmitting(true); setError('');
    try {
      const body: any = { galleryId: Number(galleryId), reminder_offsets: rsvpOffsets };
  if (rsvpEmail) body.email = rsvpEmail.trim();
  if (rsvpIg) body.instagram_handle = rsvpIg.trim();
  if (rsvpPhone) body.phone = rsvpPhone.trim();
      body.instagram_opt_in = rsvpIgOptIn;
  body.sms_opt_in = rsvpSmsOptIn;
      const res = await fetch('/api/moments/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'RSVP failed');
      setRsvpDone(true);
      setSuccess('RSVP saved');
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setRsvpSubmitting(false);
    }
  }

  function toggleOffset(mins: number) {
    setRsvpOffsets(prev => prev.includes(mins) ? prev.filter(m => m !== mins) : prev.concat(mins).sort((a,b) => a-b));
  }

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

            {/* Schedule status */}
            <div className="mt-4 text-xs text-[#c9b9a5]">
              {scheduleLoading && <span>Checking schedule…</span>}
              {!scheduleLoading && startsAt && (
                <span>Window: {startsAt.toLocaleString()} – {endsAt ? endsAt.toLocaleString() : '—'} ({beforeStart ? 'Not started' : afterEnd ? 'Ended' : 'Live'})</span>
              )}
              {!scheduleLoading && !startsAt && galleryId && <span>No schedule set for this gallery.</span>}
            </div>

            {error && <div className="mt-4 p-3 rounded-lg border border-red-700/70 bg-red-900/30 text-red-200">{error}</div>}

            {/* Actions */}
            <div className="mt-5 flex flex-wrap gap-3">
              {windowOpen ? (
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
              ) : (
                <div className="w-full">
                  <div className="text-sm font-semibold mb-2">RSVP to Get Reminders</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="text-xs md:col-span-2">Email (optional)
                      <input
                        value={rsvpEmail}
                        onChange={(e) => setRsvpEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-1 w-full rounded-md bg-[#1f1a17]/80 border border-white/10 px-3 py-2 text-[#efe9df] placeholder-[#9f9381] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/40"
                      />
                    </label>
                    <label className="text-xs">Instagram (optional)
                      <input
                        value={rsvpIg}
                        onChange={(e) => setRsvpIg(e.target.value)}
                        placeholder="@yourhandle"
                        className="mt-1 w-full rounded-md bg-[#1f1a17]/80 border border-white/10 px-3 py-2 text-[#efe9df] placeholder-[#9f9381] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/40"
                      />
                    </label>
                    <label className="text-xs">Phone (optional)
                      <input
                        value={rsvpPhone}
                        onChange={(e) => setRsvpPhone(e.target.value)}
                        placeholder="+15551234567"
                        className="mt-1 w-full rounded-md bg-[#1f1a17]/80 border border-white/10 px-3 py-2 text-[#efe9df] placeholder-[#9f9381] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/40"
                      />
                    </label>
                    <div className="text-xs md:col-span-3 flex items-center gap-2">
                      <input id="optin" type="checkbox" checked={rsvpIgOptIn} onChange={(e) => setRsvpIgOptIn(e.target.checked)} />
                      <label htmlFor="optin">Consent to be tagged on Instagram</label>
                    </div>
                    <div className="text-xs md:col-span-3 flex items-center gap-2">
                      <input id="smsopt" type="checkbox" checked={rsvpSmsOptIn} onChange={(e) => setRsvpSmsOptIn(e.target.checked)} />
                      <label htmlFor="smsopt">Opt in to SMS reminders</label>
                    </div>
                    <div className="text-xs md:col-span-3">Select reminders
                      <div className="mt-1 flex flex-wrap gap-2">
                        {[1440, 60, 15].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => toggleOffset(m)}
                            className={`px-3 py-1.5 rounded-full text-xs border ${rsvpOffsets.includes(m) ? 'bg-[#ff8a3d] border-[#ff8a3d] text-[#171616]' : 'bg-[#1f1a17]/70 border-white/10 text-[#efe9df]'}`}
                          >
                            {m === 1440 ? '24h' : m === 60 ? '1h' : `${m}m`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={submitRsvp}
                    disabled={(!rsvpEmail && !rsvpIg && !rsvpPhone) || rsvpSubmitting}
                    className="mt-3 px-5 py-2.5 rounded-full bg-[#ede8df] text-[#171616] font-extrabold tracking-wide shadow-[0_10px_28px_rgba(237,232,223,0.25)] disabled:opacity-50"
                  >
                    {rsvpSubmitting ? 'Submitting…' : rsvpDone ? 'RSVP Saved' : beforeStart ? 'Notify Me' : 'Ended'}
                  </button>
                </div>
              )}
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
  const [uploaded, setUploaded] = useState(false);
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
    setUploaded(false);
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
    // Client-side soft rate limit: 3 uploads per 2 minutes per gallery
    const limitWindowMs = 120000; const maxCount = 3;
    try {
      const key = `moments:rate:${galleryId}`;
      const now = Date.now();
      const arr = JSON.parse(localStorage.getItem(key) || '[]').filter((t: number) => now - t < limitWindowMs);
      if (arr.length >= maxCount) {
        const waitMs = limitWindowMs - (now - arr[0]);
        setError(`Rate limit: try again in ${Math.ceil(waitMs/1000)}s`);
        return;
      }
    } catch {}
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
      // Record client-side rate stamp
      try {
        const k = `moments:rate:${galleryId}`;
        const now = Date.now();
        const arr = JSON.parse(localStorage.getItem(k) || '[]').filter((t: number) => now - t < 120000);
        arr.push(now);
        localStorage.setItem(k, JSON.stringify(arr));
      } catch {}
      setUploaded(true);
      // keep modal open for more shots
      resetPhoto();
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
              <button onClick={takePhoto} className="px-4 py-2 rounded-full bg-[#ede8df] text-[#171616] font-extrabold tracking-wide shadow-[0_10px_28px_rgba(237,232,223,0.25)] active:scale-95">Capture</button>
            ) : (
              <>
                <a href={preview} download={`odubo_${Date.now()}.jpg`} className="px-3 py-1.5 rounded-full bg-white/5 supports-[backdrop-filter]:backdrop-blur border border-[#3b3733]/80 text-[#ede8df]">Download</a>
                <button onClick={resetPhoto} className="px-3 py-1.5 rounded-full bg-white/5 supports-[backdrop-filter]:backdrop-blur border border-[#3b3733]/80 text-[#ede8df]">Reset</button>
                <button onClick={upload} disabled={uploading} className="px-4 py-2 rounded-full bg-[#1f1e1d] text-[#ede8df] border border-[#3b3733] disabled:opacity-50">{uploading ? 'Uploading…' : 'Upload'}</button>
              </>
            )}
          </div>
          {uploaded && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="text-sm text-[#cfc2ae]">Uploaded. You can take more.</span>
              <a href={`/moments/gallery/${encodeURIComponent(galleryId)}${code?`?code=${encodeURIComponent(code)}`:''}`} className="px-3 py-1.5 rounded-full bg-[#171616] text-[#ede8df] border border-[#3b3733]">Open Gallery</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
