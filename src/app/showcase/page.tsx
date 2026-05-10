import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import ShowcaseClient from './ShowcaseClient';

export const metadata: Metadata = generateSeoMetadata({
  title: '3D Portfolio Showcase — Odubo Studio',
  description:
    'Interactive 3D portfolio featuring character design, world building, and rapid prototyping. Built with Three.js, Blender, and AI-assisted workflows.',
  path: '/showcase',
});

export default function ShowcasePage() {
  return <ShowcaseClient />;
}
