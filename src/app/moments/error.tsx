'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function MomentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Moments error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#171616] px-4">
      <div className="max-w-md w-full text-center">
        {/* Photo Error Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#302927] flex items-center justify-center">
          <svg className="w-10 h-10 text-[#726d6c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-xl font-medium text-[#ede8df] mb-3">
          Unable to load gallery
        </h1>

        {/* Description */}
        <p className="text-[#b2a491] mb-8 text-sm">
          There was a problem loading the photo gallery. Your uploaded photos are safe.
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
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
