'use client';

import dynamic from 'next/dynamic';

/** three.js loads on this route only, and never on the server. */
const FlyGame = dynamic(() => import('./FlyGame'), {
  ssr: false,
  loading: () => (
    <div
      className="absolute inset-0 flex items-end px-6 pb-[max(22px,env(safe-area-inset-bottom))]"
      style={{ fontFamily: '"Jost", var(--font-geist-sans), sans-serif' }}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.34em] opacity-50">Recoolman</div>
    </div>
  ),
});

export interface FlyClientProps {
  /** Signed links to each song, by slug. A song with no link plays silent. */
  audio: Record<string, string>;
  /** Each chapter's field colour, by slug; missing ones use the album's defaults. */
  fields: Record<string, string>;
  /** When the song links were signed (ms). They last six hours. */
  mintedAt: number;
}

export default function FlyClient(props: FlyClientProps) {
  return <FlyGame {...props} />;
}
