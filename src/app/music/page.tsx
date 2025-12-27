import { redirect } from 'next/navigation';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Music',
  description: 'Listen to albums and tracks from Odubo. Stream the latest releases and discover new sounds.',
  path: '/music',
});

export const revalidate = 0;

export default function MusicPage() {
  redirect('/media');
}
