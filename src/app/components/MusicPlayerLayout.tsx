'use client';

import PlayerRoot from '@/components/player/PlayerRoot';

export default function MusicPlayerLayout() {
  // The new PlayerRoot manages its own expanded state and queue
  return (
    <>
      <PlayerRoot />
    </>
  );
}
