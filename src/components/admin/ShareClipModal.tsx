'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  clipId: number;
  clipTitle: string;
}

type ShareStatus = 'idle' | 'loading' | 'ready' | 'error';

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7,10 12,15 17,10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export default function ShareClipModal({ isOpen, onClose, clipId, clipTitle }: ShareClipModalProps) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [message, setMessage] = useState('');
  const [supportsShare, setSupportsShare] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if Web Share API with files is supported
    if (typeof navigator !== 'undefined' && navigator.share) {
      // Test if file sharing is supported
      const testFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
        setSupportsShare(true);
      }
    }
  }, []);

  useEffect(() => {
    // Reset state when modal opens
    if (isOpen) {
      setStatus('idle');
      setMessage('');
    }
  }, [isOpen]);

  const fetchVideoWithRetry = async (maxRetries = 5): Promise<string | null> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch(`/api/videos/${clipId}/download`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await res.json();

      if (data.status === 'ready' && data.url) {
        return data.url;
      }

      if (data.status === 'pending') {
        setMessage(`Preparing video... (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    }

    return null;
  };

  const handleShare = async (platform: string) => {
    setStatus('loading');
    setMessage('Getting video ready...');

    try {
      // 1. Get the download URL
      const downloadUrl = await fetchVideoWithRetry();

      if (!downloadUrl) {
        throw new Error('Video is still processing. Please try again in a moment.');
      }

      setMessage('Downloading video...');

      // 2. Fetch the video as a blob
      const videoRes = await fetch(downloadUrl);
      if (!videoRes.ok) {
        throw new Error('Failed to download video');
      }

      const blob = await videoRes.blob();

      // 3. Create a File object
      const safeTitle = clipTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const file = new File([blob], `${safeTitle}.mp4`, { type: 'video/mp4' });

      // 4. Use Web Share API
      if (supportsShare && navigator.canShare && navigator.canShare({ files: [file] })) {
        setMessage('Opening share menu...');
        await navigator.share({
          files: [file],
          title: clipTitle,
        });
        setStatus('idle');
        onClose();
      } else {
        // Fallback: trigger download
        triggerDownload(blob, `${safeTitle}.mp4`);
        setStatus('idle');
        onClose();
      }
    } catch (error: any) {
      // User cancelled share - not an error
      if (error.name === 'AbortError') {
        setStatus('idle');
        return;
      }

      console.error('Share error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to share video');
    }
  };

  const handleDownload = async () => {
    setStatus('loading');
    setMessage('Getting video ready...');

    try {
      const downloadUrl = await fetchVideoWithRetry();

      if (!downloadUrl) {
        throw new Error('Video is still processing. Please try again.');
      }

      setMessage('Downloading...');
      const videoRes = await fetch(downloadUrl);
      const blob = await videoRes.blob();

      const safeTitle = clipTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      triggerDownload(blob, `${safeTitle}.mp4`);

      setStatus('idle');
      onClose();
    } catch (error: any) {
      console.error('Download error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to download video');
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !mounted) return null;

  const platforms = [
    { id: 'instagram', name: 'Instagram', icon: InstagramIcon, color: 'from-purple-500 to-pink-500' },
    { id: 'tiktok', name: 'TikTok', icon: TikTokIcon, color: 'from-cyan-400 to-pink-500' },
    { id: 'youtube', name: 'YouTube Shorts', icon: YouTubeIcon, color: 'from-red-500 to-red-600' },
  ];

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && status !== 'loading') onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="bg-[#1a1614] border border-[#b2a491]/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[#ede8df] text-lg font-medium">Share Clip</h2>
            <button
              onClick={onClose}
              disabled={status === 'loading'}
              className="text-[#888] hover:text-[#ede8df] disabled:opacity-50 w-8 h-8 flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Clip title */}
          <p className="text-[#888] text-sm mb-6 truncate">{clipTitle}</p>

          {/* Loading/Error state */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin mb-4" />
              <p className="text-[#888] text-sm">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-6 mb-4">
              <p className="text-red-400 text-sm mb-4">{message}</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-[#b2a491] hover:text-[#ede8df] text-sm underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Platform buttons */}
          {status === 'idle' && (
            <>
              {supportsShare ? (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => handleShare(platform.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${platform.color} hover:scale-105 active:scale-95 transition-transform`}
                    >
                      <platform.icon />
                      <span className="text-white text-xs font-medium">{platform.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 mb-4">
                  <p className="text-[#888] text-sm mb-2">
                    Direct sharing isn&apos;t supported on this device.
                  </p>
                  <p className="text-[#666] text-xs">
                    Download the video and upload it manually to your preferred platform.
                  </p>
                </div>
              )}

              {/* Download fallback */}
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#302927] hover:bg-[#3d3633] text-[#ede8df] rounded-xl transition-colors"
              >
                <DownloadIcon />
                <span className="text-sm">Download Video</span>
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
