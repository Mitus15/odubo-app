import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clips | Odubo Studio',
  description: 'Browse video clips',
};

export default function ClipsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
