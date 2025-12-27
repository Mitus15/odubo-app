'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Store error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] px-4">
      <div className="max-w-md w-full text-center">
        {/* Store Icon with Error */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#843c2d]/20 flex items-center justify-center relative">
          <svg className="w-10 h-10 text-[#843c2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-serif font-medium text-[#ede8df] mb-3">
          Store temporarily unavailable
        </h1>

        {/* Description */}
        <p className="text-[#b2a491] mb-4">
          We're having trouble loading the store. Your cart is safe - please try again in a moment.
        </p>

        {/* Cart preservation notice */}
        <p className="text-sm text-[#726d6c] mb-8">
          Don't worry - your cart items are saved locally and won't be lost.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl bg-[#843c2d] text-[#ede8df] font-medium hover:bg-[#6d3224] transition-colors"
          >
            Reload Store
          </button>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl border border-[#502d26]/40 text-[#b2a491] font-medium hover:border-[#843c2d]/50 hover:text-[#ede8df] transition-colors"
          >
            Browse Clips
          </Link>
        </div>

        {/* Contact support link */}
        <div className="mt-8">
          <Link href="/contact" className="text-sm text-[#726d6c] hover:text-[#b2a491] transition-colors">
            Having trouble? Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
