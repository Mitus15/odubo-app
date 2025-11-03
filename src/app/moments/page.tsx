"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Tab = 'join' | 'moments';

// Minimal inline icons (no extra deps)
function IconCamera(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 8.5h3l1.5-2h8L17 8.5h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/>
      <circle cx="12" cy="14" r="3.5"/>
    </svg>
  );
}
function IconKey(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="8" cy="9" r="3"/>
      <path d="M10.5 10.5l5 5v2h2v-2h2v-2l-5-5"/>
    </svg>
  );
}
function IconQr(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 14h4v4h-4zM14 18h2v3h-2z"/>
    </svg>
  );
}
function IconFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H3z"/>
    </svg>
  );
}

export default function MomentsIndex() {
  const [tab, setTab] = useState<Tab>('join');
  const [galleries, setGalleries] = useState<Array<{ id: number; title: string; created_at?: string }>>([]);
  const featured: any[] = useMemo(() => [], []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/moments/galleries/public?limit=12');
        const data: any = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.galleries)) {
          setGalleries(data.galleries.map((g: any) => ({ id: g.id, title: g.title, created_at: g.created_at })));
        }
      } catch (e) {
        console.error('Failed loading galleries', e);
      }
    })();
  }, []);

  return (
    // Scroll within the app layout's overflow-hidden main area
    <div className="h-full overflow-y-auto bg-gradient-to-b from-[#171616] via-[#1b1a19] to-[#171616]">
      {/* Mobile-first header */}
      <header className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[34px] leading-none font-extrabold tracking-tight text-[#ede8df] drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]">
            Moments
          </h1>
        </div>
        <p className="mt-2 text-[15px] text-[#b2a491]">
          Join. Capture. Relive.
        </p>

        {/* Segmented tabs */}
        <div className="mt-5 inline-flex p-1 rounded-2xl bg-[#1f1e1d] border border-[#3b3733]">
          {(['join','moments'] as Tab[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                'px-4 py-2 rounded-xl text-[15px] font-semibold transition active:scale-95 ' +
                (tab === k ? 'bg-[#ede8df] text-[#171616]' : 'text-[#ede8df] hover:bg-[#2a2626]')
              }
            >
              {k === 'join' ? 'Join' : 'Moments'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-24">
  {tab === 'join' ? <JoinSection /> : <LibrarySection galleries={galleries} featured={featured} />}
      </main>
    </div>
  );
}

function JoinSection() {
  return (
    <section className="mt-6 space-y-5">
      {/* Big CTA cards */}
      <Link
        href="/moments/join"
        className="block active:scale-95 transition rounded-2xl border border-[#3b3733] overflow-hidden bg-gradient-to-br from-[#2a2626] to-[#1a1918]"
      >
        <div className="p-5 flex items-center gap-4">
          <div className="shrink-0 h-12 w-12 rounded-full bg-[#502d26]/20 grid place-items-center border border-[#502d26]/40">
            <IconKey className="h-6 w-6 text-[#ede8df]" />
          </div>
          <div>
            <div className="text-[18px] font-semibold text-[#ede8df]">Enter Event Code</div>
            <div className="text-[13px] text-[#b2a491]">Jump into a gallery.</div>
          </div>
          <span className="ml-auto text-[#b2a491]">›</span>
        </div>
      </Link>

      <Link
        href="/moments/capture"
        className="block active:scale-95 transition rounded-2xl border border-[#3b3733] overflow-hidden bg-gradient-to-br from-[#502d26] to-[#6b4c3b]"
      >
        <div className="p-5 flex items-center gap-4">
          <div className="shrink-0 h-12 w-12 rounded-full bg-[#171616]/20 grid place-items-center border border-[#171616]/40">
            <IconCamera className="h-6 w-6 text-[#ede8df]" />
          </div>
          <div>
            <div className="text-[18px] font-semibold text-[#ede8df]">Open Camera</div>
            <div className="text-[13px] text-[#ede8df]/80">Capture a moment now.</div>
          </div>
          <span className="ml-auto text-[#ede8df]">›</span>
        </div>
      </Link>

      {/* Secondary quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button className="rounded-xl border border-[#3b3733] bg-[#1f1e1d] p-4 active:scale-95 transition text-left">
          <IconQr className="h-6 w-6 text-[#ede8df]" />
          <div className="mt-2 text-[14px] font-medium text-[#ede8df]">Scan QR</div>
          <div className="text-[12px] text-[#b2a491]">Coming soon</div>
        </button>
        <button className="rounded-xl border border-[#3b3733] bg-[#1f1e1d] p-4 active:scale-95 transition text-left">
          <IconFolder className="h-6 w-6 text-[#ede8df]" />
          <div className="mt-2 text-[14px] font-medium text-[#ede8df]">My Galleries</div>
          <div className="text-[12px] text-[#b2a491]">Soon</div>
        </button>
      </div>
    </section>
  );
}

function LibrarySection({ galleries, featured }: { galleries: Array<{ id: number; title: string; created_at?: string }>; featured: Array<any> }) {
  return (
    <section className="mt-6 space-y-6">
      {featured.length > 0 && (
        <Shelf title="Featured">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
            {featured.map((g) => (
              <GalleryCard key={g.id} title={g.title} date={g.date} from={g.from} to={g.to} />
            ))}
          </div>
        </Shelf>
      )}
      {galleries.length > 0 ? (
        <Shelf title="Recent">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
            {[...galleries].map((g, i) => (
              <GalleryCard key={g.id + '-r'} id={g.id} title={g.title} date={g.created_at ? new Date(g.created_at).toDateString() : ''} from={i % 2 ? '#6b4c3b' : '#502d26'} to={i % 2 ? '#502d26' : '#6b4c3b'} />
            ))}
          </div>
        </Shelf>
      ) : (
        <div className="text-[13px] text-[#b2a491]">No galleries to show yet.</div>
      )}
    </section>
  );
}

function Shelf({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-[#ede8df]">{title}</h3>
        <button className="text-[12px] text-[#b2a491] active:scale-95">See all</button>
      </div>
      {children}
    </div>
  );
}

// Link already imported at top

function GalleryCard({ title, date, from, to, id }: { title: string; date: string; from: string; to: string; id?: number }) {
  return (
    <article
      className="snap-start shrink-0 w-[200px] rounded-2xl border border-[#3b3733] overflow-hidden bg-[#1f1e1d] active:scale-95 transition"
    >
      <div
        className="h-[120px]"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, filter: 'saturate(1.05)' }}
      />
      <div className="p-3">
        <div className="text-[14px] font-medium text-[#ede8df] line-clamp-2 min-h-[40px]">{title}</div>
        <div className="text-[12px] text-[#b2a491] mt-1">{date}</div>
        <div className="mt-2 flex gap-2">
          {typeof id === 'number' ? (
            <Link href={`/moments/gallery/${id}`} className="px-3 py-1.5 text-[12px] rounded bg-[#ede8df] text-[#171616] active:scale-95">View</Link>
          ) : (
            <span className="px-3 py-1.5 text-[12px] rounded bg-[#ede8df] text-[#171616] opacity-50">View</span>
          )}
          <button className="px-3 py-1.5 text-[12px] rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] active:scale-95">Share</button>
        </div>
      </div>
    </article>
  );
}
