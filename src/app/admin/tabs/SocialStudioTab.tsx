'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the Social Studio page component
const SocialStudioPage = dynamic(() => import('@/app/admin/social-studio/page'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#D4A853]/20 border-t-[#D4A853] rounded-full animate-spin mx-auto mb-4 shadow-[0_0_20px_rgba(212,168,83,0.15)]" />
        <p className="text-[#8a8584] tracking-wide">Loading Social Studio...</p>
      </div>
    </div>
  ),
});

export default function SocialStudioTab() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#D4A853]/20 border-t-[#D4A853] rounded-full animate-spin mx-auto mb-4 shadow-[0_0_20px_rgba(212,168,83,0.15)]" />
          <p className="text-[#8a8584] tracking-wide">Loading Social Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black">
      <SocialStudioPage />
    </div>
  );
}
