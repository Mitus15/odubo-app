'use client';

import dynamic from 'next/dynamic';
import { useSelectedLayoutSegment } from 'next/navigation';

/** The route group the rooms live in (app/(room)) */
export const ROOM_GROUP = '(room)';

// Its own chunk: a room page never asks for it
const AppShell = dynamic(() => import('./AppShell'));
// The cookie bar shows only once the page has read what was chosen before, so
// it can come just after the page rather than before it
const GDPRConsent = dynamic(() => import('@/components/GDPRConsent'), { ssr: false });

/**
 * The frame a page stands in. A room (anything under app/(room)) stands on
 * its own: it needs only what the root layout gives every page. Every other
 * page gets the AppShell, fetched alongside the page (Next preloads it while
 * the page is rendered on the server). Both get the cookie bar.
 */
export default function SiteFrame({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  return (
    <>
      {segment === ROOM_GROUP ? children : <AppShell>{children}</AppShell>}
      <GDPRConsent />
    </>
  );
}
