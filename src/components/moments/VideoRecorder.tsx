'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface VideoRecorderProps {
  galleryId: number;
  code: string;
  onRecordingComplete: (blob: Blob, thumbnail: string | null) => void;
  onError?: (error: string) => void;
  maxDuration?: number;
}

export default function VideoRecorder({
  galleryId,
  code,
  onRecordingComplete,
  onError,
  maxDuration = 15,
}: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setStream(mediaStream);
      setCameraStarted(true);
      setError('');
    } catch (e: any) {
      console.error('Camera error:', e);
      setError(e?.message || 'Failed to start camera');
      onError?.(e?.message || 'Failed to start camera');
    }
  }, [facingMode, stream, onError]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
      setCameraStarted(false);
    }
  }, [stream]);

  const startRecording = useCallback(() => {
    if (!stream) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      
      // Generate thumbnail
      let thumbnail: string | null = null;
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        }
      }

      onRecordingComplete(blob, thumbnail);
      setIsRecording(false);
      setRecordingTime(0);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= maxDuration - 1) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, [stream, maxDuration, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  useEffect(() => {
    if (facingMode && cameraStarted) {
      startCamera();
    }
  }, [facingMode]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopCamera]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="w-full aspect-[9/16] bg-black rounded-xl object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600/80 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white text-sm font-medium">
            {recordingTime}s / {maxDuration}s
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 px-4">
        {!isRecording ? (
          <>
            <button
              onClick={switchCamera}
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={startRecording}
              disabled={!cameraStarted}
              className="w-16 h-16 rounded-full bg-red-600 border-4 border-white flex items-center justify-center disabled:opacity-50"
            >
              <div className="w-8 h-8 bg-white rounded-full" />
            </button>

            <button
              onClick={stopCamera}
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <button
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-red-600 border-4 border-white flex items-center justify-center animate-pulse"
          >
            <div className="w-6 h-6 bg-white rounded" />
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute top-1/2 left-4 right-4 p-3 bg-red-600/80 rounded-lg text-white text-sm text-center">
          {error}
        </div>
      )}

      {/* Start camera button if not started */}
      {!cameraStarted && !isRecording && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <button
            onClick={startCamera}
            className="px-6 py-3 bg-white rounded-full font-medium"
          >
            Start Camera
          </button>
        </div>
      )}
    </div>
  );
}