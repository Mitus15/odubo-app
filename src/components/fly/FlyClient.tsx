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

export default function FlyClient() {
  return <FlyGame />;
}
