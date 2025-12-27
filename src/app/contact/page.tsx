import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import ContactPageClient from './ContactPageClient';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Contact',
  description: 'Get in touch with Odubo Studio. Questions about orders, returns, or just want to say hi? We\'re here to help.',
  path: '/contact',
});

export default function ContactPage() {
  return <ContactPageClient />;
}
