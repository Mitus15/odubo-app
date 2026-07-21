'use client';

import { useState, useEffect } from 'react';
import './about.css';
import AboutHero from './components/AboutHero';
import ChapterCard from './components/ChapterCard';
import SkillsGrid from './components/SkillsGrid';
import LivePreview from './components/LivePreview';
import AboutFooter from './components/AboutFooter';

const chapters = [
  {
    number: '01',
    title: 'Vision & Strategy',
    subtitle: 'Product Development · Creative Direction',
    description:
      'Every product starts with a vision. Before writing any code, the Odubo platform was defined through strategy documents, business modeling, and competitive positioning — establishing what it would be, who it was for, and how it would sustain itself.',
    skills: ['Product Strategy', 'Business Modeling', 'Market Positioning', 'Roadmapping'],
    items: [
      {
        label: 'Vision Document',
        text: 'A comprehensive strategic charter defining the platform as "the intersection of art, technology, and the human soul" — combining music, fashion, video, and community into a unified brand experience.',
      },
      {
        label: 'Business Model',
        text: 'Three-tier revenue framework: primary (DTC commerce via Shopify), secondary (content monetization via streaming), and tertiary (fan engagement via events and memberships).',
      },
      {
        label: 'Competitive Positioning',
        text: 'Positioned not as a generic Shopify store or SoundCloud clone, but as an immersive brand experience — a unified platform replacing 5+ separate tools.',
      },
      {
        label: 'Content Ecosystem',
        text: 'Designed a flywheel where clips drive streams, streams build audience, audience attends performances, performances sell merch, and merch funds more creation.',
      },
    ],
    linkHref: '/docs/vision',
    linkLabel: 'View Vision Document',
    pullQuote: 'Not a generic Shopify store or SoundCloud clone — an immersive brand experience replacing 5+ separate tools.',
    pullQuoteAttribution: 'Competitive Positioning Strategy',
    marginalNote: 'The vision document was the first thing written. Everything else followed from it.',
  },
  {
    number: '02',
    title: 'Architecture & Build',
    subtitle: 'Technical Leadership · Project Management',
    description:
      'The platform was architected from the ground up as a modern full-stack application. Every decision — from the database schema to the deployment pipeline — was made with scalability, performance, and maintainability in mind.',
    skills: ['System Design', 'Full-Stack Development', 'DevOps', 'Database Architecture'],
    items: [
      {
        label: 'Tech Stack',
        text: 'Next.js 15 on Cloudflare Pages with D1 (SQLite), R2 (object storage), and Stream (video). JWT-based auth, Shopify for commerce, and Tailwind CSS for the design system.',
      },
      {
        label: 'Video Pipeline',
        text: 'End-to-end video processing pipeline: upload via tus resumable protocol → Cloudflare Stream transcoding → HLS streaming with MP4 fallback → automated thumbnail generation.',
      },
      {
        label: 'Deployment Infrastructure',
        text: 'Automated CI/CD via Cloudflare Pages, WAF configuration for security, environment-specific secrets management, and database migration pipelines.',
      },
      {
        label: 'Architecture Documentation',
        text: 'Comprehensive technical docs covering the content system architecture, video processing workflow, authentication flows, and deployment procedures.',
      },
    ],
    linkHref: '/docs/content-architecture',
    linkLabel: 'Browse Architecture Docs',
    pullQuote: 'I don\'t know how to code in the traditional sense. What I know is how to build — by iterating across AI tools, terminals, and design software until something works.',
    pullQuoteAttribution: 'The approach behind the architecture',
    marginalNote: '115+ database migrations. 37 public pages. 25+ admin pages. 8 content systems.',
  },
  {
    number: '03',
    title: 'Experience & Design',
    subtitle: 'Creative Direction · UI/UX · Brand Identity',
    description:
      'The visual identity of Odubo is built around a cinematic, warm aesthetic — dark gradients, glass-morphism, serif typography, and a terracotta/burgundy palette. Every visual decision reinforces the brand as premium, immersive, and intentional.',
    skills: ['Brand Identity', 'Design Systems', 'UI/UX Design', 'Visual Assets'],
    items: [
      {
        label: 'Design System',
        text: 'A comprehensive CSS architecture with glass-morphism, holographic UI, and editorial design systems — all built as reusable utility classes that maintain consistency across the entire platform.',
      },
      {
        label: 'Brand Identity',
        text: 'Custom logo suite, brand color palette (#843c2d terracotta primary), typography hierarchy (Baskerville serif + SF Pro sans), and visual language spanning digital and print.',
      },
      {
        label: 'Visual Assets',
        text: 'Poster designs, brand materials, and print-ready assets created using AI-assisted generation with manual refinement — spanning the full range of visual communication.',
      },
      {
        label: 'Responsive Experience',
        text: 'Mobile-first design with desktop adaptations, PWA support for installable app experience, and performance-optimized animations using CSS containment and GPU acceleration.',
      },
    ],
    linkHref: '/Designs/saint.png',
    linkLabel: 'View Design Assets',
    marginalNote: 'Visual assets created via AI + manual refinement. See the gallery below.',
  },
  {
    number: '04',
    title: 'Launch & Operations',
    subtitle: 'Project Management · Marketing · Analytics',
    description:
      'Building the platform was only half the work. Launching it required deployment checklists, monitoring setup, analytics configuration, content strategy, and ongoing operations — treating the platform as a live product, not a finished project.',
    skills: ['Operations', 'Analytics', 'Content Strategy', 'Monitoring'],
    items: [
      {
        label: 'Analytics & Monitoring',
        text: 'Google Analytics 4, Sentry error tracking, performance monitoring via Lighthouse CI, and custom analytics context for tracking user engagement across the platform.',
      },
      {
        label: 'Social Operations',
        text: 'A command center for social media distribution — scheduling posts, tracking deployments across platforms, and managing the content calendar for YouTube, Instagram, TikTok, and more.',
      },
      {
        label: 'Deployment Checklists',
        text: 'Comprehensive production setup guides, WAF deployment scripts, environment validation, and migration procedures — ensuring every deployment is repeatable and auditable.',
      },
      {
        label: 'Content Pipeline',
        text: 'From video upload to social distribution: automated transcoding, AI-powered descriptions, clip generation, and multi-platform deployment — all managed through the platform itself.',
      },
    ],
    linkHref: '/social-ops',
    linkLabel: 'Explore Command Center',
    pullQuote: 'Building the platform was half the work. The other half is making sure people know it exists.',
    pullQuoteAttribution: 'Operations philosophy',
    marginalNote: 'The platform is treated as a live product, not a finished project. Iteration continues.',
  },
];

/* ─── Brand Assets Data ─────────────────────────────────────────────────── */

const logoAssets = [
  { src: '/brand-logos/Danceman_Logo_Red.png', alt: 'Danceman Logo' },
  { src: '/brand-logos/odubo-logo.png', alt: 'Odubo Logo' },
  { src: '/brand-logos/odubo-white.png', alt: 'Odubo White Logo' },
  { src: '/brand-logos/odubo-emboss.png', alt: 'Odubo Embossed Logo' },
  { src: '/brand-logos/baad-w-text.png', alt: 'BAAD Logo with Text' },
  { src: '/brand-logos/baad-new-logo.png', alt: 'BAAD New Logo' },
  { src: '/brand-logos/danceman-brand.png', alt: 'Danceman Brand' },
  { src: '/brand-logos/danceman.png', alt: 'Danceman' },
];

const printAssets = [
  { src: '/Designs/saint.png', alt: 'Saint poster design' },
  { src: '/Designs/swan.png', alt: 'Swan poster design' },
  { src: '/Designs/branding-and-prints/vie en vin.png', alt: 'Vie en Vin print' },
  { src: '/Designs/branding-and-prints/vie en vin-white.png', alt: 'Vie en Vin white print' },
  { src: '/Designs/branding-and-prints/baad-logo.png', alt: 'BAAD logo print' },
  { src: '/Designs/branding-and-prints/baad-logo-black.png', alt: 'BAAD logo black print' },
];

/* ─── Image Modal ───────────────────────────────────────────────────────── */

function ImageModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="about-lightbox"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition-colors z-10"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/* ─── Brand Assets Section ──────────────────────────────────────────────── */

function BrandAssetsSection() {
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

  return (
    <section className="about-section">
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow">Visual Identity</div>
        <h2 className="about-heading mb-4">Brand Assets & Design Work</h2>
        <p className="about-body about-body-large max-w-3xl mb-8">
          The Odubo brand spans digital and print — from the logo suite and 
          brand palette to poster designs and print-ready materials. Every 
          asset was created through a process of AI-assisted generation 
          followed by manual refinement in design software.
        </p>

        {/* Logos */}
        <div className="mb-8">
          <span className="about-label text-[0.625rem] block mb-3">Logo Suite</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {logoAssets.map((asset) => (
              <button
                key={asset.src}
                onClick={() => setModalImage(asset)}
                className="about-card flex items-center justify-center p-6 aspect-square cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <img src={asset.src} alt={asset.alt} className="max-w-full max-h-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        {/* Designs & Prints */}
        <div className="mb-8">
          <span className="about-label text-[0.625rem] block mb-3">Posters & Prints</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {printAssets.map((asset) => (
              <button
                key={asset.src}
                onClick={() => setModalImage(asset)}
                className="about-card overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform p-0"
              >
                <img src={asset.src} alt={asset.alt} className="w-full aspect-[3/4] object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        {/* Modal */}
        {modalImage && (
          <ImageModal
            src={modalImage.src}
            alt={modalImage.alt}
            onClose={() => setModalImage(null)}
          />
        )}
      </div>
    </section>
  );
}

export default function AboutPageClient() {
  return (
    <div className="about-page">
      {/* Hero */}
      <AboutHero />

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>

      {/* Narrative Chapters */}
      <section className="about-section">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="about-eyebrow">The Process</div>
          <h2 className="about-heading mb-8">From Concept to Deployment</h2>
          <div className="space-y-16">
            {chapters.map((chapter, i) => (
              <ChapterCard key={chapter.number} {...chapter} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Poster break — clean full-width image */}
      <div className="about-poster-break">
        <img
          src="/posters/aether.jpg"
          alt=""
          loading="lazy"
        />
      </div>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>

      {/* Moments — Dedicated Subsection */}
      <section className="about-section">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="about-eyebrow">Offshoot Project</div>
          <h2 className="about-heading mb-4">Moments — Community Hub</h2>
          <p className="about-body about-body-large max-w-3xl mb-8">
            Moments is a separate event-focused photo and video sharing platform, 
            being built as an offshoot of the main Odubo Studio. It's designed 
            for event attendees to collectively build the visual memory of shared 
            experiences in real-time — no accounts required.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">Status</span>
              <p className="about-body text-sm">
                Currently in beta development. Stages 1–3 (photo upload, gallery 
                viewing, sharing) are complete. Video clips and event management 
                are being built.
              </p>
            </div>
            <div className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">Target URL</span>
              <p className="about-body text-sm">
                <a href="https://moments.odubo.studio" target="_blank" rel="noopener noreferrer" className="about-link">
                  moments.odubo.studio
                </a>
                {' '}— or accessible via the /moments route on the main platform.
              </p>
            </div>
            <div className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">Tech Stack</span>
              <p className="about-body text-sm">
                Next.js 15, Cloudflare D1 (database), Cloudflare R2 (storage), 
                Tailwind CSS 4. Same infrastructure, separate application.
              </p>
            </div>
            <div className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">Documentation</span>
              <p className="about-body text-sm">
                <a href="/docs/moments-architecture" className="about-link">Architecture spec</a>
                {' '}and{' '}
                <a href="/docs/moments-roadmap" className="about-link">product roadmap</a>
                {' '}are available in the public docs.
              </p>
            </div>
          </div>

          <a
            href="/moments"
            target="_blank"
            rel="noopener noreferrer"
            className="about-btn about-btn-primary text-sm"
          >
            Visit Moments
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>

      {/* ── 3D & Game Design Section ── */}
      <section className="about-section">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="about-eyebrow">Experimental</div>
          <h2 className="about-heading mb-4">3D Modeling & Game Design</h2>
          <p className="about-body about-body-large max-w-3xl mb-8">
            Alongside the main platform, I've been teaching myself 3D modeling 
            to explore what's possible with browser-based 3D. What started as 
            an idea for a runner-style game turned into a hands-on experiment 
            in Blender — building characters, environments, and learning the 
            fundamentals of rigging and animation.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">The Concept</span>
              <p className="about-body text-sm">
                A runner-style game where players control stylized avatars through 
                a city environment. Still a work in progress — this was my first 
                real attempt at creating 3D game assets from scratch.
              </p>
            </div>
            <div className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">Characters</span>
              <p className="about-body text-sm">
                Two playable avatar concepts (male + female) designed as game-ready 
                characters. Built in Blender with AI-assisted generation, then 
                refined manually for web delivery via Three.js.
              </p>
            </div>
            <div className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">Environment</span>
              <p className="about-body text-sm">
                A stylized city scene with 1,289 meshes and 69 materials — the 
                game world where the runner concept would take place. Compressed 
                for web with Draco to keep load times reasonable.
              </p>
            </div>
            <div className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">Rigging</span>
              <p className="about-body text-sm">
                A rigged stick figure prototype with a full joint hierarchy — 
                built to understand skeleton structures before applying them to 
                the main characters. Ready for animation.
              </p>
            </div>
          </div>

          <a
            href="/showcase"
            className="about-btn about-btn-primary text-sm"
          >
            Explore 3D Models
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>

      {/* ── Brand Assets Gallery ── */}
      <BrandAssetsSection />

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>

      {/* Skills Grid */}
      <SkillsGrid />

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>

      {/* Live Preview */}
      <LivePreview />

      {/* Footer */}
      <AboutFooter />
    </div>
  );
}
