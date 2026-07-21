import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - Cool Wrld',
  description: 'Sign in to your Cool Wrld account',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
