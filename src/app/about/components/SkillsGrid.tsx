'use client';

import { useEffect, useRef } from 'react';

const disciplines = [
  {
    title: 'Product Development',
    description: 'From vision documents to feature roadmaps — defining what to build and why, then executing against a plan. This project started as a strategic charter and evolved through iterative cycles of planning, building, testing, and refining.',
    tags: ['Strategy', 'Roadmapping', 'Feature Prioritization', 'Business Modeling'],
  },
  {
    title: 'Project Management',
    description: 'Managing a solo-built platform means wearing every hat: sprint planning, deployment checklists, cross-functional coordination across engineering, design, content, and operations — all without a team to delegate to.',
    tags: ['Agile/Scrum', 'Sprint Planning', 'Risk Management', 'Deployment Ops'],
  },
  {
    title: 'Creative Direction',
    description: 'Brand identity, design systems, visual assets, and UI/UX — maintaining a cohesive aesthetic across every touchpoint. From the terracotta color palette to the glass-morphism UI, every visual decision reinforces the brand.',
    tags: ['Brand Identity', 'Design Systems', 'UI/UX', 'Visual Assets'],
  },
  {
    title: 'Marketing & Growth',
    description: 'Content strategy, social media operations, platform presence, and analytics-driven iteration. Building the platform is half the work — the other half is making sure people know it exists.',
    tags: ['Content Strategy', 'Social Ops', 'Analytics', 'Platform Presence'],
  },
  {
    title: 'Technical Leadership',
    description: 'Architecture decisions, system design, technology selection, and owning the full stack from database to deployment. Even without a traditional coding background, the technical vision drives every implementation choice.',
    tags: ['System Design', 'Full-Stack', 'DevOps', 'Architecture'],
  },
];

export default function SkillsGrid() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="about-section">
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div
          ref={sectionRef}
          className="about-stagger-item"
        >
          <div className="about-eyebrow">What This Demonstrates</div>
          <h2 className="about-heading mb-4">Disciplines in Practice</h2>
          <p className="about-body about-body-large max-w-3xl mb-10">
            This project isn't just a portfolio piece — it's a working platform 
            that exercises the full range of skills relevant to product development, 
            project management, creative direction, and marketing. Each discipline 
            below was essential to getting it from concept to deployment.
          </p>

          <div className="grid gap-6">
            {disciplines.map((d, i) => (
              <div key={d.title} className="about-card">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#843c2d]/10 flex items-center justify-center">
                      <span className="font-['Baskerville'] text-[#843c2d] font-bold text-sm">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#1a1a1a] text-lg mb-2 font-['Baskerville']">
                      {d.title}
                    </h3>
                    <p className="about-body text-sm mb-3">{d.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {d.tags.map((tag) => (
                        <span key={tag} className="about-skill-tag text-[0.6875rem]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
