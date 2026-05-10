import AboutPageClient from './AboutPageClient';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'About — Case Study',
  description:
    'A deep dive into the Odubo Studio platform — from concept and strategy to architecture, design, and deployment. Built as a solo project spanning product development, creative direction, engineering, and operations.',
  path: '/about',
});

export default function AboutPage() {
  return <AboutPageClient />;
}
