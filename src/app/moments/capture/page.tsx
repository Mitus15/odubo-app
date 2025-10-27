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
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Start the camera
  async function startCamera() {
    try {
      // Check if modern API is available
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' },
          audio: false 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setStream(mediaStream);
          setCameraStarted(true);
          setError('');
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
          setStream(mediaStream);
          setCameraStarted(true);
          setError('');
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
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    // Draw current video frame onto canvas
    const context = canvas.getContext('2d');
    if (!context) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        setMediaBlob(blob);
        setMediaType('photo');
      }
    }, 'image/jpeg', 0.9);
  }

  // Record short video
  function recordShortVideo() {
    if (!stream) return setError('No camera stream available');
    
    setMediaType('video');
    setMediaBlob(null);

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (ev) => chunks.push(ev.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setMediaBlob(blob);
    };

    recorder.start();
    // Auto-stop after 7 seconds
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 7000);
  }

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
          <button onClick={recordShortVideo} className="px-4 py-2 rounded bg-[#60a5fa] text-white hover:bg-[#3b82f6] transition-colors">
            🎥 Record Video (≤7s)
          </button>
          <button onClick={() => { setMediaBlob(null); setProgress(0); }} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors">
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
        <div className="mb-3">
          <h3 className="font-semibold">Preview</h3>
          {mediaType === 'photo' ? (
            <img src={URL.createObjectURL(mediaBlob)} alt="preview" className="mt-2 rounded max-h-96" />
          ) : (
            <video controls src={URL.createObjectURL(mediaBlob)} className="mt-2 rounded max-h-96" />
          )}
        </div>
      )}
      </div>
    </div>
  );
}
