import type { Metadata } from 'next';
import type { FeaturedConfig } from './FeaturedInteractive';
import FeaturedHeroClient from './FeaturedHeroClient';
import { queryDatabase } from '@/lib/db';
import { redirect } from 'next/navigation';

// In the future, fetch this from D1 or Admin-configured CMS. For now, inline config.
const FEATURED_MAP: Record<string, FeaturedConfig> = {
  'catching-light': {
    slug: 'catching-light',
    title: 'Catching Light',
    subtitle: 'A moving painting — a featured experience',
    date: 'November 15, 2025',
    venue: 'TRU Art Gallery',
    momentsLink: '/moments', // TODO: replace with event-specific join link
    extraLinks: [
      { label: 'Apple Music', href: '#' },
      { label: 'Spotify', href: '#' }
    ],
    // Provide later: backgroundVideoUrl: 'https://media.odubo.studio/featured/catching-light/loop.mp4'
  }
};

export async function generateMetadata(): Promise<Metadata> {
  // Keep simple metadata while we redirect
  return { title: 'Featured' };
}

export default async function FeaturedPage() {
  redirect('/featured');
}
