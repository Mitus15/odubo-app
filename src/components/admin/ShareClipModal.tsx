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

type ShareStatus = 'idle' | 'loading' | 'error';

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <polyline points="16,6 12,2 8,6" />
    <line x1="12" y1="2" x2="12" y2="15" />
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
    if (typeof navigator !== 'undefined' && navigator.share) {
      const testFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
        setSupportsShare(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setMessage('');
    }
  }, [isOpen]);

  const fetchVideoWithRetry = async (maxRetries = 5): Promise<string | null> => {
    const token = localStorage.getItem('token');
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch(`/api/videos/${clipId}/download`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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

  const fetchVideo = async (): Promise<Blob> => {
    const downloadUrl = await fetchVideoWithRetry();
    if (!downloadUrl) {
      throw new Error('Video is still processing. Please try again.');
    }

    setMessage('Downloading video...');
    const proxyUrl = `/api/admin/media-proxy?url=${encodeURIComponent(downloadUrl)}`;
    const videoRes = await fetch(proxyUrl);
    if (!videoRes.ok) {
      throw new Error('Failed to download video');
    }

    return videoRes.blob();
  };

  const handleShare = async () => {
    setStatus('loading');
    setMessage('Getting video ready...');

    try {
      const blob = await fetchVideo();
      const safeTitle = clipTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const file = new File([blob], `${safeTitle}.mp4`, { type: 'video/mp4' });

      if (supportsShare && navigator.canShare && navigator.canShare({ files: [file] })) {
        setMessage('Opening share menu...');
        await navigator.share({
          files: [file],
          title: clipTitle,
        });
        setStatus('idle');
        onClose();
      } else {
        triggerDownload(blob, `${safeTitle}.mp4`);
        setStatus('idle');
        onClose();
      }
    } catch (error: any) {
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
      const blob = await fetchVideo();
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
          className="bg-[#1a1614] border border-[#b2a491]/20 rounded-2xl p-6 w-full max-w-xs shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
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

          {/* Loading state */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin mb-4" />
              <p className="text-[#888] text-sm text-center">{message}</p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-4 mb-4">
              <p className="text-red-400 text-sm mb-4 text-center">{message}</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-[#b2a491] hover:text-[#ede8df] text-sm underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Action buttons */}
          {status === 'idle' && (
            <div className="space-y-3">
              {supportsShare && (
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#1a1614] rounded-xl transition-colors font-medium"
                >
                  <ShareIcon />
                  <span>Share</span>
                </button>
              )}
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#302927] hover:bg-[#3d3633] text-[#ede8df] rounded-xl transition-colors"
              >
                <DownloadIcon />
                <span>Download</span>
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
