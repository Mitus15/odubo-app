import type { ReactNode } from 'react';
import { houseFont } from '@/lib/brand/houseFont';

/** The Studio's house face, for "Studio" beside the danceman (lib/brand/houseFont) */
export default function SocialStudioLayout({ children }: { children: ReactNode }) {
  return <div className={houseFont.variable}>{children}</div>;
}
