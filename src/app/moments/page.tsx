import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import MomentsPageClient from './MomentsPageClient';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Moments',
  description: 'Capture and share moments from live events. Browse photo galleries and contribute to the community.',
  path: '/moments',
});

export default function MomentsPage() {
  return <MomentsPageClient />;
}
