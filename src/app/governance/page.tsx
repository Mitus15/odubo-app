import type { Metadata } from 'next';
import { generateSeoMetadata } from '@/lib/seo';
import './governance.css';

// Candidate briefing for the BCLC Administrative Assistant, Board Governance
// application. Unlisted: shared by direct link, excluded from search indexing.
export const metadata: Metadata = generateSeoMetadata({
  title: 'Governance Operations — Candidate Briefing',
  description:
    'Evidence briefing prepared for the Corporate Secretary’s Office, BCLC: records management, document control, and governance operations demonstrated on a working platform.',
  path: '/governance',
  noIndex: true,
});

/* ── Register data ─────────────────────────────────────────────────────── */

const REGISTER: {
  accountability: string;
  practice: string;
  refs: { code: string; href: string }[];
}[] = [
  {
    accountability: 'Prepare and distribute meeting materials; maintain them in the Board portal and secure repositories',
    practice:
      'Delivers structured action-item summaries to executive leadership at Scott’s Inn; maintains controlled repositories with enforced naming conventions and full version history.',
    refs: [
      { code: 'B-03', href: '#appendix-b' },
      { code: 'C-02', href: '#appendix-c' },
    ],
  },
  {
    accountability: 'Maintain records of minutes, resolutions, action items and decisions; track follow-ups and remind owners',
    practice:
      'Designed and operates The Ark: action items with owners, due dates and statuses; a chronological record of actions and outcomes per project; a weekly review that surfaces what closed and what is stuck.',
    refs: [
      { code: 'A-01', href: '#appendix-a' },
      { code: 'C-01', href: '#appendix-c' },
    ],
  },
  {
    accountability: 'Coordinate Board and committee meeting logistics — scheduling, rooms, attendees, readiness',
    practice:
      'Ran end-to-end meeting logistics (agendas, venues, bookings, volunteers) as founder-president of a TRU student organization; manages arrival logistics for corporate accounts including Rocky Mountaineer.',
    refs: [
      { code: 'B-02', href: '#appendix-b' },
      { code: 'B-03', href: '#appendix-b' },
    ],
  },
  {
    accountability: 'Manage meeting calendars, annual cadences and key milestone tracking',
    practice:
      'Operates a planner that holds calendars, milestones and a prioritized backlog in one view, with a morning briefing that surfaces due, overdue and upcoming items each day.',
    refs: [{ code: 'A-02', href: '#appendix-a' }],
  },
  {
    accountability: 'Support directors and executives with portal access, navigation and troubleshooting',
    practice:
      'Administers a role-based portal: invitation-based onboarding, scoped permissions, access removal, and first-line troubleshooting for its users.',
    refs: [
      { code: 'C-03', href: '#appendix-c' },
      { code: 'D-01', href: '#appendix-d' },
    ],
  },
  {
    accountability: 'Coordinate stakeholders so materials are complete and submitted by deadline',
    practice:
      'Held Product Owner and Scrum Master roles across a three-sprint BCLC PlayNow engagement: weekly stakeholder consultations, sprint packages assembled and delivered on schedule.',
    refs: [{ code: 'B-01', href: '#appendix-b' }],
  },
  {
    accountability: 'Support budget tracking for governance activities',
    practice:
      'Maintained budget allocation logs for a student organization; executes daily revenue reporting and cash reconciliations at Scott’s Inn to a zero-discrepancy standard.',
    refs: [
      { code: 'B-02', href: '#appendix-b' },
      { code: 'B-03', href: '#appendix-b' },
    ],
  },
  {
    accountability: 'Improve governance processes, templates, checklists and standard operating procedures',
    practice:
      'Writes and maintains runbooks, launch checklists and dated operating records as a matter of routine — including a documented continuity runbook exercised under real conditions.',
    refs: [
      { code: 'C-01', href: '#appendix-c' },
      { code: 'D-02', href: '#appendix-d' },
    ],
  },
];

const QUALIFICATIONS: { requirement: string; status: string }[] = [
  { requirement: 'Post-secondary education in Business Administration', status: 'BBA — Marketing (TRU, 2024) and MBA (TRU, 2026)' },
  { requirement: 'Three or more years in a related field', status: 'Operations and administrative roles, 2022 – present' },
  { requirement: 'Records management, naming conventions, version control, retention', status: 'Daily working practice — evidenced in Appendix C' },
  { requirement: 'Document formatting and quality control (Word, PowerPoint, Excel, PDF)', status: 'Microsoft 365 across academic, consulting and operations work' },
  { requirement: 'Adobe software and PDF tools', status: 'Photoshop for brand and marketing assets; Acrobat for PDF document control' },
  { requirement: 'Board portal / repository management', status: 'Builds and administers one — Appendices A, C, D' },
  { requirement: 'Meeting planning and logistics, including virtual tools', status: 'Teams and virtual meeting cadences; in-person logistics at Scott’s and TRUSU' },
  { requirement: 'Agile methodology / cross-functional teams (asset)', status: 'Scrum Product Owner and Scrum Master — BCLC PlayNow engagement' },
  { requirement: 'Understanding of the B.C. gaming industry (asset)', status: 'Consulting engagement on PlayNow.com sportsbook strategy' },
  { requirement: 'Sensitive information handled with discretion', status: 'Guest records, financial reconciliations, and automated redaction of secrets in published documents' },
  { requirement: 'Location', status: 'Based in Kamloops, BC — resident near the Seymour Street office' },
];

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function GovernanceBriefingPage() {
  return (
    <div className="gov-doc min-h-screen">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-16">

        {/* Document control block */}
        <header>
          <p className="gov-label" style={{ color: 'var(--registry)' }}>
            Candidate Briefing &middot; Unlisted &mdash; shared by direct link
          </p>
          <h1
            className="mt-4 text-3xl sm:text-4xl font-normal leading-tight"
            style={{ letterSpacing: '-0.01em' }}
          >
            Governance operations, demonstrated on a working system
          </h1>

          <dl className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 border border-[var(--hairline)] rounded-sm p-4 sm:p-5">
            {[
              ['Reference', 'ODB-GOV-2026-001'],
              ['Version', '1.1 · 21 July 2026'],
              ['Status', 'Current'],
              ['Prepared for', 'Corporate Secretary’s Office, BCLC'],
              ['Prepared by', 'Emmanuel Morris-Odubo'],
              ['Location', 'Kamloops, BC'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="gov-label" style={{ color: 'var(--ink-muted)' }}>{k}</dt>
                <dd className="gov-mono mt-1" style={{ fontSize: '0.8125rem' }}>{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* 1. Purpose */}
        <section className="gov-section mt-12 pt-10" id="purpose">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>1 &middot; Purpose</p>
          <div className="mt-5 space-y-5 text-[1.0625rem]">
            <p>
              This page accompanies my application for <strong>Administrative Assistant, Board
              Governance</strong>. A resume can state that a candidate keeps accurate records,
              controls document versions, and tracks action items to completion. I would rather
              show it.
            </p>
            <p>
              Everything referenced below is real and in operation: a platform I designed, built,
              and administer &mdash; its records, its access controls, its calendars and action-item
              systems, and the operating discipline around them. The register in
              section&nbsp;3 maps each accountability in your posting to a practice I already
              perform, with references to the evidence.
            </p>
            <p style={{ color: 'var(--ink-muted)' }}>
              This page is itself a controlled document on that platform: versioned in the
              repository, published through the same release process as everything else here.
            </p>
          </div>
        </section>

        {/* 2. Candidate profile */}
        <section className="gov-section mt-12 pt-10" id="profile">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>2 &middot; Candidate profile</p>
          <ul className="mt-5 space-y-3 text-[1.0625rem]">
            <li><strong>MBA</strong>, Thompson Rivers University (2026); BBA in Marketing, TRU (2024). Three years of Chemical Engineering training, UBC.</li>
            <li><strong>Operations Associate &amp; Administrative Support to Management</strong>, Scott&rsquo;s Inn &amp; Suites, Kamloops &mdash; daily reporting, reconciliations, corporate-account logistics, structured summaries to leadership.</li>
            <li><strong>Founder, Odubo Studio</strong> &mdash; a working commerce and media platform whose records, repositories and operating procedures form the evidence in this briefing.</li>
            <li><strong>Agile consulting for BCLC PlayNow</strong> (TRU BUSN 6070, 2025) &mdash; Product Owner and Scrum Master across a three-sprint engagement with weekly BCLC stakeholder consultations.</li>
          </ul>
        </section>

        {/* 3. Accountability register — signature element */}
        <section className="gov-section mt-12 pt-10" id="register">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>3 &middot; Accountability register</p>
          <p className="mt-4 mb-8" style={{ color: 'var(--ink-muted)' }}>
            Each row condenses an accountability from the posting and records the practice that
            demonstrates it. Reference codes link to the evidence appendices.
          </p>

          <div className="border-t border-[var(--hairline)]">
            {REGISTER.map((row, i) => (
              <div key={row.refs[0].code + i} className="gov-row grid sm:grid-cols-[1fr_1.2fr_auto] gap-x-6 gap-y-2 py-5">
                <h3 className="text-[0.9375rem] font-semibold leading-snug">
                  {row.accountability}
                </h3>
                <p className="text-[0.9375rem]" style={{ color: 'var(--ink-muted)' }}>
                  {row.practice}
                </p>
                <div className="flex sm:flex-col items-start gap-2">
                  {row.refs.map((r) => (
                    <a key={r.code} href={r.href} className="gov-ref">{r.code}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Qualifications alignment */}
        <section className="gov-section mt-12 pt-10" id="qualifications">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>4 &middot; Qualifications alignment</p>
          <div className="mt-6 border-t border-[var(--hairline)]">
            {QUALIFICATIONS.map((q) => (
              <div key={q.requirement} className="gov-row grid sm:grid-cols-[1fr_1.1fr] gap-x-6 gap-y-1 py-3.5">
                <p className="text-[0.9375rem] font-semibold leading-snug">{q.requirement}</p>
                <p className="text-[0.9375rem]" style={{ color: 'var(--ink-muted)' }}>
                  <span className="gov-check mr-2" aria-hidden>&#10003;</span>{q.status}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Appendix A — The Ark */}
        <section className="gov-section mt-12 pt-10" id="appendix-a">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>Appendix A &middot; The Ark &mdash; an operations system built on governance habits</p>
          <div className="mt-5 space-y-5">
            <p>
              I needed the same discipline a board office runs on &mdash; items don&rsquo;t close because
              someone remembers them; they close because a system tracks them. So I built one.
              The Ark is the access-controlled operations hub of this platform.
            </p>
            <ul className="space-y-3">
              <li>
                <span className="gov-mono gov-check mr-2">A-01</span>
                <strong>Action and decision records.</strong> Tasks carry owners, due dates and
                statuses; every project keeps a chronological timeline of actions taken and
                outcomes recorded; notes preserve context. A weekly review reports what got done,
                what is stuck, and what is planned next.
              </li>
              <li>
                <span className="gov-mono gov-check mr-2">A-02</span>
                <strong>Calendar and milestone planning.</strong> A planner combines the calendar,
                milestone tracking and a prioritized backlog; a morning briefing surfaces today&rsquo;s
                items, overdue items and approaching milestones &mdash; the daily mechanics of an
                annual governance calendar.
              </li>
            </ul>
            <p style={{ color: 'var(--ink-muted)' }}>
              The Ark sits behind role-based authentication, so it is described here rather than
              linked. I am glad to walk through it live in an interview.
            </p>
          </div>
        </section>

        {/* Appendix B — Engagements */}
        <section className="gov-section mt-12 pt-10" id="appendix-b">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>Appendix B &middot; Engagements and operations</p>
          <ul className="mt-5 space-y-4">
            <li>
              <span className="gov-mono gov-check mr-2">B-01</span>
              <strong>BCLC PlayNow consulting engagement (TRU, 2025).</strong> Product Owner and
              Scrum Master across three sprints: product backlogs, sprint reviews and
              retrospectives, weekly consultations with BCLC representatives, final strategic
              recommendations. The full case study is published at{' '}
              <a className="gov-link" href="/bclc-playnow">/bclc-playnow</a>.
            </li>
            <li>
              <span className="gov-mono gov-check mr-2">B-02</span>
              <strong>TRUSU Amphitheatre Club &mdash; Founder &amp; President.</strong> Drafted the
              charter, pitched student-union leadership, and ran the meeting machinery:
              agendas, bookings, budget allocation logs, volunteer coordination.
            </li>
            <li>
              <span className="gov-mono gov-check mr-2">B-03</span>
              <strong>Scott&rsquo;s Inn &amp; Suites &mdash; Operations &amp; Administrative Support.</strong>{' '}
              Daily revenue reporting and cash reconciliations held to zero discrepancy;
              logistics and quality assurance for corporate accounts including Rocky
              Mountaineer; facility audits delivered as structured action-item summaries to
              leadership.
            </li>
          </ul>
        </section>

        {/* Appendix C — Records & document control (specimens) */}
        <section className="gov-section mt-12 pt-10" id="appendix-c">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>Appendix C &middot; Records and document control &mdash; specimens</p>
          <p className="mt-4 mb-6" style={{ color: 'var(--ink-muted)' }}>
            Excerpts from the platform&rsquo;s actual records, reproduced as they exist in the
            repository.
          </p>

          <div className="space-y-6">
            <figure>
              <figcaption className="gov-label mb-2" style={{ color: 'var(--ink-muted)' }}>
                <span className="gov-mono gov-check mr-2">C-01</span>Dated session records &mdash; every working session closes with a written record
              </figcaption>
              <pre className="gov-specimen gov-mono p-4 leading-relaxed">{`docs/sessions/
  2025-12-22-shopify-auth-rebuild.md
  2026-02-06-arsenal-upload-postforme.md
  2026-05-10-clerk-auth-migration.md
  2026-06-21-the-ark-build.md`}</pre>
            </figure>

            <figure>
              <figcaption className="gov-label mb-2" style={{ color: 'var(--ink-muted)' }}>
                <span className="gov-mono gov-check mr-2">C-02</span>Controlled naming and versioning &mdash; sequential, immutable, auditable
              </figcaption>
              <pre className="gov-specimen gov-mono p-4 leading-relaxed">{`database/migrations/
  001_add_account_lockout.sql
  002_add_email_verification.sql
  003_add_is_admin_to_users.sql
  ...141 sequential, never-edited change records

change log (excerpt):
  feat(store): geo-localized currency + explicit currency labels
  fix(auth): make login cookie domain env-driven
  feat: add The Ark — project management system`}</pre>
            </figure>

            <div>
              <p>
                <span className="gov-mono gov-check mr-2">C-03</span>
                <strong>Secure information handling.</strong> Portal access is provisioned by
                invitation with scoped permissions and removed the same way. Documents published
                to the public <a className="gov-link" href="/docs">/docs</a> library pass through an
                automated redaction layer that strips credentials, keys and private data before
                anything is rendered.
              </p>
            </div>
          </div>
        </section>

        {/* Appendix D — The platform as live evidence */}
        <section className="gov-section mt-12 pt-10" id="appendix-d">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>Appendix D &middot; The platform itself &mdash; live</p>
          <ul className="mt-5 space-y-4">
            <li>
              <span className="gov-mono gov-check mr-2">D-01</span>
              <strong>Working operations, in production.</strong> A live storefront at{' '}
              <a className="gov-link" href="/store">/store</a> (multi-market pricing in CAD, USD,
              GBP and EUR with third-party fulfillment), a media library at{' '}
              <a className="gov-link" href="/media">/media</a>, and event-photo galleries &mdash; all
              running on the repositories and procedures described above.
            </li>
            <li>
              <span className="gov-mono gov-check mr-2">D-02</span>
              <strong>Continuity under real conditions.</strong> In July 2026 a third-party video
              service disruption removed the platform&rsquo;s entire streaming library. Because source
              records were retained under the controlled conventions in Appendix C, all 126
              assets were restored from origin with zero loss &mdash; and the recovery procedure now
              exists as a written runbook. Retention practices are easy to profess; this is what
              they are for.
            </li>
          </ul>
        </section>

        {/* Footer / contact */}
        <footer className="gov-section mt-12 pt-10 pb-6">
          <p className="gov-label" style={{ color: 'var(--registry)' }}>Contact</p>
          <div className="mt-4 space-y-1 text-[1.0625rem]">
            <p><strong>Emmanuel Morris-Odubo</strong> &mdash; Kamloops, BC</p>
            <p>
              <a className="gov-link" href="mailto:maniodubo@gmail.com">maniodubo@gmail.com</a>
              {' '}&middot;{' '}
              <a className="gov-link" href="tel:+17785866660">+1 (778) 586-6660</a>
            </p>
          </div>
          <p className="mt-6 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Further reading: <a className="gov-link" href="/about">candidate portfolio</a> &middot;{' '}
            <a className="gov-link" href="/bclc-playnow">BCLC PlayNow case study</a> &middot;{' '}
            <a className="gov-link" href="/docs">published documentation</a>. References available
            on request. This page is unlisted and excluded from search indexing.
          </p>
        </footer>
      </div>
    </div>
  );
}
