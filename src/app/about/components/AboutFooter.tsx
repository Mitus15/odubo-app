'use client';

import { useEffect, useRef } from 'react';

export default function AboutFooter() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <footer className="about-section-sm border-t border-[#e5ddd6]">
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div
          ref={ref}
          className="about-stagger-item"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a] font-['Baskerville'] mb-1">
                Built by Mani Odubo
              </p>
              <p className="about-body text-xs max-w-md">
                This project was designed, developed, and deployed as a solo effort — 
                spanning product strategy, creative direction, engineering, and operations. 
                Built through iterative collaboration with AI tools (Claude Code, Gemini, 
                MCP servers) and refined by hand.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href="/showcase"
                target="_blank"
                rel="noopener noreferrer"
                className="about-btn about-btn-ghost text-xs"
              >
                3D Showcase
              </a>
              <a
                href="/links"
                target="_blank"
                rel="noopener noreferrer"
                className="about-btn about-btn-ghost text-xs"
              >
                Connect
              </a>
              <a
                href="/docs"
                className="about-btn about-btn-primary text-xs"
              >
                View Documentation
              </a>
            </div>
          </div>

          {/* Tech stack badges */}
          <div className="mt-8 pt-6 border-t border-[#efe9e3]">
            <p className="about-label text-[0.625rem] mb-3">Built With</p>
            <div className="flex flex-wrap gap-2">
              {['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS 4', 'Cloudflare Pages', 'Cloudflare D1', 'Cloudflare R2', 'Cloudflare Stream', 'JWT Auth', 'Shopify', 'Three.js', 'Blender', 'Claude Code', 'Gemini', 'MCP Servers'].map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center px-2.5 py-1 bg-[#f5f0eb] text-[#5c5550] rounded-md text-[0.6875rem] font-medium border border-[#e5ddd6]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
