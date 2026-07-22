import type { Metadata } from 'next';
import { generateSeoMetadata } from '@/lib/seo';
import './portfolio.css';

// Candidate briefing for the BCLC Project Portfolio Analyst 2 application,
// presented as a live portfolio status report. Unlisted / noindex.
export const metadata: Metadata = generateSeoMetadata({
  title: 'Portfolio Status Report — Candidate Briefing',
  description:
    'A live portfolio status report prepared for BCLC’s Enterprise Portfolio team: real delivery data, RAG status, risk register, and capability mapping for the Project Portfolio Analyst 2 role.',
  path: '/portfolio',
  noIndex: true,
});

/* ── Real delivery data (git history, this platform) ───────────────────── */

const VELOCITY: { m: string; v: number }[] = [
  { m: 'Jul', v: 3 }, { m: 'Aug', v: 39 }, { m: 'Sep', v: 14 }, { m: 'Oct', v: 20 },
  { m: 'Nov', v: 45 }, { m: 'Dec', v: 102 }, { m: 'Jan', v: 134 }, { m: 'Feb', v: 116 },
  { m: 'Mar', v: 19 }, { m: 'Apr', v: 0 }, { m: 'May', v: 20 }, { m: 'Jun', v: 7 },
  { m: 'Jul', v: 9 },
];

const KPIS = [
  { n: '528', label: 'Tracked changes delivered', sub: '12 months, Jul 2025 – Jul 2026' },
  { n: '137', label: 'Controlled change records', sub: 'Sequential, versioned, auditable' },
  { n: '8', label: 'Initiatives in portfolio', sub: '6 live · 2 in progress' },
  { n: '0', label: 'Data loss on recovery', sub: '126 assets restored from origin' },
];

const PORTFOLIO: { name: string; scope: string; status: 'good' | 'watch'; note: string }[] = [
  { name: 'Commerce', scope: 'Shopify storefront', status: 'good', note: 'Live · multi-market currency (CAD/USD/GBP/EUR), third-party fulfilment' },
  { name: 'Media Library', scope: 'Long-form video', status: 'good', note: 'Live · 126 assets, adaptive streaming' },
  { name: 'Clips Feed', scope: 'Short-form video', status: 'good', note: 'Live · homepage delivery' },
  { name: 'Music', scope: 'Album / track player', status: 'good', note: 'Live' },
  { name: 'The Ark', scope: 'Portfolio management', status: 'good', note: 'Operational · action items, dependencies, capacity, milestone calendar' },
  { name: 'Platform / Auth', scope: 'Identity & access', status: 'good', note: 'Migration completed · recovery SOP in place' },
  { name: 'Moments', scope: 'Event photo galleries', status: 'watch', note: 'In progress · pre-launch' },
  { name: 'Cool Wrld', scope: 'Interactive experience', status: 'watch', note: 'In progress · early build' },
];

const CAPABILITY: { accountability: string; practice: string }[] = [
  {
    accountability: 'Build recurring portfolio reports and dashboards for leadership',
    practice: 'Produces daily operational reporting (revenue, reconciliations, variance) for management at Scott’s Inn; built The Ark’s portfolio status views and a daily morning briefing. This page is itself a portfolio report.',
  },
  {
    accountability: 'Review status/capacity submissions for completeness and give constructive feedback',
    practice: 'Runs a weekly review cadence that surfaces completed vs. stuck items and next-cycle plans across the portfolio, with structured feedback to the owner (me).',
  },
  {
    accountability: 'Analyze portfolio data for themes, risks, dependencies and capacity constraints',
    practice: 'The Ark tracks action items with dependencies, milestone calendars and capacity allocation across concurrent builds; delivery-velocity trend analysis shown below.',
  },
  {
    accountability: 'Run monthly demand & capacity cycles; escalations and data validation',
    practice: 'Prioritises demand against real capacity each cycle; validates data integrity through controlled change records and zero-discrepancy reconciliations.',
  },
  {
    accountability: 'Recommend process efficiencies; maintain documentation and lessons learned',
    practice: 'Codifies runbooks and SOPs (including the recovery procedure), dated session records and a full change log — standard operating practice, not an afterthought.',
  },
  {
    accountability: 'Leverage generative AI to improve reporting speed, quality and consistency',
    practice: 'Uses generative AI extensively for analysis and rapid tool onboarding; an automated redaction layer enforces data-handling standards on anything published.',
  },
  {
    accountability: 'Coordinate with stakeholders to collect, validate and clarify information',
    practice: 'BCLC PlayNow engagement: weekly stakeholder consultations, backlog and sprint reporting, executive-ready recommendations — cross-functional facilitation under a deadline.',
  },
];

const TOOLS: { name: string; level: number; band: string }[] = [
  { name: 'Advanced Excel (XLOOKUP, pivots, modelling)', level: 4, band: 'Advanced' },
  { name: 'Git / GitHub version control', level: 4, band: 'Advanced' },
  { name: 'Generative AI for analysis & tooling', level: 4, band: 'Advanced' },
  { name: 'SQL / data modelling', level: 3, band: 'Working' },
  { name: 'Microsoft 365 (Teams, SharePoint, Excel)', level: 3, band: 'Working' },
  { name: 'Tableau data visualisation', level: 3, band: 'Working' },
  { name: 'Power BI', level: 2, band: 'Foundational — building' },
  { name: 'Power Automate', level: 2, band: 'Foundational — building' },
  { name: 'Enterprise PPM (OnePlan / Jira)', level: 1, band: 'Conceptual — ready to onboard' },
];

const QUALIFICATIONS: { requirement: string; status: string }[] = [
  { requirement: 'Bachelor’s degree in a related discipline', status: 'BBA — Marketing (TRU, 2024) and MBA (TRU, 2026)' },
  { requirement: '3–5 years portfolio / project / data / IT experience', status: '3+ years across operations, BCLC consulting, and end-to-end platform delivery' },
  { requirement: 'Program / project management methodologies', status: 'Agile/Scrum (BCLC PlayNow — PO & Scrum Master); PMI frameworks' },
  { requirement: 'Strong technical writing; document procedures', status: 'Runbooks, SOPs, published case study, and this report' },
  { requirement: 'Advanced Excel; intermediate Power BI', status: 'Advanced Excel in daily use; Power BI building toward intermediate (honest calibration below)' },
  { requirement: 'Working knowledge of PPM platforms (OnePlan, Jira)', status: 'Conceptual familiarity; built an equivalent PPM workflow (The Ark)' },
  { requirement: 'Translate technical concepts for non-technical stakeholders', status: 'Executive presentations, management reporting, technical-to-plain translation' },
  { requirement: 'Microsoft M365 ecosystem', status: 'Teams, SharePoint, Excel in regular use' },
  { requirement: 'Generative AI within data-handling standards', status: 'Extensive AI-assisted analysis; automated redaction enforces data governance' },
  { requirement: 'Understanding of the B.C. gaming industry (asset)', status: 'Consulting engagement on PlayNow.com sportsbook strategy' },
  { requirement: 'Location — remote in BC / Kamloops or Vancouver', status: 'Based in Kamloops, BC' },
];

/* ── Velocity chart (single-series bar; brand hue; static SVG) ─────────── */

function VelocityChart() {
  const W = 720, H = 240, padL = 10, padR = 10, padTop = 22, padBot = 30;
  const innerW = W - padL - padR;
  const base = H - padBot;
  const innerH = base - padTop;
  const max = 134;
  const slot = innerW / VELOCITY.length;
  const barW = Math.min(34, slot * 0.62);
  const peakV = Math.max(...VELOCITY.map((d) => d.v));
  const grid = [0, 50, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label="Monthly delivery velocity in tracked changes, July 2025 to July 2026. Ramp to a peak of 134 in January 2026, then tapering to a steady maintenance cadence."
      style={{ display: 'block' }}>
      {/* gridlines */}
      {grid.map((g) => {
        const y = base - (g / max) * innerH;
        return (
          <g key={g}>
            <line className="pa-grid" x1={padL} y1={y} x2={W - padR} y2={y} />
            <text className="pa-axis" x={W - padR} y={y - 3} textAnchor="end" fontSize="9">{g}</text>
          </g>
        );
      })}
      {/* bars */}
      {VELOCITY.map((d, i) => {
        const x = padL + i * slot + (slot - barW) / 2;
        const h = (d.v / max) * innerH;
        const y = base - h;
        const isPeak = d.v === peakV;
        return (
          <g key={i}>
            <rect className={isPeak ? 'pa-bar-peak' : 'pa-bar'} x={x} y={y} width={barW}
              height={Math.max(h, 0)} rx="2" opacity={isPeak ? 1 : 0.82}>
              <title>{d.m} {i < 6 ? '2025' : '2026'}: {d.v} changes</title>
            </rect>
            {isPeak && (
              <text className="pa-axis" x={x + barW / 2} y={y - 5} textAnchor="middle"
                fontSize="10" fill="var(--accent)" fontWeight="600">{d.v}</text>
            )}
            <text className="pa-axis" x={x + barW / 2} y={H - 12} textAnchor="middle" fontSize="9">{d.m}</text>
          </g>
        );
      })}
      {/* year ticks */}
      <text className="pa-axis" x={padL} y={H - 1} fontSize="8">2025</text>
      <text className="pa-axis" x={W - padR} y={H - 1} textAnchor="end" fontSize="8">2026</text>
    </svg>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function PortfolioReportPage() {
  return (
    <div className="pa min-h-screen">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-16">

        {/* Report header */}
        <header>
          <p className="pa-label" style={{ color: 'var(--accent)' }}>
            Portfolio Status Report &middot; Unlisted &mdash; shared by direct link
          </p>
          <h1 className="mt-4 text-3xl sm:text-[2.5rem] font-semibold leading-[1.05]" style={{ letterSpacing: '-0.02em' }}>
            One analyst, one portfolio,<br className="hidden sm:block" /> reported the way the role asks for.
          </h1>
          <p className="mt-5 text-[1.0625rem]" style={{ color: 'var(--muted)' }}>
            The <strong style={{ color: 'var(--ink)' }}>Project Portfolio Analyst&nbsp;2</strong> role turns
            project, resource and portfolio data into reliable reporting and clear insight. This page is that
            deliverable — built from real data on a platform I run, so the competency is shown rather than asserted.
          </p>

          <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-4 pa-card p-4 sm:p-5">
            {[
              ['Reference', 'ODB-PPA-2026-001'],
              ['Reporting period', 'Jul 2025 – Jul 2026'],
              ['Prepared for', 'Enterprise Portfolio, BCLC'],
              ['Prepared by', 'E. Morris-Odubo'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="pa-label" style={{ color: 'var(--muted)' }}>{k}</dt>
                <dd className="pa-mono mt-1 text-[0.8125rem]">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* 1 · Executive snapshot */}
        <section className="pa-section mt-12 pt-10" id="snapshot">
          <p className="pa-label" style={{ color: 'var(--accent)' }}>1 &middot; Executive snapshot</p>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {KPIS.map((k) => (
              <div key={k.label} className="pa-kpi p-4">
                <div className="pa-kpi-num text-3xl sm:text-[2rem]">{k.n}</div>
                <div className="mt-2 text-[0.8125rem] font-semibold leading-snug">{k.label}</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[0.9375rem]" style={{ color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>Read of the portfolio:</strong> six initiatives are live and
            in steady state; two are in active build. Delivery peaked during the December–February build window and
            has since settled into a maintenance cadence — the expected shape as a portfolio matures.
          </p>
        </section>

        {/* 2 · Portfolio status board (RAG) — signature */}
        <section className="pa-section mt-12 pt-10" id="status-board">
          <p className="pa-label" style={{ color: 'var(--accent)' }}>2 &middot; Portfolio status board</p>
          <p className="mt-4 mb-6" style={{ color: 'var(--muted)' }}>
            Each initiative reported with a RAG status. Status is state, shown with a label — never colour alone.
          </p>
          <div className="pa-card overflow-hidden">
            {PORTFOLIO.map((p) => (
              <div key={p.name} className="pa-row grid grid-cols-[1fr_auto] sm:grid-cols-[1.3fr_1.6fr_auto] gap-x-4 gap-y-1 items-center px-4 py-3.5">
                <div>
                  <div className="text-[0.9375rem] font-semibold leading-tight">{p.name}</div>
                  <div className="pa-mono text-[0.6875rem]" style={{ color: 'var(--faint)' }}>{p.scope}</div>
                </div>
                <div className="hidden sm:block text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{p.note}</div>
                <div className={`pa-rag pa-rag-${p.status} justify-self-end`}>
                  {p.status === 'good' ? 'On track' : 'In progress'}
                </div>
                <div className="sm:hidden col-span-2 text-xs -mt-0.5" style={{ color: 'var(--muted)' }}>{p.note}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 3 · Delivery velocity chart */}
        <section className="pa-section mt-12 pt-10" id="velocity">
          <p className="pa-label" style={{ color: 'var(--accent)' }}>3 &middot; Delivery velocity</p>
          <p className="mt-4 mb-5" style={{ color: 'var(--muted)' }}>
            Tracked changes shipped per month across the portfolio. One series; hover a bar for its value.
          </p>
          <div className="pa-card p-4 sm:p-5">
            <VelocityChart />
          </div>
          <p className="mt-4 text-[0.9375rem]" style={{ color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>Insight:</strong> throughput climbed through Q4 2025 to a peak
            of <span className="pa-mono">134</span> changes in January, then declined by design as initiatives moved
            from build to maintenance. Reading that trend — separating a healthy taper from a stall — is the core of
            capacity and variance analysis this role performs.
          </p>
        </section>

        {/* 4 · Risk register */}
        <section className="pa-section mt-12 pt-10" id="risk">
          <p className="pa-label" style={{ color: 'var(--accent)' }}>4 &middot; Risk register</p>
          <div className="mt-5 pa-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="pa-mono text-[0.6875rem]" style={{ color: 'var(--faint)' }}>RSK-01 · Third-party service dependency</div>
                <h3 className="text-[1.0625rem] font-semibold mt-1">Streaming provider disruption — full media library offline</h3>
              </div>
              <div className="flex items-center gap-3 pa-mono text-[0.6875rem]">
                <span className="pa-rag pa-rag-risk">At&nbsp;risk</span>
                <span style={{ color: 'var(--faint)' }}>→</span>
                <span className="pa-rag pa-rag-good">Resolved</span>
              </div>
            </div>
            <div className="mt-4 grid sm:grid-cols-3 gap-4 text-[0.875rem]">
              <div>
                <div className="pa-label" style={{ color: 'var(--muted)' }}>Impact</div>
                <p className="mt-1" style={{ color: 'var(--muted)' }}>All 126 streaming assets removed by an upstream provider outage.</p>
              </div>
              <div>
                <div className="pa-label" style={{ color: 'var(--muted)' }}>Mitigation</div>
                <p className="mt-1" style={{ color: 'var(--muted)' }}>Source records were retained under controlled naming/retention, so all assets were re-ingested from origin.</p>
              </div>
              <div>
                <div className="pa-label" style={{ color: 'var(--muted)' }}>Outcome</div>
                <p className="mt-1" style={{ color: 'var(--muted)' }}><strong style={{ color: 'var(--good)' }}>Zero data loss.</strong> Recovery codified as a standing SOP runbook.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5 · Capability register */}
        <section className="pa-section mt-12 pt-10" id="capability">
          <p className="pa-label" style={{ color: 'var(--accent)' }}>5 &middot; Capability register</p>
          <p className="mt-4 mb-6" style={{ color: 'var(--muted)' }}>
            Each accountability from the posting mapped to demonstrated practice.
          </p>
          <div className="border-t" style={{ borderColor: 'var(--line)' }}>
            {CAPABILITY.map((c, i) => (
              <div key={i} className="pa-row grid sm:grid-cols-[1fr_1.3fr] gap-x-6 gap-y-1.5 py-5">
                <h3 className="text-[0.9375rem] font-semibold leading-snug">{c.accountability}</h3>
                <p className="text-[0.9375rem]" style={{ color: 'var(--muted)' }}>{c.practice}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6 · Tool proficiency — honest calibration */}
        <section className="pa-section mt-12 pt-10" id="tools">
          <p className="pa-label" style={{ color: 'var(--accent)' }}>6 &middot; Tool proficiency</p>
          <p className="mt-4 mb-6" style={{ color: 'var(--muted)' }}>
            Calibrated honestly — advanced where earned, building where it’s building. Accuracy is the job.
          </p>
          <div className="pa-card overflow-hidden">
            {TOOLS.map((t) => (
              <div key={t.name} className="pa-row grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_7rem] gap-x-4 items-center px-4 py-3">
                <span className="text-[0.9375rem]">{t.name}</span>
                <span className="pa-meter justify-self-end" aria-hidden>
                  {[1, 2, 3, 4].map((p) => <span key={p} className={`pa-pip ${p <= t.level ? 'on' : ''}`} />)}
                </span>
                <span className="hidden sm:block pa-mono text-[0.6875rem] justify-self-end text-right" style={{ color: 'var(--muted)' }}>{t.band}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 7 · Qualifications alignment */}
        <section className="pa-section mt-12 pt-10" id="qualifications">
          <p className="pa-label" style={{ color: 'var(--accent)' }}>7 &middot; Qualifications alignment</p>
          <div className="mt-6 border-t" style={{ borderColor: 'var(--line)' }}>
            {QUALIFICATIONS.map((q) => (
              <div key={q.requirement} className="pa-row grid sm:grid-cols-[1fr_1.1fr] gap-x-6 gap-y-1 py-3.5">
                <p className="text-[0.9375rem] font-semibold leading-snug">{q.requirement}</p>
                <p className="text-[0.9375rem]" style={{ color: 'var(--muted)' }}>
                  <span className="mr-2" aria-hidden style={{ color: 'var(--good)' }}>&#10003;</span>{q.status}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[0.875rem]" style={{ color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>Growth areas I’d bring intent to:</strong> deeper Power BI /
            Power Automate delivery and a formal PM credential (PMP / PMI-ACP). Stated plainly because a portfolio
            analyst’s value starts with reporting things as they are.
          </p>
        </section>

        {/* Footer */}
        <footer className="pa-section mt-12 pt-10 pb-6">
          <p className="pa-label" style={{ color: 'var(--accent)' }}>Contact</p>
          <div className="mt-4 space-y-1 text-[1.0625rem]">
            <p><strong>Emmanuel Morris-Odubo</strong> &mdash; Kamloops, BC</p>
            <p>
              <a className="pa-link" href="mailto:maniodubo@gmail.com">maniodubo@gmail.com</a>
              {' '}&middot;{' '}
              <a className="pa-link" href="tel:+17785866660">+1 (778) 586-6660</a>
            </p>
          </div>
          <p className="mt-6 text-sm" style={{ color: 'var(--muted)' }}>
            Further reading: <a className="pa-link" href="/bclc-playnow">BCLC PlayNow case study</a> &middot;{' '}
            <a className="pa-link" href="/governance">governance briefing</a> &middot;{' '}
            <a className="pa-link" href="/about">candidate portfolio</a> &middot;{' '}
            <a className="pa-link" href="/store">a live initiative</a>. This report is unlisted and excluded from
            search indexing. Figures are drawn from the platform’s version-control history.
          </p>
        </footer>
      </div>
    </div>
  );
}
