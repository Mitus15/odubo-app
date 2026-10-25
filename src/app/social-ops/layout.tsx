import type { Metadata } from 'next';

/** An operations tool behind its own login: never in search. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SocialOpsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
