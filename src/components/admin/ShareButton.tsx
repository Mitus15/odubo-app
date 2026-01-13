'use client';

import React, { useState } from 'react';

interface ShareButtonProps {
  /** URL to the media file (video or image) - used for images/moments */
  mediaUrl?: string;
  /** Video ID for clips - will fetch download URL from API */
  videoId?: number;
  /** Title for the share */
  title: string;
  /** Media type for determining file extension and MIME type */
  mediaType: 'video' | 'image';
  /** Optional filename (without extension) */
  filename?: string;
  /** Button size variant */
  size?: 'sm' | 'md';
  /** Optional className override */
  className?: string;
  /** Optional callback when share completes/fails */
  onShareComplete?: (success: boolean) => void;
}

/**
 * ShareButton - Native share functionality using Web Share API
 *
 * Downloads the media file and shares it via the device's native share sheet.
 * Perfect for sharing to Instagram, TikTok, YouTube, etc. on mobile.
 */
export function ShareButton({
  mediaUrl,
  videoId,
  title,
  mediaType,
  filename,
  size = 'md',
  className,
  onShareComplete,
}: ShareButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Get video download URL from API (enables MP4 on Cloudflare Stream)
  const getVideoDownloadUrl = async (id: number): Promise<string | null> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(`/api/videos/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    }

    return null;
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isLoading) return;

    // Check if Web Share API is available
    if (!navigator.share) {
      alert('Sharing is not supported on this device');
      onShareComplete?.(false);
      return;
    }

    setIsLoading(true);

    try {
      // Try file sharing first (preferred for social media posting)
      if (navigator.canShare) {
        const extension = mediaType === 'video' ? 'mp4' : 'jpg';
        const mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        const safeFilename = filename || title.replace(/[^a-zA-Z0-9]/g, '_');

        let fetchUrl: string;

        if (videoId && mediaType === 'video') {
          // For videos: get download URL from API (enables MP4 on Cloudflare)
          const downloadUrl = await getVideoDownloadUrl(videoId);
          if (!downloadUrl) {
            throw new Error('Video is still processing. Try again in a moment.');
          }
          fetchUrl = downloadUrl;
        } else if (mediaUrl) {
          // For images: use proxy to bypass CORS
          fetchUrl = `/api/admin/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
        } else {
          throw new Error('No media URL provided');
        }

        const response = await fetch(fetchUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch media');
        }

        const blob = await response.blob();
        const file = new File([blob], `${safeFilename}.${extension}`, { type: mimeType });

        // Check if we can share this file
        const shareData = { files: [file], title };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          onShareComplete?.(true);
          return;
        }
      }

      // Fallback to URL sharing
      await navigator.share({
        title,
        text: title,
        url: mediaUrl || '',
      });
      onShareComplete?.(true);
    } catch (error: any) {
      // User cancelled is not an error
      if (error?.name !== 'AbortError') {
        console.error('Share failed:', error);
        alert(error.message || 'Failed to share. Please try again.');
        onShareComplete?.(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = size === 'sm'
    ? 'w-8 h-8'
    : 'w-10 h-10';

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <button
      onClick={handleShare}
      disabled={isLoading}
      className={className || `${sizeClasses} flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition-colors disabled:opacity-50`}
      title="Share"
    >
      {isLoading ? (
        <svg className={`${iconSize} animate-spin`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className={iconSize} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
        </svg>
      )}
    </button>
  );
}

export default ShareButton;
