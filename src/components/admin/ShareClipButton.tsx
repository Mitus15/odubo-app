'use client';

import { useState } from 'react';
import ShareClipModal from './ShareClipModal';

interface ShareClipButtonProps {
  clipId: number;
  clipTitle: string;
}

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <polyline points="16,6 12,2 8,6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

export default function ShareClipButton({ clipId, clipTitle }: ShareClipButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-blue-400 hover:text-blue-300 text-xs px-3 py-2.5 min-h-[44px] bg-blue-600/10 rounded-lg flex items-center gap-1.5 transition-colors"
        title="Share to social media"
      >
        <ShareIcon />
        <span className="hidden sm:inline">Share</span>
      </button>

      <ShareClipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clipId={clipId}
        clipTitle={clipTitle}
      />
    </>
  );
}
