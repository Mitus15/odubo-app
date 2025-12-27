'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function MediaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Media error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#171616] px-4">
      <div className="max-w-md w-full text-center">
        {/* Video Error Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#302927] flex items-center justify-center">
          <svg className="w-10 h-10 text-[#726d6c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-xl font-medium text-[#ede8df] mb-3">
          Unable to load media
        </h1>

        {/* Description */}
        <p className="text-[#b2a491] mb-8 text-sm">
          There was a problem loading the media content. This could be a temporary issue.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-[#843c2d] text-[#ede8df] text-sm font-medium hover:bg-[#6d3224] transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-[#502d26]/40 text-[#b2a491] text-sm font-medium hover:border-[#843c2d]/50 hover:text-[#ede8df] transition-colors"
          >
            Back to Clips
          </Link>
        </div>
      </div>
    </div>
  );
}
