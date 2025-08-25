'use client';

import { useState } from 'react';
import NowPlayingBar from './NowPlayingBar';
import FullScreenMusicPlayer from '@/components/FullScreenMusicPlayer';

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
