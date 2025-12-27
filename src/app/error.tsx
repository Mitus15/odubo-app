'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service (Sentry)
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#843c2d]/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-[#843c2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-serif font-medium text-[#ede8df] mb-3">
          Something went wrong
        </h1>

        {/* Description */}
        <p className="text-[#b2a491] mb-8">
          We encountered an unexpected error. This has been logged and we're looking into it.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl bg-[#843c2d] text-[#ede8df] font-medium hover:bg-[#6d3224] transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl border border-[#502d26]/40 text-[#b2a491] font-medium hover:border-[#843c2d]/50 hover:text-[#ede8df] transition-colors"
          >
            Go Home
          </Link>
        </div>

        {/* Error Details (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-8 text-left">
            <summary className="text-xs text-[#726d6c] cursor-pointer hover:text-[#b2a491]">
              Error details
            </summary>
            <pre className="mt-2 p-4 rounded-lg bg-[#171616] text-xs text-[#726d6c] overflow-auto max-h-40">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
