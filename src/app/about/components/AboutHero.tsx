'use client';

import { useEffect, useRef } from 'react';

export default function AboutHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-8');
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="pt-20 sm:pt-28 pb-8 sm:pb-12">
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div
          ref={containerRef}
          className="opacity-0 translate-y-8 transition-all duration-700 ease-out"
        >
          {/* Eyebrow */}
          <div className="about-eyebrow">Case Study</div>

          {/* Main headline — magazine-style */}
          <h1 className="about-display mb-4 leading-[1.0]">
            Odubo Studio
          </h1>
          <p className="about-subheading max-w-3xl mb-8 text-[#5c5550]">
            A multimedia platform — music, video, fashion, and community — 
            built from concept to deployment as a single, unified experience.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-8 sm:gap-12 mb-10">
            <div>
              <div className="about-stat">Full-Stack</div>
              <div className="about-stat-label">Next.js 15 + Cloudflare</div>
            </div>
            <div>
              <div className="about-stat">End-to-End</div>
              <div className="about-stat-label">Concept to Deployment</div>
            </div>
            <div>
              <div className="about-stat">Multi-Format</div>
              <div className="about-stat-label">Music, Video, Commerce</div>
            </div>
          </div>

          {/* Manifesto-style intro */}
          <div className="about-body about-body-large max-w-3xl">
            <p className="mb-4">
              I don't know how to code. At least, not in the traditional sense. 
              What I know how to do is <strong className="text-[#1a1a1a]">build</strong> — by iterating across AI tools, 
              CLI terminals, browser consoles, and design software until something 
              works. This project is the result of that process: a full-stack 
              multimedia platform built through a workflow that blends AI generation 
              (Claude Code, Gemini, MCP servers) with manual craftsmanship in 
              Blender, Three.js, and the terminal.
            </p>
            <p className="mb-4">
              Odubo Studio combines music streaming, video clips, e-commerce, 
              event management, and community engagement into one cohesive brand 
              experience. It demonstrates the full range of skills involved in 
              taking a creative vision from whiteboard to production — product 
              strategy, system architecture, design direction, project management, 
              and ongoing operations.
            </p>
            <p>
              This page breaks down how each phase of the project maps to the 
              disciplines that go into building something like this.
            </p>
          </div>

          {/* Scroll indicator */}
          <div className="mt-12 flex items-center gap-2 text-[0.625rem] uppercase tracking-[0.2em] text-[#9c9490]">
            <span>Scroll to explore</span>
            <svg className="w-3.5 h-3.5 animate-bounce" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
