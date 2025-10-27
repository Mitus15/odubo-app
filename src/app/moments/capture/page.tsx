"use client";
import { useEffect, useRef, useState, use } from 'react';

export default function CapturePage({ searchParams }: { searchParams?: Promise<{ galleryId?: string; starts_at?: string; ends_at?: string }> }) {
  const params = searchParams ? use(searchParams) : {};
  const galleryId = params?.galleryId;
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

  // Start the camera
  async function startCamera() {
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('Camera requires HTTPS (or localhost). Please use a secure origin.');
        return;
      }

      // Check if modern API is available
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: { ideal: 'environment' } },
          audio: false 
        });
        
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
            setError('');
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
            setError('');
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
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob with Safari fallback
    const maybeToBlob = (canvas as HTMLCanvasElement).toBlob?.bind(canvas);
    if (maybeToBlob) {
      maybeToBlob((blob) => {
        if (blob) {
          setMediaBlob(blob);
          createPreviewURLFromBlob(blob).then((url) => setPreviewUrl(url || null));
          // Auto-scroll preview into view
          setTimeout(() => document.getElementById('capture-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } else {
          // Fallback to dataURL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const blob2 = dataURLToBlob(dataUrl);
          setMediaBlob(blob2);
          createPreviewURLFromBlob(blob2).then((url) => setPreviewUrl(url || null));
          setTimeout(() => document.getElementById('capture-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
      }, 'image/jpeg', 0.9);
    } else {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const blob2 = dataURLToBlob(dataUrl);
      setMediaBlob(blob2);
      createPreviewURLFromBlob(blob2).then((url) => setPreviewUrl(url || null));
      setTimeout(() => document.getElementById('capture-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
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
    if (!mediaBlob || !galleryId) return setError('No media or gallery');
    if (!canUploadNow()) return setError('This event is not accepting uploads at this time.');

    setError('');
    setUploading(true);
    try {
      const ext = mediaType === 'photo' ? 'jpg' : 'webm';
      const filename = `${mediaType}_${Date.now()}.${ext}`;
      const uRes = await fetch('/api/moments/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId, fileName: filename }),
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
        body: JSON.stringify({ galleryId, r2_key: key, original_filename: filename, user_name: 'Anonymous', media_type: mediaType }),
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
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    // Make this page independently scrollable within the App layout's main area
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-2xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-4">Capture Moment</h1>
      <div className="text-sm text-[#b2a491] mb-3">Event window: {startsAt ? startsAt.toLocaleString() : 'N/A'} — {endsAt ? endsAt.toLocaleString() : 'N/A'}</div>
      
      {error && <div className="text-red-400 mb-3 p-3 bg-red-900/20 border border-red-600 rounded">{error}</div>}
      {!canUploadNow() && <div className="mb-3 text-yellow-300">This event is not accepting uploads at this time.</div>}
      
      {!cameraStarted && (
        <div className="mb-3 p-3 bg-blue-900/20 border border-blue-600 rounded">
          <button 
            onClick={startCamera}
            className="px-4 py-2 rounded bg-[#ede8df] text-[#171616] hover:bg-[#d6cfc0] transition-colors font-semibold"
          >
            📷 Start Camera
          </button>
        </div>
      )}
      
      {/* Camera Feed */}
      <div className="bg-black rounded overflow-hidden mb-3">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto" />
      </div>
      
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Controls */}
      {cameraStarted && (
        <div className="flex gap-3 mb-3">
          <button onClick={takePhoto} className="px-4 py-2 rounded bg-[#ede8df] text-[#171616] hover:bg-[#d6cfc0] transition-colors">
            📸 Take Photo
          </button>
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
