'use client';

import { useEffect } from 'react';

/**
 * Account Page
 * Redirects to Shopify's hosted account portal.
 */
export default function AccountPage() {
  useEffect(() => {
    window.location.href = 'https://account.odubo.studio';
  }, []);

  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df]">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
        <span className="mt-4 text-[#b2a491] text-sm">Redirecting to account...</span>
      </div>
    </div>
  );
}
