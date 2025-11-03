"use client";
import { useEffect, useRef, useState, use } from 'react';

export default function CapturePage({ searchParams }: { searchParams?: Promise<{ galleryId?: string; code?: string; starts_at?: string; ends_at?: string }> }) {
  const params = searchParams ? use(searchParams) : {};
  const galleryId = params?.galleryId;
  const code = (params as any)?.code as string | undefined;
  const startsAt = params?.starts_at ? new Date(params.starts_at) : null;
  const endsAt = params?.ends_at ? new Date(params.ends_at) : null;
  
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
    if (startsAt && now < startsAt) return false;
    if (endsAt && now > endsAt) return false;
    return true;
  }

  async function uploadMedia() {
    if (!mediaBlob || (!galleryId && !code)) return setError('No media or gallery');
    if (!canUploadNow()) return setError('This event is not accepting uploads at this time.');

    setError('');
    setUploading(true);
    try {
      const ext = mediaType === 'photo' ? 'jpg' : 'webm';
      const filename = `${mediaType}_${Date.now()}.${ext}`;
      const uRes = await fetch('/api/moments/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId, code, fileName: filename }),
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
        body: JSON.stringify({ galleryId, code, r2_key: key, original_filename: filename, user_name: 'Anonymous', media_type: mediaType }),
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
    // Make this page independently scrollable within the App layout's main area
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-2xl mx-auto pb-24">
  <h1 className="text-2xl font-bold mb-1">Capture Moment</h1>
  <div className="text-xs opacity-70 mb-3">Event code: {code || '—'}</div>
      <div className="text-sm text-[#b2a491] mb-3">Event window: {startsAt ? startsAt.toLocaleString() : 'N/A'} — {endsAt ? endsAt.toLocaleString() : 'N/A'}</div>
      
      {error && <div className="text-red-400 mb-3 p-3 bg-red-900/20 border border-red-600 rounded">{error}</div>}
      {!canUploadNow() && <div className="mb-3 text-yellow-300">This event is not accepting uploads at this time.</div>}
      
      {!cameraStarted && (
        <div className="mb-3 p-3 bg-blue-900/20 border border-blue-600 rounded">
          <button 
            onClick={() => startCamera()}
            className="px-4 py-2 rounded bg-[#ede8df] text-[#171616] hover:bg-[#d6cfc0] transition-colors font-semibold"
          >
            📷 Start Camera
          </button>
          <div className="mt-2 text-xs opacity-70">Default: {facingMode === 'environment' ? 'Back' : 'Front'} camera</div>
        </div>
      )}
      
      {/* Camera Feed */}
      <div className="bg-black rounded overflow-hidden mb-3">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
          style={{ transform: isFrontActive() ? 'scaleX(-1)' as any : 'none', transformOrigin: 'center' }}
        />
      </div>
      
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Controls */}
      {cameraStarted && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button onClick={takePhoto} className="px-4 py-2 rounded bg-[#ede8df] text-[#171616] hover:bg-[#d6cfc0] transition-colors">
            📸 Take Photo
          </button>
          <button onClick={switchCamera} className="px-4 py-2 rounded bg-[#502d26] text-[#ede8df] hover:bg-[#6b4c3b] transition-colors">
            🔄 Switch Camera
          </button>
          {videoDevices.length > 0 && (
            <label className="text-sm flex items-center gap-2">
              <span className="opacity-70">Device:</span>
              <select
                className="bg-[#1f1e1d] border border-[#3b3733] rounded px-2 py-1 text-sm"
                value={selectedDeviceId}
                onChange={async (e) => {
                  const val = e.target.value as string;
                  setSelectedDeviceId(val as any);
                  if (val !== 'auto') {
                    await startCamera({ deviceId: val });
                    // Update preferred sides if we can infer
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
          )}
          <button onClick={() => { setMediaBlob(null); setPreviewUrl(null); setProgress(0); }} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors">
            🗑️ Reset
          </button>
          <button 
            onClick={uploadMedia} 
            disabled={!mediaBlob || uploading || !canUploadNow()} 
            className="px-4 py-2 rounded bg-[#171616] text-[#ede8df] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a2626] transition-colors"
          >
            {uploading ? `⬆️ Uploading ${progress}%` : '⬆️ Upload'}
          </button>
        </div>
      )}
      
      {/* Media Preview */}
      {mediaBlob && (
        <div id="capture-preview" className="mb-3">
          <h3 className="font-semibold">Preview</h3>
          {previewUrl ? (
            <img src={previewUrl} alt="preview image" className="mt-2 rounded max-h-96" />
          ) : (
            <div className="mt-2 text-sm opacity-70">Generating preview…</div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
