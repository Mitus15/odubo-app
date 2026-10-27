import type { ReactNode } from 'react';
import { Libre_Baskerville } from 'next/font/google';

/**
 * The Studio's house face: Libre Baskerville Bold, the face the ODUBO lockup
 * is drawn in (docs/decisions/odubo-logo.md), for "Studio" beside the
 * danceman. Loaded here only, as --font-house, so the rest of the site keeps
 * its own type.
 */
const house = Libre_Baskerville({ subsets: ['latin'], weight: '700', variable: '--font-house', display: 'swap' });

export default function SocialStudioLayout({ children }: { children: ReactNode }) {
  return <div className={house.variable}>{children}</div>;
}
