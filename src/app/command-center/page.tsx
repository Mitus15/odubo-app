'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Command Center Redirect
 * 
 * Command Center has been consolidated into the main Admin Dashboard.
 * All functionality (distribution panels, analytics, social accounts) 
 * is now available in the unified Admin interface.
 * 
 * This page redirects to /admin for a seamless transition.
 */

export default function CommandCenterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#726d6c]">Redirecting to Admin Dashboard...</p>
      </div>
    </div>
  );
}
