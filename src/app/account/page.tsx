'use client';

import { useEffect } from 'react';

/**
 * Account Page
 *
 * With New Customer Accounts, Shopify handles all account functionality.
 * This page just redirects to Shopify's hosted account page.
 */
export default function AccountPage() {
  useEffect(() => {
    // Redirect to Shopify's hosted account page
    window.location.href = 'https://account.odubo.studio';
  }, []);

  // Show loading while redirecting
  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df]">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
        <span className="mt-4 text-[#b2a491] text-sm">Redirecting to account...</span>
      </div>
    </div>
  );
}
