"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MomentsClipsPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/moments?view=clips');
  }, [router]);
  
  return (
    <div className="min-h-screen bg-[#171616] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#502d26]/40 border-t-[#843c2d] rounded-full animate-spin" />
    </div>
  );
}
