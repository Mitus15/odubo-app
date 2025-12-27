'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useUnifiedMedia } from '@/contexts/UnifiedMediaContext';

interface MomentsCameraModalProps {
  galleryId?: number;
}

export default function MomentsCameraModal({ galleryId }: MomentsCameraModalProps) {
  const { goBack, refreshGalleries, refreshPhotos, moments } = useUnifiedMedia();

  // Gallery info
  const [galleryInfo, setGalleryInfo] = useState<{ id: number; title: string; code?: string; starts_at?: string; ends_at?: string } | null>(null);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [preferredFrontId, setPreferredFrontId] = useState<string | null>(null);
  const [preferredBackId, setPreferredBackId] = useState<string | null>(null);

  // Capture state
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Helper: dataURL -> Blob
  function dataURLToBlob(dataURL: string) {
    const parts = dataURL.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  // Classify camera side from label
  function classifySideFromLabel(label: string): 'front' | 'back' | 'unknown' {
    const l = label.toLowerCase();
    if (/back|rear|world|environment/.test(l)) return 'back';
    if (/front|user|facetime|true\s*depth/.test(l)) return 'front';
    return 'unknown';
  }

  // Check if front camera is active
  function isFrontActive(): boolean {
    if (facingMode === 'user') return true;
    if (!currentDeviceId) return false;
    const dev = videoDevices.find((d) => d.deviceId === currentDeviceId);
    const side = classifySideFromLabel(dev?.label || '');
    return side === 'front';
  }

  // Wait for video to be ready
  async function waitForVideoReady(video: HTMLVideoElement) {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
    await new Promise<void>((resolve) => {
      const onCanPlay = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          video.removeEventListener('loadedmetadata', onCanPlay);
          video.removeEventListener('canplay', onCanPlay);
          resolve();
        }
      };
      video.addEventListener('loadedmetadata', onCanPlay);
      video.addEventListener('canplay', onCanPlay);
      setTimeout(() => {
        video.removeEventListener('loadedmetadata', onCanPlay);
        video.removeEventListener('canplay', onCanPlay);
        resolve();
      }, 2500);
    });
  }

  // Refresh device list
  async function refreshDevicesAndPersist(currentId?: string) {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videos);

      let back: string | null = preferredBackId || null;
      let front: string | null = preferredFrontId || null;

      for (const v of videos) {
        const side = classifySideFromLabel(v.label || '');
        if (side === 'back' && !back) back = v.deviceId;
        if (side === 'front' && !front) front = v.deviceId;
      }

      if ((!front || !back) && videos.length === 2) {
        front = front || videos[0].deviceId;
        back = back || videos[1].deviceId;
      }

      if (front) {
        setPreferredFrontId(front);
        try { localStorage.setItem('cameraFrontId', front); } catch {}
      }
      if (back) {
        setPreferredBackId(back);
        try { localStorage.setItem('cameraBackId', back); } catch {}
      }
    } catch (e) {
      console.warn('enumerateDevices failed or blocked', e);
    }
  }

  // Stop camera stream
  const stopStream = useCallback(() => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch {}
  }, [stream]);

  // Start camera
  async function startCamera(opts?: { mode?: 'environment' | 'user'; deviceId?: string }) {
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('Camera requires HTTPS (or localhost).');
        return;
      }

      stopStream();

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let desiredDeviceId = opts?.deviceId || null;
        const desiredMode = opts?.mode || facingMode;

        try {
          if (!desiredDeviceId) {
            const savedFront = preferredFrontId || localStorage.getItem('cameraFrontId');
            const savedBack = preferredBackId || localStorage.getItem('cameraBackId');
            if (desiredMode === 'environment' && savedBack) desiredDeviceId = savedBack;
            if (desiredMode === 'user' && savedFront) desiredDeviceId = savedFront;
          }
        } catch {}

        const constraints: MediaStreamConstraints = {
          video: desiredDeviceId
            ? { deviceId: { exact: desiredDeviceId } }
            : { facingMode: { ideal: desiredMode } },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.muted = true;
          await waitForVideoReady(videoRef.current);
          await videoRef.current.play();

          setStream(mediaStream);
          setCameraStarted(true);

          try {
            const settings = mediaStream.getVideoTracks?.()[0]?.getSettings?.();
            if (settings?.deviceId) setCurrentDeviceId(settings.deviceId);
          } catch {}

          if (opts?.mode) setFacingMode(opts.mode);
          setError('');

          try {
            const settings = mediaStream.getVideoTracks?.()[0]?.getSettings?.();
            await refreshDevicesAndPersist(settings?.deviceId || undefined);
          } catch {}
        }
      }
    } catch (err: unknown) {
      console.error('Camera error:', err);
      setError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Switch camera
  async function switchCamera() {
    try {
      setError('');
      const front = preferredFrontId || (typeof window !== 'undefined' ? localStorage.getItem('cameraFrontId') : null);
      const back = preferredBackId || (typeof window !== 'undefined' ? localStorage.getItem('cameraBackId') : null);

      if (currentDeviceId && front && back) {
        if (currentDeviceId === back) {
          await startCamera({ deviceId: front });
          setFacingMode('user');
          return;
        }
        if (currentDeviceId === front) {
          await startCamera({ deviceId: back });
          setFacingMode('environment');
          return;
        }
      }

      if (videoDevices.length >= 2) {
        const idx = videoDevices.findIndex((d) => d.deviceId === currentDeviceId);
        const next = videoDevices[(idx + 1 + videoDevices.length) % videoDevices.length];
        await startCamera({ deviceId: next.deviceId });
        const side = classifySideFromLabel(next.label || '');
        if (side === 'front') setFacingMode('user');
        if (side === 'back') setFacingMode('environment');
        return;
      }

      const nextMode = facingMode === 'environment' ? 'user' : 'environment';
      await startCamera({ mode: nextMode });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Take photo
  function takePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    if (!cameraStarted) { setError('Camera not started'); return; }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      setError('Camera is not ready yet.');
      return;
    }
    canvas.width = vw;
    canvas.height = vh;

    const context = canvas.getContext('2d');
    if (!context) return;

    const mirror = isFrontActive();
    if (mirror) {
      context.save();
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (mirror) {
      context.restore();
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPreviewUrl(dataUrl);
    const blob = dataURLToBlob(dataUrl);
    setMediaBlob(blob);
  }

  // Check if uploads are allowed
  function canUploadNow() {
    if (!galleryInfo) return false;
    const now = new Date();
    const starts = galleryInfo.starts_at ? new Date(galleryInfo.starts_at) : null;
    const ends = galleryInfo.ends_at ? new Date(galleryInfo.ends_at) : null;
    if (starts && now < starts) return false;
    if (ends && now > ends) return false;
    return true;
  }

  // Upload photo
  async function uploadMedia() {
    if (!mediaBlob || !galleryInfo?.code) return setError('No media or gallery code');
    if (!canUploadNow()) return setError('This gallery is not accepting uploads.');

    setError('');
    setUploading(true);
    try {
      const filename = `photo_${Date.now()}.jpg`;
      const uRes = await fetch('/api/moments/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: galleryInfo.code, fileName: filename }),
      });
      const uData = await uRes.json();
      if (!uRes.ok) throw new Error(uData?.error || 'Failed to get upload url');

      const { key, uploadUrl } = uData;

      // PUT to R2
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(true);
          else reject(new Error('Upload failed: ' + xhr.status));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.setRequestHeader('Content-Type', 'image/jpeg');
        xhr.send(mediaBlob);
      });

      // Record in database
      const rRes = await fetch('/api/moments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: galleryInfo.code,
          r2_key: key,
          original_filename: filename,
          user_name: userName || 'Anonymous',
          media_type: 'photo'
        }),
      });
      const rData = await rRes.json();
      if (!rRes.ok) throw new Error(rData?.error || 'Failed to record');

      setUploadSuccess(true);
      setMediaBlob(null);
      setPreviewUrl(null);
      setProgress(0);

      // Refresh photos for the gallery
      if (galleryId) {
        await refreshPhotos(galleryId);
      }
      await refreshGalleries();

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  // Reset capture
  function resetCapture() {
    setMediaBlob(null);
    setPreviewUrl(null);
    setProgress(0);
    setUploadSuccess(false);
  }

  // Fetch gallery info on mount
  useEffect(() => {
    async function fetchGalleryInfo() {
      if (!galleryId) return;
      setIsLoadingGallery(true);
      try {
        // Try to find gallery in cached galleries first
        const cached = moments.galleries.find(g => g.id === galleryId);
        if (cached) {
          setGalleryInfo({
            id: cached.id,
            title: cached.title,
            code: cached.code,
            starts_at: cached.starts_at,
            ends_at: cached.ends_at,
          });
          return;
        }

        // Fetch from API
        const res = await fetch(`/api/moments/galleries?id=${galleryId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.galleries?.[0]) {
            const g = data.galleries[0];
            setGalleryInfo({
              id: g.id,
              title: g.title,
              code: g.code,
              starts_at: g.starts_at,
              ends_at: g.ends_at,
            });
          }
        }
      } catch (e) {
        console.error('Failed to fetch gallery:', e);
      } finally {
        setIsLoadingGallery(false);
      }
    }

    fetchGalleryInfo();

    // Load saved username
    try {
      const stored = localStorage.getItem('instagramHandle') || '';
      if (stored) setUserName('@' + stored.replace(/^@/, ''));
    } catch {}

    // Load camera preferences
    try {
      const f = localStorage.getItem('cameraFrontId');
      const b = localStorage.getItem('cameraBackId');
      if (f) setPreferredFrontId(f);
      if (b) setPreferredBackId(b);
    } catch {}

    return () => {
      stopStream();
    };
  }, [galleryId, moments.galleries, stopStream]);

  // Refresh devices when camera starts
  useEffect(() => {
    if (!cameraStarted) return;
    refreshDevicesAndPersist(currentDeviceId || undefined);
  }, [cameraStarted, currentDeviceId]);

  // Auto-start camera when gallery info is loaded
  useEffect(() => {
    if (galleryInfo && !cameraStarted && !mediaBlob && !uploadSuccess) {
      startCamera();
    }
  }, [galleryInfo]);

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[115] flex flex-col bg-gradient-to-br from-[#1a1714] via-[#0f0d0c] to-[#1a1714]"
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={goBack}
          className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
          aria-label="Back"
          style={{ touchAction: 'manipulation' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <h2 className="text-white text-sm font-medium">
          {galleryInfo?.title || 'Capture Moment'}
        </h2>

        <div className="w-10" />
      </header>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="p-4 space-y-4">
          {/* Loading gallery */}
          {isLoadingGallery && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
            </div>
          )}

          {/* No gallery info - show code entry */}
          {!isLoadingGallery && !galleryInfo && (
            <CodeEntryView
              onValidate={(info) => setGalleryInfo(info)}
              onBack={goBack}
            />
          )}

          {/* Gallery loaded */}
          {!isLoadingGallery && galleryInfo && (
            <>
              {/* Error display */}
              {error && (
                <div className="p-3 rounded-xl border border-red-500/50 bg-red-900/20 text-red-300 text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Upload success */}
              {uploadSuccess && (
                <div className="p-4 rounded-xl border border-emerald-500/50 bg-emerald-900/20 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-emerald-300 font-medium">Photo uploaded!</p>
                  <button
                    onClick={resetCapture}
                    className="mt-3 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm hover:bg-emerald-500/30 transition-colors"
                  >
                    Take Another
                  </button>
                </div>
              )}

              {/* Username input */}
              {!uploadSuccess && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <label className="block">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span className="text-xs font-medium text-white/80">Instagram Handle (optional)</span>
                    </div>
                    <input
                      value={userName}
                      onChange={(e) => {
                        const raw = e.target.value || '';
                        const norm = raw.replace(/^@?/, '@');
                        setUserName(norm);
                        try { localStorage.setItem('instagramHandle', norm.replace(/^@/, '')); } catch {}
                      }}
                      placeholder="@yourhandle"
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50"
                    />
                  </label>
                </div>
              )}

              {/* Camera viewfinder - always rendered so ref is available, hidden when not active */}
              {!mediaBlob && !uploadSuccess && (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden bg-black border border-white/10">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full aspect-[3/4] object-cover"
                      style={{ transform: isFrontActive() ? 'scaleX(-1)' : 'none' }}
                    />

                    {/* Loading overlay while camera starts */}
                    {!cameraStarted && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                        <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mb-4" />
                        <p className="text-white/60 text-sm">Starting camera...</p>
                      </div>
                    )}

                    {/* Camera controls - only show when camera is active */}
                    {cameraStarted && (
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="flex items-center justify-center gap-4">
                          {/* Switch camera */}
                          <button
                            onClick={switchCamera}
                            className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
                            aria-label="Switch camera"
                          >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>

                          {/* Shutter button */}
                          <button
                            onClick={takePhoto}
                            className="relative p-2"
                            aria-label="Take photo"
                          >
                            <div className="w-16 h-16 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
                              <div className="w-12 h-12 rounded-full bg-white" />
                            </div>
                          </button>

                          {/* Placeholder for balance */}
                          <div className="w-11 h-11" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview and upload */}
              {mediaBlob && previewUrl && !uploadSuccess && (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden bg-black border border-white/10">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full aspect-[3/4] object-cover"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={resetCapture}
                      className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
                    >
                      Retake
                    </button>
                    <button
                      onClick={uploadMedia}
                      disabled={uploading || !canUploadNow()}
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {uploading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {progress}%
                        </span>
                      ) : 'Upload'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </motion.div>
  );
}

// Code entry component for when no gallery is pre-selected
function CodeEntryView({
  onValidate,
  onBack,
}: {
  onValidate: (info: { id: number; title: string; code?: string; starts_at?: string; ends_at?: string }) => void;
  onBack: () => void;
}) {
  const [codeInput, setCodeInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  async function handleValidate() {
    if (!codeInput.trim()) {
      setError('Please enter an event code');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const res = await fetch(`/api/moments/galleries?code=${encodeURIComponent(codeInput.trim().toUpperCase())}`);
      if (!res.ok) {
        throw new Error('Invalid event code');
      }

      const data = await res.json();
      if (!data.galleries || data.galleries.length === 0) {
        throw new Error('Event not found');
      }

      const gallery = data.galleries[0];
      onValidate({
        id: gallery.id,
        title: gallery.title,
        code: gallery.code,
        starts_at: gallery.starts_at,
        ends_at: gallery.ends_at,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to validate code');
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
          <svg className="w-7 h-7 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>
        <h3 className="text-white font-semibold mb-1">Enter Event Code</h3>
        <p className="text-white/50 text-sm">Ask the host for the unique event code</p>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-500/50 bg-red-900/20 text-red-300 text-sm flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <input
        type="text"
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value.trim().toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
        placeholder="Enter code (e.g., ABC123)"
        className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/20 text-white placeholder-white/30 text-center text-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50"
        disabled={isValidating}
        maxLength={20}
      />

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleValidate}
          disabled={isValidating || !codeInput.trim()}
          className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
        >
          {isValidating ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Validating...
            </span>
          ) : 'Continue'}
        </button>
      </div>
    </div>
  );
}
