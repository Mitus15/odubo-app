'use client';

import { useState } from 'react';
import NowPlayingBar from './NowPlayingBar';
import dynamic from 'next/dynamic';

const FullScreenMusicPlayer = dynamic(() => import('@/components/FullScreenMusicPlayer'), {
  ssr: false,
  loading: () => null,
});

export default function MusicPlayerLayout() {
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  return (
    <>
      <NowPlayingBar onOpenPlayer={() => setIsFullScreenOpen(true)} />
      <FullScreenMusicPlayer 
        isOpen={isFullScreenOpen} 
        onClose={() => setIsFullScreenOpen(false)} 
      />
    </>
  );
}
