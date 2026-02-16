'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import LinkTreeModal from '@/components/linktree/LinkTreeModal';

/**
 * Lightweight client for /links — renders LinkTreeModal directly
 * without loading the entire homepage (clips feed, video players, etc.)
 */
export default function LinksPageClient() {
  const router = useRouter();

  const handleClose = useCallback(() => {
    router.replace('/', { scroll: false });
  }, [router]);

  return (
    <div className="fixed inset-0 bg-black">
      <LinkTreeModal isOpen={true} onClose={handleClose} />
    </div>
  );
}
