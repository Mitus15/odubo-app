"use client";
import { useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';

export default function CapturePage({ searchParams }: { searchParams?: Promise<{ code?: string; starts_at?: string; ends_at?: string; ig?: string }> }) {
  const params = searchParams ? use(searchParams) : {};
  const code = params?.code;
  const igParam = params?.ig as string | undefined;
  const startsAt = params?.starts_at ? new Date(params.starts_at) : null;
  const endsAt = params?.ends_at ? new Date(params.ends_at) : null;
  
  // Code entry state
  const [codeInput, setCodeInput] = useState(code || '');
  const [codeSubmitted, setCodeSubmitted] = useState(!!code);
  const [validatingCode, setValidatingCode] = useState(false);
  const [galleryInfo, setGalleryInfo] = useState<{ id: number; title: string; starts_at?: string; ends_at?: string } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState('');
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // We only support photos for now
  const [mediaType] = useState<'photo'>('photo');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [preferredFrontId, setPreferredFrontId] = useState<string | null>(null);
  const [preferredBackId, setPreferredBackId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | 'auto'>('auto');
  const [userName, setUserName] = useState<string>('');
  // Helper: dataURL -> Blob (for Safari toBlob fallback)
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

  // Create a robust preview URL (object URL with dataURL fallback)
  async function createPreviewURLFromBlob(blob: Blob): Promise<string> {
    try {
      const url = URL.createObjectURL(blob);
      // quick sanity check via size; many failures throw, but we keep a fallback
      if (blob.size > 0) return url;
      URL.revokeObjectURL(url);
    } catch {}
    // Fallback to data URL
    const reader = new FileReader();
    const p = new Promise<string>((resolve) => {
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
    });
    reader.readAsDataURL(blob);
    return p;
  }

  async function waitForVideoReady(video: HTMLVideoElement) {
    // Wait until metadata is loaded and sizes are non-zero
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
      // Fallback timeout just in case
      setTimeout(() => {
        video.removeEventListener('loadedmetadata', onCanPlay);
        video.removeEventListener('canplay', onCanPlay);
        resolve();
      }, 2500);
    });
  }

  function classifySideFromLabel(label: string): 'front' | 'back' | 'unknown' {
    const l = label.toLowerCase();
    if (/back|rear|world|environment/.test(l)) return 'back';
    if (/front|user|facetime|true\s*depth/.test(l)) return 'front';
    return 'unknown';
  }

  async function validateEventCode() {
    if (!codeInput.trim()) {
      setError('Please enter an event code');
      return;
    }
    
    setValidatingCode(true);
    setError('');
    
    try {
      // Query the backend to validate the code and get gallery info
      const res = await fetch(`/api/moments/galleries?code=${encodeURIComponent(codeInput.trim())}`);
      if (!res.ok) {
        throw new Error('Invalid event code or event not found');
      }
      
      const data = (await res.json()) as any;
      if (!data.galleries || data.galleries.length === 0) {
        throw new Error('Invalid event code');
      }
      
      const gallery = data.galleries[0];
      setGalleryInfo(gallery);
      setCodeSubmitted(true);
      
      // Update URL to include the code (optional, for shareable links)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('code', codeInput.trim());
      window.history.replaceState({}, '', newUrl.toString());
      
    } catch (e: any) {
      setError(e.message || 'Failed to validate event code');
    } finally {
      setValidatingCode(false);
    }
  }

  function isFrontActive(): boolean {
    if (facingMode === 'user') return true;
    if (!currentDeviceId) return false;
    const dev = videoDevices.find((d) => d.deviceId === currentDeviceId);
    const side = classifySideFromLabel(dev?.label || '');
    return side === 'front';
  }

  async function refreshDevicesAndPersist(currentId?: string) {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videos);

      // Try to determine front/back from labels
      let back: string | null = preferredBackId || null;
      let front: string | null = preferredFrontId || null;

      for (const v of videos) {
        const side = classifySideFromLabel(v.label || '');
        if (side === 'back' && !back) back = v.deviceId;
        if (side === 'front' && !front) front = v.deviceId;
      }

      // If labels were inconclusive but there are exactly two, assume index 0 = front, 1 = back (common on mobile)
      if ((!front || !back) && videos.length === 2) {
        front = front || videos[0].deviceId;
        back = back || videos[1].deviceId;
      }

      // If we know which one is currently active, infer opposite when unknowns remain
      if (currentId && (!front || !back)) {
        const current = videos.find((v) => v.deviceId === currentId);
        if (current) {
          const side = classifySideFromLabel(current.label || '');
          if (side === 'front' && !front) front = current.deviceId;
          if (side === 'back' && !back) back = current.deviceId;
        }
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

  function stopStream() {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch {}
  }

  // Start the camera (optionally with specific facingMode or deviceId)
  async function startCamera(opts?: { mode?: 'environment' | 'user'; deviceId?: string }) {
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('Camera requires HTTPS (or localhost). Please use a secure origin.');
        return;
      }

      // Stop any prior stream before (re)starting
      stopStream();

      // Check if modern API is available
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // If no explicit deviceId provided, try using persisted preference
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
            ? { deviceId: { exact: desiredDeviceId } as any }
            : { facingMode: { ideal: desiredMode } as any },
          audio: false,
        };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          try {
            // Ensure muted before play for mobile autoplay policies
            videoRef.current.muted = true;
            await waitForVideoReady(videoRef.current);
            await videoRef.current.play();
            // Only mark camera started if play() succeeded
            setStream(mediaStream);
            setCameraStarted(true);
            try {
              const settings = mediaStream.getVideoTracks?.()[0]?.getSettings?.();
              if (settings?.deviceId) setCurrentDeviceId(settings.deviceId);
            } catch {}
            if (opts?.mode) setFacingMode(opts.mode);
            setError('');
            // Refresh device list and persist front/back hints
            try {
              const settings = mediaStream.getVideoTracks?.()[0]?.getSettings?.();
              await refreshDevicesAndPersist(settings?.deviceId || undefined);
            } catch {}
          } catch (playErr: any) {
            console.error('Failed to start video play()', playErr);
            setError(`Failed to start camera video: ${playErr?.message || playErr}`);
          }
        }
        return;
      }
      
      // Fallback for older browsers
      const getUserMedia = (navigator as any).getUserMedia || 
                         (navigator as any).webkitGetUserMedia || 
                         (navigator as any).mozGetUserMedia;
      
      if (getUserMedia) {
        const mediaStream = await new Promise<MediaStream>((resolve, reject) => {
          getUserMedia.call(navigator, 
            { video: true, audio: false },
            resolve,
            reject
          );
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          try {
            videoRef.current.muted = true;
            await waitForVideoReady(videoRef.current);
            await videoRef.current.play();
            setStream(mediaStream);
            setCameraStarted(true);
            try {
              const settings = mediaStream.getVideoTracks?.()[0]?.getSettings?.();
              if (settings?.deviceId) setCurrentDeviceId(settings.deviceId);
            } catch {}
            setError('');
            try {
              const settings = mediaStream.getVideoTracks?.()[0]?.getSettings?.();
              await refreshDevicesAndPersist(settings?.deviceId || undefined);
            } catch {}
          } catch (playErr: any) {
            console.error('Failed to start legacy getUserMedia video', playErr);
            setError(`Failed to start camera video: ${playErr?.message || playErr}`);
          }
        }
        return;
      }
      
      throw new Error('Camera access is not supported in this browser. Please use HTTPS or localhost.');
      
    } catch (err: any) {
      console.error("Error accessing the camera: ", err);
      setError(`Camera error: ${err.message}`);
    }
  }

  async function switchCamera() {
    try {
      setError('');
      // Prefer deterministic front/back if we have preferences
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

      // If we have multiple devices, pick the other one deterministically
      if (videoDevices.length >= 2) {
        const idx = videoDevices.findIndex((d) => d.deviceId === currentDeviceId);
        const next = videoDevices[(idx + 1 + videoDevices.length) % videoDevices.length];
        await startCamera({ deviceId: next.deviceId });
        // Update facing mode guess based on label
        const side = classifySideFromLabel(next.label || '');
        if (side === 'front') setFacingMode('user');
        if (side === 'back') setFacingMode('environment');
        return;
      }

      // Final fallback: toggle facingMode between environment and user
      const nextMode = facingMode === 'environment' ? 'user' : 'environment';
      await startCamera({ mode: nextMode });
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  // Take a photo
  function takePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    if (!cameraStarted) { setError('Camera not started'); return; }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas size to match video
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      setError('Camera is not ready yet. Please wait a moment and try again.');
      return;
    }
    canvas.width = vw;
    canvas.height = vh;
    
    // Draw current video frame onto canvas
    const context = canvas.getContext('2d');
    if (!context) return;
    const mirror = isFrontActive();
    if (mirror) {
      // Mirror horizontally for front camera so the saved image matches the preview
      context.save();
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    // Use a deterministic dataURL for preview, then convert to Blob for upload.
    // This avoids Safari object URL quirks and guarantees a visible preview.
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (mirror) {
      context.restore();
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPreviewUrl(dataUrl);
    const blob = dataURLToBlob(dataUrl);
    setMediaBlob(blob);
    // Auto-scroll preview into view
    setTimeout(() => document.getElementById('capture-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  // Video recording removed for now (photos only)

  // Check if uploads are allowed now
  function canUploadNow() {
    const now = new Date();
    const starts = galleryInfo?.starts_at ? new Date(galleryInfo.starts_at) : startsAt;
    const ends = galleryInfo?.ends_at ? new Date(galleryInfo.ends_at) : endsAt;
    if (starts && now < starts) return false;
    if (ends && now > ends) return false;
    return true;
  }

  async function uploadMedia() {
    if (!mediaBlob || !code) return setError('No media or event code');
    if (!galleryInfo) return setError('Please validate event code first');
    if (!canUploadNow()) return setError('This event is not accepting uploads at this time.');

    setError('');
    setUploading(true);
    try {
      const ext = mediaType === 'photo' ? 'jpg' : 'webm';
      const filename = `${mediaType}_${Date.now()}.${ext}`;
      const uRes = await fetch('/api/moments/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fileName: filename }),
      });
      const uData = (await uRes.json()) as any;
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
        xhr.setRequestHeader('Content-Type', mediaType === 'photo' ? 'image/jpeg' : 'video/webm');
        xhr.send(mediaBlob);
      });

      // Record in database
      const rRes = await fetch('/api/moments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, r2_key: key, original_filename: filename, user_name: (userName || 'Anonymous'), media_type: mediaType }),
      });
      const rData = (await rRes.json()) as any;
      if (!rRes.ok) throw new Error(rData?.error || 'Failed to record');

      alert('Uploaded!');
      setMediaBlob(null);
      setProgress(0);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setUploading(false);
    }
  }

  // Cleanup effect
  useEffect(() => {
    // Load persisted preferences early
    try {
      const f = localStorage.getItem('cameraFrontId');
      const b = localStorage.getItem('cameraBackId');
      if (f) setPreferredFrontId(f);
      if (b) setPreferredBackId(b);
      // Load IG handle from query or localStorage
      const fromQuery = (igParam || '').trim();
      const stored = localStorage.getItem('instagramHandle') || '';
      const norm = (fromQuery || stored).trim().replace(/^@/, '');
      if (norm) {
        setUserName('@' + norm);
        try { localStorage.setItem('instagramHandle', norm); } catch {}
      }
      
      // If code is provided in URL, validate it automatically
      if (code && !codeSubmitted) {
        validateEventCode();
      }
    } catch {}
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // When camera starts, keep device selector in sync
  useEffect(() => {
    if (!cameraStarted) return;
    refreshDevicesAndPersist(currentDeviceId || undefined);
  }, [cameraStarted, currentDeviceId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0908] via-[#171616] to-[#0a0908]">
      {/* Sticky header with navigation */}
      <header className="sticky top-0 z-40 bg-[#141312]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-[#262321]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/moments"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1f1e1d] border border-[#3b3733] hover:border-[#ede8df]/30 transition-colors group"
            >
              <svg className="w-4 h-4 text-[#b2a491] group-hover:text-[#ede8df] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium text-[#b2a491] group-hover:text-[#ede8df] transition-colors">Back to Moments</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-[#ede8df] flex-1">
              Capture Moment
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24">
        {/* Code Entry Form - Show if no valid code submitted */}
        {!codeSubmitted && (
          <div className="mb-6 p-6 sm:p-8 bg-gradient-to-br from-[#1f1e1d] to-[#171616] border border-[#3b3733] rounded-2xl shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff8a3d] to-[#d97028] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#ede8df]">Enter Event Code</h2>
                <p className="text-sm text-[#b2a491]">Required to access this gallery</p>
              </div>
            </div>
            
            <p className="text-sm text-[#8f8271] mb-6">
              Ask the event host for the unique code to start uploading photos.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.trim().toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && validateEventCode()}
                placeholder="Enter code (e.g., ABC123)"
                className="flex-1 px-4 py-3 rounded-xl bg-[#0a0908] border border-[#3b3733] text-[#ede8df] placeholder-[#666461] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/50 focus:border-[#ff8a3d]/40 transition-all text-center sm:text-left text-lg font-mono tracking-wider"
                disabled={validatingCode}
                maxLength={20}
              />
              <button
                onClick={validateEventCode}
                disabled={validatingCode || !codeInput.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff8a3d] to-[#d97028] text-white font-semibold hover:from-[#ff9a50] hover:to-[#e6803a] transition-all shadow-lg shadow-[#ff8a3d]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {validatingCode ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Validating...
                  </span>
                ) : 'Submit'}
              </button>
            </div>
          </div>
        )}
        
        {/* Show gallery info and camera controls only after code is validated */}
        {codeSubmitted && galleryInfo && (
          <div className="space-y-6">
            {/* Success banner */}
            <div className="p-4 sm:p-6 bg-gradient-to-r from-emerald-900/30 to-green-900/30 border border-emerald-600/50 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-emerald-300 text-lg">{galleryInfo.title}</div>
                  <div className="text-sm text-emerald-400/70 mt-1">Code: {code}</div>
                  {galleryInfo.starts_at && galleryInfo.ends_at && (
                    <div className="text-xs text-emerald-400/60 mt-2">
                      {new Date(galleryInfo.starts_at).toLocaleDateString()} — {new Date(galleryInfo.ends_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Instagram handle input */}
            <div className="p-4 sm:p-6 bg-[#1f1e1d] border border-[#3b3733] rounded-2xl">
              <label className="block">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-[#b2a491]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span className="text-sm font-medium text-[#ede8df]">Instagram Handle (optional)</span>
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
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0908] border border-[#3b3733] text-[#ede8df] placeholder-[#666461] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/50 focus:border-[#ff8a3d]/40 transition-all"
                />
              </label>
            </div>
            
            {error && (
              <div className="p-4 rounded-xl border border-red-600/50 bg-red-900/20 text-red-300 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}
            
            {!canUploadNow() && (
              <div className="p-4 rounded-xl border border-yellow-600/50 bg-yellow-900/20 text-yellow-300 text-sm">
                This event is not accepting uploads at this time.
              </div>
            )}
            
            {!cameraStarted && (
              <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-600/30 rounded-2xl text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <button 
                  onClick={() => startCamera()}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 text-lg"
                >
                  📷 Start Camera
                </button>
                <div className="mt-4 text-sm text-blue-300/70">
                  Default: {facingMode === 'environment' ? 'Back' : 'Front'} camera
                </div>
              </div>
            )}
            
            {/* Camera Feed */}
            {cameraStarted && (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black border border-[#3b3733] shadow-2xl">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto"
                    style={{ transform: isFrontActive() ? 'scaleX(-1)' : 'none', transformOrigin: 'center' }}
                  />
                  {/* Camera controls overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-center gap-4">
                      <button 
                        onClick={switchCamera} 
                        className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
                        title="Switch Camera"
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      
                      <button 
                        onClick={takePhoto} 
                        className="relative p-2 rounded-full bg-white shadow-lg hover:scale-105 transition-transform active:scale-95"
                        title="Take Photo"
                      >
                        <div className="w-16 h-16 rounded-full border-4 border-[#171616] bg-white flex items-center justify-center">
                          <svg className="w-8 h-8 text-[#171616]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                      </button>

                      <button 
                        onClick={() => { setMediaBlob(null); setPreviewUrl(null); setProgress(0); }} 
                        className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
                        title="Reset"
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Device selector (if multiple cameras) */}
                {videoDevices.length > 1 && (
                  <div className="p-4 bg-[#1f1e1d] border border-[#3b3733] rounded-xl">
                    <label className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#b2a491]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-[#ede8df]">Camera:</span>
                      <select
                        className="flex-1 bg-[#0a0908] border border-[#3b3733] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/50"
                        value={selectedDeviceId}
                        onChange={async (e) => {
                          const val = e.target.value as string;
                          setSelectedDeviceId(val as any);
                          if (val !== 'auto') {
                            await startCamera({ deviceId: val });
                            const dev = videoDevices.find((d) => d.deviceId === val);
                            const side = classifySideFromLabel(dev?.label || '');
                            if (side === 'front') {
                              setFacingMode('user');
                              setPreferredFrontId(val);
                              try { localStorage.setItem('cameraFrontId', val); } catch {}
                            }
                            if (side === 'back') {
                              setFacingMode('environment');
                              setPreferredBackId(val);
                              try { localStorage.setItem('cameraBackId', val); } catch {}
                            }
                          }
                        }}
                      >
                        <option value="auto">Auto</option>
                        {videoDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera (${d.deviceId.slice(0,6)}…)`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}
            
            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {/* Media Preview */}
            {mediaBlob && (
              <div id="capture-preview" className="space-y-4">
                <div className="p-4 sm:p-6 bg-[#1f1e1d] border border-[#3b3733] rounded-2xl">
                  <h3 className="text-lg font-semibold text-[#ede8df] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#ff8a3d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview
                  </h3>
                  {previewUrl ? (
                    <img src={previewUrl} alt="preview" className="w-full rounded-xl shadow-lg" />
                  ) : (
                    <div className="aspect-video bg-[#0a0908] rounded-xl flex items-center justify-center">
                      <div className="text-sm text-[#666461]">Generating preview…</div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={uploadMedia} 
                  disabled={!mediaBlob || uploading || !canUploadNow()} 
                  className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-[#ff8a3d] to-[#d97028] text-white font-semibold hover:from-[#ff9a50] hover:to-[#e6803a] transition-all shadow-lg shadow-[#ff8a3d]/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-lg flex items-center justify-center gap-3"
                >
                  {uploading ? (
                    <>
                      <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading {progress}%
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload Photo
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
