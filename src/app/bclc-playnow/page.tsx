'use client';

import { useEffect, useRef, useState } from 'react';
import '@/app/about/about.css';
import './bclc.css';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface ArtifactEntry {
  name: string;
  path: string;
  type: 'docx' | 'xlsx' | 'pdf' | 'pptx' | 'jpg';
  sprint: number;
}

/* ─── Data ──────────────────────────────────────────────────────────────── */

const PROJECT_SPECS = {
  client: 'British Columbia Lottery Corporation (BCLC)',
  platform: 'PlayNow.com Sportsbook',
  duration: '4 weeks (March 10 – March 28, 2025)',
  sprints: 3,
  team: '12–16 consultants (aggregate of 3–4 person sub-teams)',
  institution: 'Thompson Rivers University — BUSN 6070: Project Management & Consulting Methods',
  sponsor: 'Aaron (BCLC Product Team)',
  methodology: 'Formal Scrum / Agile Framework',
  tools: ['Jira/Scrum Logs', 'Google Sheets', 'Microsoft Word', 'PowerPoint', 'Competitive Analysis Frameworks'],
};

const ROLE_ROTATION = [
  { sprint: 1, role: 'Product Owner', focus: 'Product Backlog creation, stakeholder alignment, sprint goal definition' },
  { sprint: 2, role: 'Product Owner', focus: 'Backlog refinement, competitive analysis oversight, PSP delivery' },
  { sprint: 3, role: 'Scrum Master', focus: 'Retrospective facilitation, impediment removal, final roadmap consolidation' },
];

const SPRINT_DETAILS = [
  {
    sprint: 1,
    dates: 'Mar 10–14',
    goal: 'Establish a holistic understanding of BCLC/PlayNow\'s positioning, market landscape, and competitors.',
    deliverables: [
      'Team Agreement Canvas',
      'Initial Product Backlog',
      'Sprint Backlog',
      'Footprint & Competitive Analysis (draft)',
      'Sprint Review & Retrospective',
    ],
    keyFindings: [
      'Identified Bet365 and DraftKings as primary competitors',
      'Gap: only 2 of 5 target competitors analyzed in Sprint 1',
      'Gap: minimal quantitative market share data',
    ],
    color: '#843c2d',
  },
  {
    sprint: 2,
    dates: 'Mar 17–21',
    goal: 'Deep-dive competitive analysis and consolidated footprint assessment with quantitative backing.',
    deliverables: [
      'Updated Product Backlog',
      'Competitive Analysis Consolidated (PSP)',
      'Comparative Analysis — Top 8 Competitors',
      'Footprint & Competitive Analysis (final draft)',
      'Sprint Review & Retrospective',
    ],
    keyFindings: [
      'Expanded analysis to 8 competitors including Bodog, SportsInteraction, FanDuel',
      'Quantified feature gaps: live streaming, micro-betting, UX parity',
      'Identified 21–40 demographic as critical growth segment',
    ],
    color: '#2d7d5a',
  },
  {
    sprint: 3,
    dates: 'Mar 24–28',
    goal: 'Synthesize findings into a strategic roadmap with actionable product and marketing recommendations.',
    deliverables: [
      'Final Product Backlog',
      'Strategic Marketing Plan',
      'Implementation Plan',
      'Consolidated 40+ Page Strategic Roadmap',
      'Final Sprint Review & Retrospective',
    ],
    keyFindings: [
      'Recommended "Coach Brian" localized brand strategy',
      'Proposed Responsible Gaming 2.0 with gamified "Responsibility Streaks"',
      '12-month implementation roadmap with phased priorities',
    ],
    color: '#5a4a7a',
  },
];

const metrics = [
  { value: '135%', label: 'Digital Footprint Growth Surge', note: 'Organic search impressions, Q2–Q3 2024' },
  { value: '19.07%', label: 'Month-over-Month Visit Decline', note: 'During analysis period; seasonal variance not isolated' },
  { value: '75%', label: 'Mobile User Engagement', note: 'Share of total traffic; industry benchmark: 68–72%' },
  { value: '25%', label: 'Bounce Rate Due to Interface Friction', note: 'vs. 15% industry avg. for regulated sportsbooks' },
];

const personas = [
  {
    name: 'The Recreational Bettor',
    type: 'Casual Gambler',
    motivation: 'Entertainment and relaxation — bets occasionally on major sports events or lottery games',
    painPoints: ['Limited betting options', 'Poor app experience', 'Lack of excitement'],
    demographics: '25–40, varied income, mobile-first user',
    strategy: 'Simplify onboarding, introduce low-stakes micro-betting, gamified engagement',
    color: '#843c2d',
    icon: '🎯',
  },
  {
    name: 'The High-Volume Bettor',
    type: 'Serious Bettor',
    motivation: 'Winning and maximizing value — regularly places high-volume bets, seeks best odds and market variety',
    painPoints: ['Lower odds vs. competitors', 'Lack of real-time options', 'No cash-out feature'],
    demographics: '30–55, higher disposable income, desktop power user',
    strategy: 'Competitive odds pricing, live in-play betting, cash-out functionality',
    color: '#2d7d5a',
    icon: '📊',
  },
  {
    name: 'The Tech-Savvy Bettor',
    type: 'Esports & Niche Sports',
    motivation: 'Competitive engagement with specific sports/games — focused on esports and niche markets',
    painPoints: ['No esports coverage', 'No in-play betting for niche markets'],
    demographics: '18–30, digitally native, mobile & desktop cross-user',
    strategy: 'Add esports markets, niche league coverage, streaming integration',
    color: '#5a4a7a',
    icon: '🎮',
  },
  {
    name: 'The Long-Term Player',
    type: 'Loyalty-Driven',
    motivation: 'Rewards and benefits — sticks with one platform due to familiarity and loyalty perks',
    painPoints: ['No loyalty program', 'Weak engagement incentives'],
    demographics: '45–65, brand-loyal, lower churn risk',
    strategy: 'Tiered loyalty rewards, Responsible Gaming 2.0 streaks, VIP treatment',
    color: '#b8860b',
    icon: '🏆',
  },
  {
    name: 'The Purpose-Driven Player',
    type: 'Socially Conscious',
    motivation: 'Wants to gamble responsibly and support community causes — values ethics over flashy bonuses',
    painPoints: ['Aggressive marketing from competitors feels exploitative', 'Wants transparency in responsible gaming tools'],
    demographics: '25–45, socially aware, values-aligned consumer',
    strategy: 'Responsible Gaming 2.0 framework, community reinvestment messaging, Coach Brian trust-building',
    color: '#1a6b5a',
    icon: '♻️',
  },
];

const lifecyclePhases = [
  { phase: 'Phase 1', title: 'Market Expansion & Brand Awareness', timeline: 'Months 1–3', focus: 'Target Recreational & Tech-Savvy personas through Coach Brian campaign, social media, and community partnerships' },
  { phase: 'Phase 2', title: 'Product Enhancement & UX Optimization', timeline: 'Months 2–4', focus: 'Mobile-first redesign, streamlined onboarding, personalized dashboards for High-Volume bettors' },
  { phase: 'Phase 3', title: 'Live Betting & Streaming Integration', timeline: 'Months 3–6', focus: 'In-play betting engine, live streaming partnerships, real-time odds updates' },
  { phase: 'Phase 4', title: 'Loyalty & Responsible Gaming 2.0', timeline: 'Months 4–8', focus: 'Tiered loyalty program, Responsibility Streaks gamification, limit-setting tools for Long-Term & Purpose-Driven personas' },
  { phase: 'Phase 5', title: 'Esports & Niche Market Expansion', timeline: 'Months 6–9', focus: 'Esports betting markets, niche league coverage, streaming integration for Tech-Savvy persona' },
  { phase: 'Phase 6', title: 'Personalization & AI Recommendations', timeline: 'Months 8–11', focus: 'AI-driven bet recommendations, personalized promotions, behavior-based UX tailoring' },
  { phase: 'Phase 7', title: 'Continuous Optimization & Community Building', timeline: 'Months 10–12+', focus: 'A/B testing culture, community forums, Coach Brian ambassador program, iterative feature rollout' },
];

const roadmapPillars = [
  {
    title: 'Product Development',
    items: [
      'Integration of live-streaming capabilities',
      'Micro-betting markets (in-game wagers)',
      'AI-driven personalized bet recommendations',
    ],
    accent: '#843c2d',
  },
  {
    title: 'Marketing Strategy',
    items: [
      'Localized brand personification strategy',
      '"Coach Brian" — building trust and cultural resonance',
      'Deep connection within the BC sports community',
    ],
    accent: '#2d7d5a',
  },
  {
    title: 'Responsible Gaming 2.0',
    items: [
      'Gamified loyalty system',
      '"Responsibility Streaks" — rewarding healthy habits',
      'Limit-setting tools and healthy betting patterns',
    ],
    accent: '#5a4a7a',
  },
];

const backlogItems = [
  { id: 'P1', task: 'Analyze PlayNow sportsbook footprint', dep: 'N/A' },
  { id: 'P2', task: 'Assess website traffic sources', dep: 'N/A' },
  { id: 'P3', task: 'Evaluate user behavior metrics', dep: 'N/A' },
  { id: 'P4', task: 'Analyze app performance issues', dep: 'N/A' },
  { id: 'P5', task: 'Review user engagement metrics', dep: 'N/A' },
  { id: 'C1', task: 'Identify top 5 competitors', dep: 'N/A' },
  { id: 'C2', task: 'Analyze BC market share', dep: 'C1' },
  { id: 'C3', task: 'Compare PlayNow vs competitors', dep: 'C1' },
  { id: 'C4', task: 'Benchmark competitor best practices', dep: 'C2' },
  { id: 'C5', task: 'Review competitor loyalty programs', dep: 'C4' },
  { id: 'M1', task: 'Research sportsbook marketing trends', dep: 'N/A' },
  { id: 'M2', task: 'Audit PlayNow marketing channels', dep: 'N/A' },
  { id: 'M3', task: 'Develop marketing strategy', dep: 'M1, M2' },
  { id: 'M4', task: 'Propose innovative product offerings', dep: 'C3' },
  { id: 'M5', task: 'Create implementation roadmap', dep: 'M3, M4' },
  { id: 'PX1', task: 'Design new product features', dep: 'M4' },
  { id: 'PX2', task: 'Develop prototype concepts', dep: 'PX1' },
  { id: 'PX3', task: 'Create user journey maps', dep: 'P3' },
  { id: 'PX4', task: 'Define success metrics', dep: 'P5' },
  { id: 'PX5', task: 'Plan phased rollout', dep: 'M5, PX2' },
];

const sprintRetrospectives = [
  {
    sprint: 1,
    wentWell: [
      'Gathered broad overview of PlayNow\'s positioning',
      'Generated three comprehensive documents (footprint, competitor analysis, market strategies)',
      'Diverse research contributions from all team members',
      'Identified research gaps for future sprints',
    ],
    gaps: [
      'No defined Product Backlog at the start (reversed Agile workflow)',
      'Only 2 competitors analyzed (Bet365 & DraftKings) instead of 5',
      'Minimal quantitative analysis — no market share or comparative feature data',
      'Findings split across 3 separate documents — lacked consolidation',
    ],
    improvements: [
      'Define Product Backlog before Sprint 2',
      'Expand competitor analysis to 5+ competitors',
      'Include quantitative data and feature comparison tables',
      'Consolidate findings into a single PSP document',
    ],
  },
  {
    sprint: 2,
    wentWell: [
      'Expanded competitive analysis to 8 competitors',
      'Consolidated findings into a single PSP document',
      'Improved quantitative backing with feature comparison tables',
      'Better Scrum workflow — Product Backlog defined upfront',
    ],
    gaps: [
      'Still lacked depth in some competitor profiles',
      'Marketing strategy section needed more differentiation',
      'Limited primary research — relied heavily on secondary sources',
    ],
    improvements: [
      'Deep-dive into top 3 competitor UX and feature sets',
      'Develop differentiated marketing positioning',
      'Incorporate user persona development',
    ],
  },
  {
    sprint: 3,
    wentWell: [
      'Successfully synthesized all findings into a cohesive strategic roadmap',
      'Developed innovative concepts: "Coach Brian" brand, Responsible Gaming 2.0',
      'Created 12-month phased implementation plan',
      'Strong final presentation with clear recommendations',
    ],
    gaps: [
      'Time constraints limited depth of implementation costing',
      'Some recommendations needed more validation data',
    ],
    improvements: [
      'Include cost-benefit analysis for each recommendation',
      'Add risk assessment for implementation phases',
    ],
  },
];

const competitorHighlights = [
  { name: 'Sports Interaction', type: 'Grey Market', bonus: '$500 Match Bonus', keyFeature: 'Longest-standing Canadian brand' },
  { name: 'bet365', type: 'Grey Market', bonus: '$365 Bonus', keyFeature: 'Best live streaming & in-play betting' },
  { name: 'BET99', type: 'Grey Market', bonus: '$1,500 First Bet Encore', keyFeature: 'Highest welcome bonus in market' },
  { name: 'Pinnacle', type: 'Grey Market', bonus: 'Low margin pricing', keyFeature: 'Sharp odds, professional bettors' },
  { name: '888sport', type: 'Grey Market', bonus: '$500 Deposit Match', keyFeature: 'Strong UI/UX, global brand' },
  { name: 'DraftKings', type: 'US Regulated', bonus: '$1,000 Deposit Match', keyFeature: 'DFS integration, daily promotions' },
  { name: 'Betway', type: 'Grey Market', bonus: '$500 Match Bonus', keyFeature: 'Esports specialization' },
  { name: 'PlayNow', type: 'BC Regulated', bonus: '$100 Bet-Back Bonus', keyFeature: 'Only legal option in BC' },
];

/* ─── Stagger Animation Hook ────────────────────────────────────────────── */

function useStaggerAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const items = el.querySelectorAll('.bclc-stagger');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('bclc-stagger-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ─── Section Components ────────────────────────────────────────────────── */

function HeroSection() {
  const ref = useStaggerAnimation();

  return (
    <section className="bclc-hero" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#9c9490] mb-8">
          <span className="text-[0.625rem] font-semibold tracking-[0.2em] uppercase text-[#843c2d]">
            Live Consulting Engagement
          </span>
          <span className="text-[#d9d0c8]">/</span>
          <span className="text-[0.625rem] font-semibold tracking-[0.2em] uppercase text-[#9c9490]">
            BCLC
          </span>
        </div>

        {/* Framework badge */}
        <div className="bclc-badge bclc-stagger">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          Scrum / Agile Methodology
        </div>

        <h1 className="about-display mb-4 bclc-stagger">
          Agile Product Strategy:<br />
          <span className="text-[#843c2d]">Revitalizing BC&rsquo;s Regulated Sportsbook</span>
        </h1>

        <p className="about-body about-body-large max-w-3xl mb-6 bclc-stagger">
          A live consulting engagement for the British Columbia Lottery Corporation (BCLC) 
          to assess PlayNow.com&rsquo;s digital footprint and develop innovative, forward-thinking 
          product offerings to capture market share from aggressive, unregulated offshore competitors.
        </p>

        <div className="flex flex-wrap gap-3 bclc-stagger">
          <span className="about-skill-tag">Product Strategy</span>
          <span className="about-skill-tag">Scrum / Agile</span>
          <span className="about-skill-tag">Competitive Analysis</span>
          <span className="about-skill-tag">Market Research</span>
          <span className="about-skill-tag">Digital Transformation</span>
        </div>
      </div>
    </section>
  );
}

function ProjectSpecsSection() {
  const ref = useStaggerAnimation();

  return (
    <section className="about-section bclc-section-first" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow bclc-stagger">Engagement Overview</div>
        <h2 className="about-heading mb-6 bclc-stagger">Project Specs</h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="about-card bclc-stagger">
            <span className="about-label text-[0.625rem] block mb-1">Client</span>
            <p className="about-body text-sm font-medium">{PROJECT_SPECS.client}</p>
          </div>
          <div className="about-card bclc-stagger">
            <span className="about-label text-[0.625rem] block mb-1">Platform</span>
            <p className="about-body text-sm font-medium">{PROJECT_SPECS.platform}</p>
          </div>
          <div className="about-card bclc-stagger">
            <span className="about-label text-[0.625rem] block mb-1">Duration</span>
            <p className="about-body text-sm font-medium">{PROJECT_SPECS.duration}</p>
          </div>
          <div className="about-card bclc-stagger">
            <span className="about-label text-[0.625rem] block mb-1">Team</span>
            <p className="about-body text-sm font-medium">{PROJECT_SPECS.team}</p>
          </div>
          <div className="about-card bclc-stagger sm:col-span-2">
            <span className="about-label text-[0.625rem] block mb-1">Context</span>
            <p className="about-body text-sm">{PROJECT_SPECS.institution}</p>
          </div>
        </div>

        {/* Tools */}
        <div className="about-card bclc-stagger">
          <span className="about-label text-[0.625rem] block mb-2">Tools & Frameworks</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_SPECS.tools.map((tool) => (
              <span key={tool} className="about-skill-tag">{tool}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleRotationSection() {
  const ref = useStaggerAnimation();

  return (
    <section className="about-section" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow bclc-stagger">Scrum Roles</div>
        <h2 className="about-heading mb-6 bclc-stagger">Role Rotation Across Sprints</h2>
        <p className="about-body about-body-large max-w-3xl mb-8 bclc-stagger">
          Scrum roles rotated each sprint to distribute leadership experience. I served as 
          <strong> Product Owner for Sprints 1 and 2</strong>, owning the Product Backlog and 
          stakeholder alignment, and as <strong>Scrum Master for Sprint 3</strong>, facilitating 
          retrospectives and removing impediments during final roadmap consolidation.
        </p>

        <div className="space-y-3">
          {ROLE_ROTATION.map((item) => (
            <div key={item.sprint} className="about-card bclc-stagger flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-full bg-[#843c2d]/10 flex items-center justify-center text-sm font-bold text-[#843c2d]">
                S{item.sprint}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-sm text-[#1a1a1a]">{item.role}</span>
                  <span className="text-[0.625rem] text-[#9c9490]">Sprint {item.sprint}</span>
                </div>
                <p className="about-body text-xs">{item.focus}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SprintTimelineSection() {
  const ref = useStaggerAnimation();
  const [activeSprint, setActiveSprint] = useState<number | null>(null);

  return (
    <section className="about-section" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow bclc-stagger">Execution</div>
        <h2 className="about-heading mb-2 bclc-stagger">Sprint Timeline</h2>
        <p className="about-body about-body-large max-w-3xl mb-8 bclc-stagger">
          Three one-week sprints executed over March 2025, each producing a Potentially Shippable Product (PSP).
        </p>

        {/* Sprint selector tabs */}
        <div className="flex gap-2 mb-6 bclc-stagger">
          {SPRINT_DETAILS.map((s) => (
            <button
              key={s.sprint}
              onClick={() => setActiveSprint(activeSprint === s.sprint ? null : s.sprint)}
              className={`flex-1 px-4 py-3 rounded-xl text-left transition-all duration-200 border ${
                activeSprint === s.sprint
                  ? 'border-[#843c2d]/30 bg-[#843c2d]/5 shadow-sm'
                  : 'border-[#e5ddd6] bg-white hover:border-[#d9d0c8]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-[#5c5550]">
                  Sprint {s.sprint}
                </span>
              </div>
              <span className="text-[0.625rem] text-[#9c9490]">{s.dates}</span>
            </button>
          ))}
        </div>

        {/* Active sprint detail */}
        {activeSprint && (
          <div className="about-card about-card-accent bclc-stagger mb-6">
            {(() => {
              const s = SPRINT_DETAILS.find((d) => d.sprint === activeSprint)!;
              return (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-[0.625rem] font-semibold tracking-[0.1em] uppercase" style={{ color: s.color }}>
                      Sprint {s.sprint} — {s.dates}
                    </span>
                  </div>
                  <p className="about-body text-sm font-medium mb-4">{s.goal}</p>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="about-label text-[0.625rem] block mb-2">Deliverables</span>
                      <ul className="space-y-1">
                        {s.deliverables.map((d) => (
                          <li key={d} className="flex items-start gap-2 text-xs text-[#5c5550]">
                            <svg className="w-3 h-3 mt-0.5 shrink-0 text-[#2d7d5a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="about-label text-[0.625rem] block mb-2">Key Findings</span>
                      <ul className="space-y-1">
                        {s.keyFindings.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs text-[#5c5550]">
                            <svg className="w-3 h-3 mt-0.5 shrink-0 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Sprint summary cards (always visible) */}
        <div className="grid sm:grid-cols-3 gap-4">
          {SPRINT_DETAILS.map((s, i) => (
            <div
              key={s.sprint}
              className={`about-card bclc-stagger transition-all duration-300 ${
                activeSprint === s.sprint ? 'ring-2 ring-[#843c2d]/20' : ''
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="w-10 h-1 rounded-full mb-4" style={{ background: s.color }} />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-[#5c5550]">
                  Sprint {s.sprint}
                </span>
                <span className="text-[0.625rem] text-[#9c9490]">{s.dates}</span>
              </div>
              <p className="about-body text-xs leading-relaxed">{s.goal}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InsightsSection() {
  const ref = useStaggerAnimation();

  return (
    <section className="about-section" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow bclc-stagger">Strategic Insights</div>
        <h2 className="about-heading mb-8 bclc-stagger">Footprint Analysis</h2>

        {/* Metrics Grid with footnotes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {metrics.map((metric, i) => (
            <div key={metric.label} className="about-card bclc-stagger text-center relative group" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="about-stat mb-1">{metric.value}</div>
              <div className="about-stat-label">{metric.label}</div>
              <div className="absolute bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-[0.5rem] text-[#9c9490] cursor-help border-b border-dotted border-[#d9d0c8]">
                  {metric.note}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* User Behavior + Demographic Gap */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="about-card bclc-stagger">
            <span className="about-label text-[0.625rem] block mb-2">User Behavior</span>
            <p className="about-body text-sm">
              Discovered that <strong>75% of users engage via mobile</strong>, yet the platform 
              suffered from a 25% bounce rate due to interface friction — a critical UX gap 
              that was driving users directly into the arms of offshore competitors.
            </p>
          </div>
          <div className="about-card bclc-stagger">
            <span className="about-label text-[0.625rem] block mb-2">The Demographic Gap</span>
            <p className="about-body text-sm">
              Targeted a critical pivot toward the <strong>21–40 age demographic</strong>, moving 
              away from the platform&rsquo;s traditional reliance on bettors aged 55+. This 
              demographic shift was essential for long-term market relevance.
            </p>
          </div>
        </div>

        {/* Competitive Analysis Summary */}
        <div className="about-card bclc-stagger mb-6">
          <span className="about-label text-[0.625rem] block mb-2">Competitive Landscape</span>
          <p className="about-body text-sm mb-3">
            Analyzed <strong>8 offshore competitors</strong> including Bet365, DraftKings, 
            FanDuel, Bodog, and SportsInteraction. Key differentiators identified:
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: 'Live Streaming', detail: 'Present in 6/8 competitors; absent from PlayNow' },
              { label: 'Micro-Betting', detail: 'Offered by 4/8 competitors; emerging standard' },
              { label: 'UX Parity', detail: 'PlayNow lagged in mobile UX, onboarding, and personalization' },
            ].map((item) => (
              <div key={item.label} className="bg-[#f8f5f2] rounded-lg p-3">
                <span className="text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-[#843c2d] block mb-1">
                  {item.label}
                </span>
                <span className="text-xs text-[#5c5550]">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pull quote */}
        <div className="about-pullquote bclc-stagger">
          &ldquo;The platform wasn&rsquo;t just losing to competitors — it was losing to friction. 
          Every bounce was a user choosing an unregulated alternative.&rdquo;
        </div>
      </div>
    </section>
  );
}

function PersonasSection() {
  const ref = useStaggerAnimation();
  const [activePersona, setActivePersona] = useState<number | null>(null);

  return (
    <section className="about-section" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow bclc-stagger">User Research</div>
        <h2 className="about-heading mb-2 bclc-stagger">Player Personas & Lifecycle Mapping</h2>
        <p className="about-body about-body-large max-w-3xl mb-8 bclc-stagger">
          Developed <strong>5 distinct player personas</strong> based on behavioral segmentation and 
          mapped them against a <strong>7-phase customer lifecycle</strong> — enabling targeted 
          product and marketing strategies for each user segment.
        </p>

        {/* Persona Cards */}
        <div className="grid sm:grid-cols-5 gap-3 mb-8">
          {personas.map((p, i) => (
            <button
              key={p.name}
              onClick={() => setActivePersona(activePersona === i ? null : i)}
              className={`about-card bclc-stagger text-left w-full transition-all duration-200 ${
                activePersona === i ? 'ring-2 shadow-md' : 'hover:shadow-sm'
              }`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="text-xl mb-2">{p.icon}</div>
              <span className="text-[0.5rem] font-semibold tracking-[0.1em] uppercase block mb-0.5" style={{ color: p.color }}>
                {p.type}
              </span>
              <span className="text-xs font-medium text-[#1a1a1a] block leading-snug">{p.name}</span>
              <span className="text-[0.5rem] text-[#9c9490] block mt-1">{p.demographics}</span>
            </button>
          ))}
        </div>

        {/* Active Persona Detail */}
        {activePersona !== null && (
          <div className="about-card about-card-accent bclc-stagger mb-8">
            {(() => {
              const p = personas[activePersona];
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{p.icon}</div>
                    <div>
                      <span className="text-[0.5rem] font-semibold tracking-[0.1em] uppercase block" style={{ color: p.color }}>
                        {p.type}
                      </span>
                      <h3 className="font-['Baskerville'] text-lg font-semibold text-[#1a1a1a]">{p.name}</h3>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <span className="about-label text-[0.5rem] block mb-1">Motivation</span>
                      <p className="text-xs text-[#5c5550]">{p.motivation}</p>
                    </div>
                    <div>
                      <span className="about-label text-[0.5rem] block mb-1">Demographics</span>
                      <p className="text-xs text-[#5c5550]">{p.demographics}</p>
                    </div>
                  </div>

                  <div>
                    <span className="about-label text-[0.5rem] block mb-1">Pain Points</span>
                    <div className="flex flex-wrap gap-1.5">
                      {p.painPoints.map((pt) => (
                        <span key={pt} className="text-[0.5rem] bg-[#f8f5f2] text-[#5c5550] px-2 py-1 rounded-full">
                          {pt}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="about-label text-[0.5rem] block mb-1">Recommended Strategy</span>
                    <p className="text-xs text-[#5c5550]">{p.strategy}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Lifecycle Timeline */}
        <div className="about-card bclc-stagger">
          <span className="about-label text-[0.625rem] block mb-4">7-Phase Customer Lifecycle</span>
          <div className="space-y-3">
            {lifecyclePhases.map((phase, i) => (
              <div key={phase.phase} className="flex items-start gap-3">
                <div className="shrink-0 flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.5rem] font-bold text-white ${
                    i < 2 ? 'bg-[#843c2d]' : i < 4 ? 'bg-[#2d7d5a]' : i < 6 ? 'bg-[#5a4a7a]' : 'bg-[#b8860b]'
                  }`}>
                    {i + 1}
                  </div>
                  {i < lifecyclePhases.length - 1 && (
                    <div className="w-px h-full min-h-[1.5rem] bg-[#e5ddd6]" />
                  )}
                </div>
                <div className="pb-3 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[0.625rem] font-semibold text-[#1a1a1a]">{phase.title}</span>
                    <span className="text-[0.5rem] text-[#9c9490]">{phase.timeline}</span>
                  </div>
                  <p className="text-[0.625rem] text-[#5c5550] leading-relaxed">{phase.focus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoadmapSection() {
  const ref = useStaggerAnimation();

  return (
    <section className="about-section" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow bclc-stagger">The Innovation Roadmap</div>
        <h2 className="about-heading mb-2 bclc-stagger">12-Month Implementation Plan</h2>
        <p className="about-body about-body-large max-w-3xl mb-8 bclc-stagger">
          Proposed a 12-month implementation plan to transform PlayNow.com from a 
          government-run utility into a <strong>dynamic entertainment brand</strong>.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          {roadmapPillars.map((pillar, i) => (
            <div
              key={pillar.title}
              className="about-card bclc-stagger"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="w-10 h-1 rounded-full mb-4" style={{ background: pillar.accent }} />
              <h3 className="font-['Baskerville'] text-lg font-semibold text-[#1a1a1a] mb-3">
                {pillar.title}
              </h3>
              <ul className="space-y-2">
                {pillar.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#5c5550]">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: pillar.accent }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArtifactsSection() {
  const ref = useStaggerAnimation();
  const [activeModal, setActiveModal] = useState<string | null>(null);

  return (
    <section className="about-section" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow bclc-stagger">Deliverables</div>
        <h2 className="about-heading mb-2 bclc-stagger">Sprint Artifacts</h2>
        <p className="about-body about-body-large max-w-3xl mb-8 bclc-stagger">
          Each sprint produced Potentially Shippable Products (PSPs) — real consulting deliverables 
          that were reviewed by BCLC stakeholders. Click any artifact to view its contents.
        </p>

        {/* Artifact Cards Grid */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {/* Product Backlog */}
          <button
            onClick={() => setActiveModal('backlog')}
            className="about-card bclc-stagger text-left w-full hover:border-[#843c2d]/30 transition-colors duration-200"
          >
            <div className="aspect-[4/3] bg-[#f8f5f2] rounded-lg mb-3 flex items-center justify-center overflow-hidden">
              <div className="text-center p-4">
                <svg className="w-8 h-8 mx-auto mb-2 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-[0.5rem] text-[#843c2d] font-semibold uppercase tracking-wider">DOCX</span>
              </div>
            </div>
            <span className="text-xs font-medium text-[#1a1a1a] block leading-snug">Product Backlog</span>
            <span className="text-[0.5rem] text-[#9c9490] uppercase tracking-wider mt-1 block">Sprint 1 · 20 items</span>
          </button>

          {/* Sprint Retrospectives */}
          <button
            onClick={() => setActiveModal('retros')}
            className="about-card bclc-stagger text-left w-full hover:border-[#843c2d]/30 transition-colors duration-200"
          >
            <div className="aspect-[4/3] bg-[#f8f5f2] rounded-lg mb-3 flex items-center justify-center overflow-hidden">
              <div className="text-center p-4">
                <svg className="w-8 h-8 mx-auto mb-2 text-[#2d7d5a]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
                <span className="text-[0.5rem] text-[#2d7d5a] font-semibold uppercase tracking-wider">DOCX</span>
              </div>
            </div>
            <span className="text-xs font-medium text-[#1a1a1a] block leading-snug">Sprint Reviews & Retrospectives</span>
            <span className="text-[0.5rem] text-[#9c9490] uppercase tracking-wider mt-1 block">Sprints 1–3 · 3 documents</span>
          </button>

          {/* Competitive Analysis */}
          <button
            onClick={() => setActiveModal('competitive')}
            className="about-card bclc-stagger text-left w-full hover:border-[#843c2d]/30 transition-colors duration-200"
          >
            <div className="aspect-[4/3] bg-[#f8f5f2] rounded-lg mb-3 flex items-center justify-center overflow-hidden">
              <div className="text-center p-4">
                <svg className="w-8 h-8 mx-auto mb-2 text-[#5a4a7a]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <span className="text-[0.5rem] text-[#5a4a7a] font-semibold uppercase tracking-wider">DOCX</span>
              </div>
            </div>
            <span className="text-xs font-medium text-[#1a1a1a] block leading-snug">Competitive Analysis (PSP)</span>
            <span className="text-[0.5rem] text-[#9c9490] uppercase tracking-wider mt-1 block">Sprint 2 · 17 competitors</span>
          </button>
        </div>

        {/* Note about confidentiality */}
        <div className="about-card bclc-stagger bg-[#f8f5f2] border border-[#e5ddd6]">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 shrink-0 text-[#9c9490]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <div>
              <span className="text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-[#5c5550] block mb-1">Confidentiality Notice</span>
              <p className="text-xs text-[#9c9490] leading-relaxed">
                The full deliverables contain proprietary BCLC data and are not publicly available. 
                The summaries above demonstrate the structure, methodology, and strategic thinking 
                applied during the engagement without exposing confidential information.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Product Backlog ── */}
      {activeModal === 'backlog' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-[#efe9e3]">
              <div>
                <h3 className="font-['Baskerville'] text-lg font-semibold text-[#1a1a1a]">Product Backlog</h3>
                <span className="text-[0.625rem] text-[#9c9490]">Sprint 1 · Product Owner: Emmanuel Morris-Odubo</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-[#f8f5f2] flex items-center justify-center hover:bg-[#efe9e3] transition-colors">
                <svg className="w-4 h-4 text-[#5c5550]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-[#5c5550] mb-4">
              <strong>Project Goal:</strong> Assess BCLC&rsquo;s online Sportsbook presence and develop innovative product offerings & marketing strategies.
            </p>

            {/* Current Footprint */}
            <span className="text-[0.5rem] font-semibold tracking-[0.15em] uppercase text-[#843c2d] block mb-2">Current Footprint</span>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#efe9e3]">
                    <th className="text-left py-1.5 pr-3 font-semibold text-[#5c5550]">ID</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-[#5c5550]">Task</th>
                    <th className="text-left py-1.5 font-semibold text-[#5c5550]">Dep.</th>
                  </tr>
                </thead>
                <tbody>
                  {backlogItems.filter(i => i.id.startsWith('P')).map(item => (
                    <tr key={item.id} className="border-b border-[#f8f5f2]">
                      <td className="py-1.5 pr-3 text-[#843c2d] font-mono">{item.id}</td>
                      <td className="py-1.5 pr-3 text-[#1a1a1a]">{item.task}</td>
                      <td className="py-1.5 text-[#9c9490]">{item.dep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Competitive Analysis */}
            <span className="text-[0.5rem] font-semibold tracking-[0.15em] uppercase text-[#2d7d5a] block mb-2">Competitive Analysis</span>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#efe9e3]">
                    <th className="text-left py-1.5 pr-3 font-semibold text-[#5c5550]">ID</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-[#5c5550]">Task</th>
                    <th className="text-left py-1.5 font-semibold text-[#5c5550]">Dep.</th>
                  </tr>
                </thead>
                <tbody>
                  {backlogItems.filter(i => i.id.startsWith('C')).map(item => (
                    <tr key={item.id} className="border-b border-[#f8f5f2]">
                      <td className="py-1.5 pr-3 text-[#2d7d5a] font-mono">{item.id}</td>
                      <td className="py-1.5 pr-3 text-[#1a1a1a]">{item.task}</td>
                      <td className="py-1.5 text-[#9c9490]">{item.dep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Marketing Strategy */}
            <span className="text-[0.5rem] font-semibold tracking-[0.15em] uppercase text-[#5a4a7a] block mb-2">Marketing Strategy & Product Innovation</span>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#efe9e3]">
                    <th className="text-left py-1.5 pr-3 font-semibold text-[#5c5550]">ID</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-[#5c5550]">Task</th>
                    <th className="text-left py-1.5 font-semibold text-[#5c5550]">Dep.</th>
                  </tr>
                </thead>
                <tbody>
                  {backlogItems.filter(i => i.id.startsWith('M') || i.id.startsWith('PX')).map(item => (
                    <tr key={item.id} className="border-b border-[#f8f5f2]">
                      <td className="py-1.5 pr-3 text-[#5a4a7a] font-mono">{item.id}</td>
                      <td className="py-1.5 pr-3 text-[#1a1a1a]">{item.task}</td>
                      <td className="py-1.5 text-[#9c9490]">{item.dep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[0.5rem] text-[#9c9490] border-t border-[#efe9e3] pt-3 mt-2">
              <p>Source: <code className="text-[#843c2d] bg-[#f8f5f2] px-1 py-0.5 rounded">BCLC_Product_Backlog.docx</code> · 35 KB</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Sprint Retrospectives ── */}
      {activeModal === 'retros' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-[#efe9e3]">
              <div>
                <h3 className="font-['Baskerville'] text-lg font-semibold text-[#1a1a1a]">Sprint Reviews & Retrospectives</h3>
                <span className="text-[0.625rem] text-[#9c9490]">Sprints 1–3 · Red Triangle</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-[#f8f5f2] flex items-center justify-center hover:bg-[#efe9e3] transition-colors">
                <svg className="w-4 h-4 text-[#5c5550]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sprintRetrospectives.map((retro) => (
              <div key={retro.sprint} className="mb-6 last:mb-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${retro.sprint === 1 ? 'bg-[#843c2d]' : retro.sprint === 2 ? 'bg-[#2d7d5a]' : 'bg-[#5a4a7a]'}`} />
                  <span className="text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-[#5c5550]">Sprint {retro.sprint}</span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[0.5rem] font-semibold tracking-[0.1em] uppercase text-[#2d7d5a] block mb-1.5">Went Well</span>
                    <ul className="space-y-1">
                      {retro.wentWell.map((item) => (
                        <li key={item} className="flex items-start gap-1.5 text-[0.625rem] text-[#5c5550]">
                          <svg className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#2d7d5a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[0.5rem] font-semibold tracking-[0.1em] uppercase text-[#843c2d] block mb-1.5">Gaps</span>
                    <ul className="space-y-1">
                      {retro.gaps.map((item) => (
                        <li key={item} className="flex items-start gap-1.5 text-[0.625rem] text-[#5c5550]">
                          <svg className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[0.5rem] font-semibold tracking-[0.1em] uppercase text-[#5a4a7a] block mb-1.5">Improvements</span>
                    <ul className="space-y-1">
                      {retro.improvements.map((item) => (
                        <li key={item} className="flex items-start gap-1.5 text-[0.625rem] text-[#5c5550]">
                          <svg className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#5a4a7a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}

            <div className="text-[0.5rem] text-[#9c9490] border-t border-[#efe9e3] pt-3 mt-2">
              <p>Sources: <code className="text-[#843c2d] bg-[#f8f5f2] px-1 py-0.5 rounded">BCLC_Sprint1_Review_Retrospective.docx</code> · <code className="text-[#843c2d] bg-[#f8f5f2] px-1 py-0.5 rounded">BCLC_Sprint2_Review_Retrospective.docx</code> · <code className="text-[#843c2d] bg-[#f8f5f2] px-1 py-0.5 rounded">BCLC_Sprint3_Review_Retrospective.docx</code></p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Competitive Analysis ── */}
      {activeModal === 'competitive' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-[#efe9e3]">
              <div>
                <h3 className="font-['Baskerville'] text-lg font-semibold text-[#1a1a1a]">Competitive Analysis (PSP)</h3>
                <span className="text-[0.625rem] text-[#9c9490]">Sprint 2 · 17 competitors analyzed</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-[#f8f5f2] flex items-center justify-center hover:bg-[#efe9e3] transition-colors">
                <svg className="w-4 h-4 text-[#5c5550]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-[#5c5550] mb-4">
              <strong>Scope:</strong> 17 competitors analyzed across regulated, grey-market, and US-based operators. 
              Primary focus on the 8 most relevant to BC&rsquo;s market.
            </p>

            {/* Competitor Comparison Table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#efe9e3]">
                    <th className="text-left py-1.5 pr-2 font-semibold text-[#5c5550]">Competitor</th>
                    <th className="text-left py-1.5 pr-2 font-semibold text-[#5c5550]">Type</th>
                    <th className="text-left py-1.5 pr-2 font-semibold text-[#5c5550]">Welcome Bonus</th>
                    <th className="text-left py-1.5 font-semibold text-[#5c5550]">Key Differentiator</th>
                  </tr>
                </thead>
                <tbody>
                  {competitorHighlights.map((comp) => (
                    <tr key={comp.name} className={`border-b border-[#f8f5f2] ${comp.name === 'PlayNow' ? 'bg-[#843c2d]/5' : ''}`}>
                      <td className={`py-1.5 pr-2 font-medium ${comp.name === 'PlayNow' ? 'text-[#843c2d]' : 'text-[#1a1a1a]'}`}>
                        {comp.name}
                        {comp.name === 'PlayNow' && <span className="text-[0.4rem] ml-1 uppercase tracking-wider text-[#843c2d]">(Client)</span>}
                      </td>
                      <td className="py-1.5 pr-2 text-[#5c5550]">{comp.type}</td>
                      <td className="py-1.5 pr-2 text-[#5c5550]">{comp.bonus}</td>
                      <td className="py-1.5 text-[#5c5550]">{comp.keyFeature}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Key Findings */}
            <div className="bg-[#f8f5f2] rounded-xl p-4 mb-4">
              <span className="text-[0.5rem] font-semibold tracking-[0.1em] uppercase text-[#5a4a7a] block mb-2">Key Findings</span>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-1.5 text-[0.625rem] text-[#5c5550]">
                  <svg className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#5a4a7a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <strong>PlayNow&rsquo;s $100 Bet-Back Bonus</strong> is significantly lower than competitors (BET99 offers $1,500 First Bet Encore)
                </li>
                <li className="flex items-start gap-1.5 text-[0.625rem] text-[#5c5550]">
                  <svg className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#5a4a7a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <strong>No Android app</strong> — a critical gap vs. all major competitors
                </li>
                <li className="flex items-start gap-1.5 text-[0.625rem] text-[#5c5550]">
                  <svg className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#5a4a7a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <strong>Live streaming absent</strong> — bet365 and 6 other competitors offer it as standard
                </li>
                <li className="flex items-start gap-1.5 text-[0.625rem] text-[#5c5550]">
                  <svg className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#5a4a7a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <strong>PlayNow&rsquo;s advantage</strong>: only legal/regulated option in BC, trusted brand, responsible gaming integration
                </li>
              </ul>
            </div>

            <div className="text-[0.5rem] text-[#9c9490] border-t border-[#efe9e3] pt-3">
              <p>Source: <code className="text-[#843c2d] bg-[#f8f5f2] px-1 py-0.5 rounded">Competitive Analysis Consolidated (PSP).docx</code> · 51 KB</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function OutcomesSection() {
  const ref = useStaggerAnimation();

  return (
    <section className="about-section" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="about-eyebrow bclc-stagger">Results</div>
        <h2 className="about-heading mb-6 bclc-stagger">Engagement Outcomes</h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="about-card bclc-stagger">
            <span className="about-label text-[0.625rem] block mb-2">Delivered</span>
            <ul className="space-y-2">
              {[
                '40+ page consolidated strategic roadmap delivered to BCLC stakeholders',
                '3 Potentially Shippable Products (PSPs) across 3 sprints',
                'Competitive analysis of 8 offshore competitors with feature gap mapping',
                '12-month phased implementation plan with prioritized initiatives',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[#5c5550]">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-[#2d7d5a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="about-card bclc-stagger">
            <span className="about-label text-[0.625rem] block mb-2">Key Recommendations Adopted</span>
            <ul className="space-y-2">
              {[
                'Mobile-first UX redesign prioritized as Phase 1 initiative',
                '"Coach Brian" brand campaign concept approved for stakeholder presentation',
                'Responsible Gaming 2.0 framework integrated into product roadmap',
                'Competitive feature gap analysis used to inform product backlog priorities',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[#5c5550]">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="about-card about-card-accent bclc-stagger">
          <p className="about-body text-sm leading-relaxed">
            This engagement demonstrated the application of formal Scrum methodology to a 
            real-world consulting problem — delivering actionable strategic recommendations 
            within a compressed 4-week timeline through iterative sprint cycles, continuous 
            stakeholder alignment, and data-driven decision making.
          </p>
        </div>
      </div>
    </section>
  );
}

function NextStepsSection() {
  const ref = useStaggerAnimation();

  return (
    <section className="about-section" ref={ref}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider mb-10" />

        <div className="about-eyebrow bclc-stagger">Next Steps</div>
        <h2 className="about-heading mb-6 bclc-stagger">Phase 1 Execution</h2>

        <div className="about-card about-card-accent bclc-stagger">
          <p className="about-body leading-relaxed mb-6">
            The strategic roadmap identified clear Phase 1 priorities: begin with the 
            <strong> mobile experience overhaul</strong> to address the 25% bounce rate, 
            initiate the <strong>&ldquo;Coach Brian&rdquo; brand campaign</strong> to build 
            cultural resonance, and develop the <strong>technical infrastructure</strong> for 
            live-streaming and micro-betting integration.
          </p>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="about-skill-tag">Mobile UX Redesign</span>
            <span className="about-skill-tag">Brand Campaign</span>
            <span className="about-skill-tag">Live-Streaming</span>
            <span className="about-skill-tag">Micro-Betting</span>
            <span className="about-skill-tag">Responsible Gaming</span>
          </div>

          <div className="text-xs text-[#9c9490] border-t border-[#efe9e3] pt-4">
            <p>This case study represents a live consulting engagement executed through a formal Scrum/Agile framework. 
            All strategic recommendations are based on primary research and competitive analysis conducted during the engagement.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BclcFooter() {
  return (
    <footer className="about-section-sm border-t border-[#e5ddd6]">
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[0.625rem] font-semibold tracking-[0.2em] uppercase text-[#843c2d] block mb-1">
              British Columbia Lottery Corporation
            </span>
            <span className="text-[0.625rem] text-[#9c9490]">
              Live Consulting Engagement · Scrum / Agile Framework
            </span>
          </div>
          <a
            href="/about"
            className="about-btn about-btn-ghost text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Portfolio
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

export default function BclcPlayNowPage() {
  return (
    <div className="about-page">
      <HeroSection />
      <ProjectSpecsSection />
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>
      <RoleRotationSection />
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>
      <SprintTimelineSection />
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>
      <InsightsSection />
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>
      <PersonasSection />
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>
      <RoadmapSection />
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>
      <ArtifactsSection />
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>
      <OutcomesSection />
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <hr className="about-divider" />
      </div>
      <NextStepsSection />
      <BclcFooter />
    </div>
  );
}
