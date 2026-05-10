import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Documentation — Case Study',
  description: 'Public architecture and strategy documents for the Odubo Studio platform.',
  path: '/docs',
});

const documents = [
  {
    title: 'Strategic Vision',
    description: 'The founding vision, business model, and strategic roadmap for Odubo Studio as a multimedia platform.',
    slug: 'vision',
    source: 'VISION.md',
  },
  {
    title: 'Content System Architecture',
    description: 'How media is stored, processed, and delivered — including video pipeline, storage conventions, and CDN strategy.',
    slug: 'content-architecture',
    source: 'CONTENT_SYSTEM_ARCHITECTURE.md',
  },
  {
    title: 'Moments App — Architecture',
    description: 'Technical specification for the Moments event photo/video sharing platform.',
    slug: 'moments-architecture',
    source: 'moments/ARCHITECTURE.md',
  },
  {
    title: 'Moments App — Roadmap',
    description: 'Product phases, feature backlog, and development priorities for Moments.',
    slug: 'moments-roadmap',
    source: 'moments/ROADMAP.md',
  },
  {
    title: 'Odubo Wrld — Creative Vision',
    description: 'The creative universe, philosophy, and long-term vision for the Odubo Wrld ecosystem.',
    slug: 'odubo-wrld-vision',
    source: 'COOL_WRLD/VISION.md',
  },
  {
    title: 'Odubo Wrld — Technical Implementation',
    description: 'Database schema, API architecture, and implementation guide for the Odubo Wrld ecosystem.',
    slug: 'odubo-wrld-technical',
    source: 'COOL_WRLD/TECHNICAL_IMPLEMENTATION.md',
  },
  {
    title: 'Business Launch Checklist',
    description: 'Pre-launch requirements, operational setup, and go-to-market checklist.',
    slug: 'business-launch',
    source: 'BUSINESS_LAUNCH_CHECKLIST.md',
  },
  {
    title: 'Deployment Guide',
    description: 'CI/CD pipeline, environment configuration, and deployment procedures.',
    slug: 'deployment',
    source: 'DEPLOYMENT.md',
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#f5f0eb]">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-20">
        <div className="about-eyebrow">Public Documentation</div>
        <h1 className="about-display mb-4">Architecture & Strategy</h1>
        <p className="about-body about-body-large max-w-2xl mb-12">
          Sanitized versions of key project documents — strategy, architecture, 
          and implementation guides. These are the same documents used to plan 
          and build the platform, redacted for public viewing.
        </p>

        <div className="grid gap-4">
          {documents.map((doc) => (
            <a
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="about-card group block no-underline"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-[#1a1a1a] text-base mb-1 font-['Baskerville'] group-hover:text-[#843c2d] transition-colors">
                    {doc.title}
                  </h2>
                  <p className="about-body text-sm">{doc.description}</p>
                </div>
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-[#9c9490] group-hover:text-[#843c2d] transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
