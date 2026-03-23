import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import MomentsPageClient from './MomentsPageClient';
import MomentsNav from '@/components/moments/MomentsNav';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Moments',
  description: 'Capture and share moments from live events. Browse photo galleries, record highlights, and connect with other attendees.',
  path: '/moments',
});

export const dynamic = 'force-dynamic';

export default function MomentsPage() {
  return (
    <div className="min-h-screen bg-[#171616]">
      <MomentsNav />
      <MomentsPageClient />
    </div>
  );
}