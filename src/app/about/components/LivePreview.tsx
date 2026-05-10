'use client';

import { useEffect, useRef } from 'react';

interface PreviewItem {
  title: string;
  description: string;
  href: string;
  status: 'live' | 'development' | 'paused';
}

const previews: PreviewItem[] = [
  {
    title: 'Now — Content Showcase',
    description: 'A cinematic carousel of featured videos with platform links and content stats. Serves as the primary video showcase (mobile clips feed + desktop carousel).',
    href: '/now',
    status: 'live',
  },
  {
    title: 'Music — Albums & Tracks',
    description: 'Album browsing, track streaming, and stem player (in development). The music platform is being actively built out.',
    href: '/music',
    status: 'development',
  },
  {
    title: 'Store — Fashion & Merch',
    description: 'Shopify-powered storefront integrated into the platform. The store is temporarily closed while the Shopify subscription is renewed — the integration is fully wired and functional.',
    href: '/store',
    status: 'paused',
  },
  {
    title: 'Links — Platform Presence',
    description: 'Central hub connecting to Spotify, Apple Music, YouTube, Instagram, and TikTok.',
    href: '/links',
    status: 'live',
  },
  {
    title: 'Moments — Community Hub',
    description: 'Event photo/video sharing platform (in development). Moments is being built as a separate app at moments.odubo.studio — an offshoot of the main platform.',
    href: '/moments',
    status: 'development',
  },
  {
    title: 'Social Ops — Command Center',
    description: 'A command center for social media distribution — scheduling posts, tracking deployments, and managing the content calendar.',
    href: '/social-ops',
    status: 'live',
  },
];

const statusLabels: Record<string, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-[#2d7d5a]/10 text-[#2d7d5a]' },
  development: { label: 'In Development', className: 'bg-[#a85a48]/10 text-[#a85a48]' },
  paused: { label: 'Temporarily Closed', className: 'bg-[#9c9490]/10 text-[#5c5550]' },
};

export default function LivePreview() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      },
      { threshold: 0.1 }
    );

    if (gridRef.current) {
      observer.observe(gridRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="about-section">
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div
          ref={gridRef}
          className="about-stagger-item"
        >
          <div className="about-eyebrow">Live</div>
          <h2 className="about-heading mb-3">See It in Action</h2>
          <p className="about-body about-body-large max-w-2xl mb-8">
            Every section of the platform is live and accessible. Click through to 
            explore the actual pages. Some features are still in development — 
            they're marked accordingly.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previews.map((preview) => {
              const status = statusLabels[preview.status];
              return (
                <a
                  key={preview.title}
                  href={preview.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-card group block no-underline"
                >
                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-medium ${status.className}`}>
                      {status.label}
                    </span>
                    <svg className="w-4 h-4 text-[#9c9490] group-hover:text-[#843c2d] transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>

                  <h3 className="font-semibold text-[#1a1a1a] text-sm mb-1 font-['Baskerville'] group-hover:text-[#843c2d] transition-colors duration-200">
                    {preview.title}
                  </h3>
                  <p className="about-body text-xs">{preview.description}</p>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
