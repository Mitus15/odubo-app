import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in | Odubo Studio',
  description: 'Sign in to Odubo Studio.',
  // An account page is nobody's search result
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
