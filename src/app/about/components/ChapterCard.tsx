'use client';

import { useEffect, useRef } from 'react';

interface ChapterItem {
  label: string;
  text: string;
}

interface ChapterCardProps {
  number: string;
  title: string;
  subtitle: string;
  description: string;
  skills: string[];
  items: ChapterItem[];
  linkHref?: string;
  linkLabel?: string;
  index?: number;
  pullQuote?: string;
  pullQuoteAttribution?: string;
  marginalNote?: string;
}

export default function ChapterCard({
  number,
  title,
  subtitle,
  description,
  skills,
  items,
  linkHref,
  linkLabel,
  index = 0,
  pullQuote,
  pullQuoteAttribution,
  marginalNote,
}: ChapterCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className="about-stagger-item"
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div className="relative">
        {/* Chapter number — large, faded, like a magazine */}
        <div className="about-chapter-number">{number}</div>

        {/* Header */}
        <div className="mb-6 relative z-10">
          <p className="about-label mb-2">{subtitle}</p>
          <h2 className="about-heading">{title}</h2>
        </div>

        {/* Description + marginal note container */}
        <div className="relative">
          {marginalNote && (
            <div className="about-marginal">
              {marginalNote}
            </div>
          )}
          <p className="about-body about-body-large mb-6 max-w-3xl">{description}</p>
        </div>

        {/* Skills tags */}
        <div className="flex flex-wrap gap-2 mb-8">
          {skills.map((skill) => (
            <span key={skill} className="about-skill-tag">
              {skill}
            </span>
          ))}
        </div>

        {/* Detail items — alternating layout */}
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((item, i) => (
            <div key={i} className="about-card">
              <span className="about-label text-[0.625rem] block mb-2">{item.label}</span>
              <p className="about-body text-sm">{item.text}</p>
            </div>
          ))}
        </div>

        {/* Pull quote */}
        {pullQuote && (
          <div className="about-pullquote">
            {pullQuote}
            {pullQuoteAttribution && (
              <div className="about-pullquote-attribution">— {pullQuoteAttribution}</div>
            )}
          </div>
        )}

        {/* Optional link */}
        {linkHref && linkLabel && (
          <div className="mt-6">
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="about-link text-sm inline-flex items-center gap-1.5"
            >
              {linkLabel}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
