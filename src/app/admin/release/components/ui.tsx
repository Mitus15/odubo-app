'use client';

/**
 * The small shared pieces of the Release surface, in the admin palette.
 * Kept in one file so the tokens are stated once — bg #0d0c0a, panel #1c1a19,
 * border #502d26, accent #843c2d, text #ede8df, muted #726d6c.
 */
import Link from 'next/link';

export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[#502d26]/60 bg-[#1c1a19] ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div>
        <h2 className="text-[#ede8df] text-sm font-semibold tracking-wide uppercase">
          {children}
        </h2>
        {hint && <p className="text-[#726d6c] text-xs mt-1">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'border-[#502d26]/60 text-[#b2a491] bg-[#302927]/40',
  good: 'border-emerald-800/60 text-emerald-300 bg-emerald-950/40',
  warn: 'border-amber-800/60 text-amber-300 bg-amber-950/30',
  bad: 'border-red-900/60 text-red-300 bg-red-950/30',
  accent: 'border-[#843c2d] text-[#ede8df] bg-[#843c2d]/25',
};

export function Chip({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  type = 'button',
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  const styles =
    variant === 'primary'
      ? 'bg-[#843c2d] text-[#ede8df] hover:bg-[#9a4736] border-transparent'
      : variant === 'danger'
        ? 'bg-transparent text-red-300 hover:bg-red-950/40 border-red-900/60'
        : 'bg-transparent text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927] border-[#502d26]/60';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#b2a491] hover:text-[#ede8df] underline decoration-[#502d26] underline-offset-4 text-xs"
    >
      {children} ↗
    </a>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[#726d6c] hover:text-[#b2a491] text-xs inline-flex items-center gap-1"
    >
      ← {children}
    </Link>
  );
}

export function Spinner() {
  return (
    <div className="h-5 w-5 rounded-full border-2 border-[#502d26] border-t-[#843c2d] animate-spin" />
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#502d26]/60 p-8 text-center">
      <p className="text-[#b2a491] text-sm">{title}</p>
      {body && <p className="text-[#726d6c] text-xs mt-1">{body}</p>}
    </div>
  );
}

/** Bytes as the owner thinks of them: a master is "84 MB", not 88080384. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Seconds as m:ss. Returns an em dash for unknown, never "0:00". */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
