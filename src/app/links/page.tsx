import LinksPageClient from './LinksPageClient';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Links',
  description: 'Connect with Odubo across all platforms. Find social media, streaming services, and more.',
  path: '/links',
});

export default function LinksPage() {
  return <LinksPageClient />;
}
