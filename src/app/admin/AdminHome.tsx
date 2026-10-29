'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import UserProvider from './UserProvider';
import TabContent from './TabContent';
import { Mark, Marks, Thumb, dayKey, dayLabel, timeLabel } from './social-studio/components/parts';
import { ODUBO_MARK, ODUBO_MARK_ASPECT } from '@/lib/brand/marks';
import { clearSignIn } from '@/lib/signIn';
import { KIND_LABEL, allPlatformsDone, kindOf, queueOf, type QueuePost } from '@/lib/social/postQueue';
import type { HomeFacts } from '@/lib/admin/home';

/**
 * The admin home (admin.odubostudio.com), set like the Studio, on his phone.
 *
 * Today's next post comes first with its one drawn button, Post, which opens
 * the Studio on it; under it, the day's posts as a rail (out, now, later).
 * Then his five jobs as playbill rows, each with one live fact: Inbox, Store,
 * Levels, Links, Release. Every other tool is in ⋯, grouped; a tool that was
 * a tab of the old admin opens over the home as a room (?tool=<tab>) with ×
 * back, and the rest open as the pages they are.
 *
 * The facts come from api/admin/home, for his day on his phone's clock. In
 * development, ?fixtures loads public/_dev/home-fixtures.json instead
 * (git-ignored; nothing is read from the database), and &now=<ISO> sets the
 * clock, to see a day before it comes.
 */

type Tool =
  /** A tab of the old admin, opened here as a room */
  | { label: string; tab: string }
  /** An admin page of its own */
  | { label: string; page: string }
  /** A page of the site: it leaves the admin */
  | { label: string; site: string }
  /** Another service */
  | { label: string; url: string };

const MENU: { group: string; tools: Tool[] }[] = [
  {
    group: 'Music',
    tools: [
      { label: 'Albums', page: '/admin/albums' },
      { label: 'Tracks', page: '/admin/tracks' },
      { label: 'Videos', page: '/admin/videos' },
    ],
  },
  {
    group: 'Site',
    tools: [
      { label: 'Clips', tab: 'arsenal' },
      { label: 'Moments', tab: 'moments' },
      { label: 'Brand assets', tab: 'brand-assets' },
    ],
  },
  {
    group: 'Store',
    tools: [
      { label: 'Products', tab: 'products' },
      { label: 'Orders', tab: 'orders' },
      { label: 'Customers', tab: 'customers' },
      { label: 'Discounts', tab: 'discounts' },
      { label: 'Settings', tab: 'store-settings' },
      { label: 'Shopify', url: 'https://admin.shopify.com' },
    ],
  },
  {
    group: 'Numbers',
    tools: [
      { label: 'Dashboard', tab: 'overview' },
      { label: 'Analytics', tab: 'analytics' },
      { label: 'Reports', tab: 'reports' },
      { label: 'Finance', tab: 'finance' },
    ],
  },
  {
    group: 'Social accounts',
    tools: [
      { label: 'Accounts', tab: 'social' },
      { label: 'AI Studio', page: '/admin/ai-studio' },
    ],
  },
  {
    group: 'Loop Soul',
    tools: [
      { label: 'Film', site: '/loop/admin/film' },
      { label: 'Door', site: '/loop/admin/door' },
      { label: 'Posters', site: '/loop/admin/posters' },
    ],
  },
  {
    group: 'House',
    tools: [
      { label: 'The Ark', page: '/admin/ark' },
      { label: 'Users', tab: 'users' },
      { label: 'Storage', page: '/admin/storage' },
      { label: 'Database', page: '/admin/db' },
      { label: 'Live', page: '/admin/live' },
      { label: 'Settings', tab: 'settings' },
    ],
  },
];

/** The rooms the home's own rows open, besides the menu's */
const ROOM_TITLE: Record<string, string> = Object.fromEntries([
  ...MENU.flatMap((g) => g.tools.flatMap((t) => ('tab' in t ? [[t.tab, t.label]] : []))),
  ['links', 'Links'],
  ['store-settings', 'Store settings'],
  ['settings', 'Settings'],
]);

/** How often the facts are read again while the home is open */
const READ_EVERY_MS = 5 * 60 * 1000;

/**
 * Where the site is from here: on admin.<apex> every path is an admin path,
 * so the site is the apex; elsewhere (the dev server) it is this origin. Read
 * after the first paint, since the server cannot know the host the phone sees.
 */
function useSite(): string {
  const [site, setSite] = useState('');
  useEffect(() => {
    const { protocol, host } = window.location;
    if (host.startsWith('admin.')) setSite(`${protocol}//${host.slice('admin.'.length)}`);
  }, []);
  return site;
}

function dayBounds(now: Date): { since: string; until: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { since: start.toISOString(), until: end.toISOString() };
}

function devFixtures(): { on: boolean; now?: Date } {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return { on: false };
  const q = new URLSearchParams(window.location.search);
  const at = q.get('now');
  return { on: q.has('fixtures'), now: at ? new Date(at) : undefined };
}

/** A Stream thumbnail drawn at the home's size (78 px wide, twice over for the phone), not the video's */
function small(src?: string): string | undefined {
  if (!src || !src.includes('cloudflarestream.com')) return src;
  const url = new URL(src);
  url.searchParams.set('height', '320');
  return url.toString();
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default function AdminHome() {
  const router = useRouter();
  const pathname = usePathname() || '/admin';
  const params = useSearchParams();
  const tool = params.get('tool');
  const [fixtures] = useState(devFixtures);
  const [now, setNow] = useState(() => fixtures.now || new Date());
  const [facts, setFacts] = useState<HomeFacts | null>(null);
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState(false);
  const site = useSite();

  const read = useCallback(async () => {
    try {
      if (fixtures.on) {
        setFacts((await (await fetch('/_dev/home-fixtures.json')).json()) as HomeFacts);
        return;
      }
      const { since, until } = dayBounds(new Date());
      const res = await fetch(`/api/admin/home?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`, { cache: 'no-store' });
      // Not signed in here (or not an admin): ask for the sign-in, and come back after it
      if (res.status === 401 || res.status === 403) {
        window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (!res.ok) throw new Error(`api/admin/home answered ${res.status}`);
      setFacts((await res.json()) as HomeFacts);
      setFailed(false);
    } catch (err) {
      console.error('[AdminHome] The facts did not load:', err);
      setFailed(true);
    }
  }, [fixtures.on]);

  // Read now, again every few minutes, and whenever the phone comes back to the page
  useEffect(() => {
    void read();
    const t = setInterval(() => {
      if (!fixtures.now) setNow(new Date());
      void read();
    }, READ_EVERY_MS);
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      if (!fixtures.now) setNow(new Date());
      void read();
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', back);
    };
  }, [read, fixtures.now]);

  // A room opened from here is one step in the history, so × and the phone's back both return home;
  // a tool opened from inside a room (the Dashboard's links) takes the room's place
  const openedHere = useRef(false);
  const openTool = useCallback(
    (tab: string) => {
      setMenu(false);
      const to = `${pathname}?tool=${encodeURIComponent(tab)}`;
      if (tool) router.replace(to);
      else {
        openedHere.current = true;
        router.push(to);
      }
    },
    [router, pathname, tool],
  );
  const closeTool = useCallback(() => {
    if (openedHere.current) router.back();
    else router.replace(pathname);
    openedHere.current = false;
  }, [router, pathname]);
  // The menu and a room close with Escape, as with ×
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menu) setMenu(false);
      else if (tool) closeTool();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, tool, closeTool]);

  const signOut = () => {
    clearSignIn();
    sessionStorage.removeItem('me.cache');
    sessionStorage.removeItem('me.cache.ts');
    window.location.href = '/login';
  };

  return (
    <div className="studio fixed inset-0 z-40 overflow-y-auto">
      <TopBar
        action={
          <button type="button" onClick={() => setMenu(true)} aria-label="Everything else" className="w-11 h-11 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
        }
      />

      <main className="max-w-lg mx-auto pb-[calc(24px+env(safe-area-inset-bottom))]">
        <Today facts={facts} failed={failed} now={now} />

        <nav aria-label="Your jobs">
          <Row label="Inbox" href="/admin/inbox" fact={facts?.inbox == null ? null : facts.inbox > 0 ? `${facts.inbox} new` : 'Nothing new'} hot={!!facts?.inbox} />
          <Row label="Store" onClick={() => openTool('orders')} fact={facts?.orders == null ? null : facts.orders > 0 ? `${plural(facts.orders, 'order')} this week` : 'No orders this week'} />
          <Row label="Levels" href={`${site}/levels`} away fact={facts?.levels == null ? null : `${facts.levels} out`} />
          <Row
            label="Links"
            onClick={() => openTool('links')}
            fact={!facts?.featured ? null : facts.featured.title || (facts.featured.missing ? 'Not in the store' : 'Nothing first')}
            hot={!!facts?.featured?.missing}
          />
          <Row label="Release" href="/admin/release" fact={!facts ? null : facts.release ? `${facts.release.title}${facts.release.more ? ` +${facts.release.more}` : ''}` : 'Nothing on the floor'} />
        </nav>
      </main>

      {menu && <Menu site={site} onClose={() => setMenu(false)} onTool={openTool} onSignOut={signOut} />}

      {/* a tool of the old admin, as it was, over the home */}
      {tool && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0d0c0a] text-[#ede8df]" role="dialog" aria-modal="true" aria-label={ROOM_TITLE[tool] || tool}>
          <header className="flex-shrink-0 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] border-b border-white/10">
            <span className="text-[13px] tracking-[0.3em] uppercase min-h-[52px] flex items-center">{ROOM_TITLE[tool] || tool}</span>
            <button type="button" onClick={closeTool} aria-label="Close" className="w-11 h-11 -mr-2 flex items-center justify-center text-2xl">
              ×
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <UserProvider>
              <TabContent activeTab={tool} onSetActiveTab={openTool} />
            </UserProvider>
          </div>
        </div>
      )}
    </div>
  );
}

/** The top bar, as in the Studio: the danceman and the name, one action on the right */
function TopBar({ action }: { action: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-[var(--ground)] flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] border-b border-[var(--rule)]">
      <span className="min-h-[52px] flex items-center gap-2">
        <Mark src={ODUBO_MARK} className="h-7" style={{ aspectRatio: ODUBO_MARK_ASPECT }} colour="var(--accent)" label="Odubo" />
        <span className="studio-house text-[17px] tracking-[0.02em]">Odubo Studio</span>
      </span>
      <div className="-mr-2">{action}</div>
    </header>
  );
}

/** Today's next post, the one button, and the day as a rail */
function Today({ facts, failed, now }: { facts: HomeFacts | null; failed: boolean; now: Date }) {
  const posts = facts?.posts;
  const campaigns = facts?.campaigns;
  const { post, day } = useMemo(() => {
    if (!posts) return { post: null, day: [] as QueuePost[] };
    const q = queueOf(posts, now);
    // The same post the Studio's Today opens on
    const next = [...q.due, ...q.later, ...q.unplanned].find((p) => !allPlatformsDone(p)) || null;
    const today = dayKey(now.toISOString());
    const todays = posts
      .filter((p) => p.scheduled_at && dayKey(p.scheduled_at) === today)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    return { post: next, day: todays };
  }, [posts, now]);

  if (!facts && !failed) {
    return (
      <section className="px-4 pt-5 pb-4 border-b border-[var(--rule)] min-h-[214px] flex items-center justify-center" aria-busy="true">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--rule)] border-t-[var(--text)] animate-spin" />
      </section>
    );
  }

  if (!post) {
    return (
      <section className="px-4 pt-5 pb-4 border-b border-[var(--rule)] grid gap-4">
        <p className="studio-eyebrow">{dayLabel(now.toISOString(), now)}</p>
        <p className="studio-display text-3xl">{facts ? 'Nothing to post.' : 'Today did not load.'}</p>
        <Pill href="/admin/social-studio">Studio</Pill>
      </section>
    );
  }

  const campaign = campaigns?.find((c) => c.id === post.campaign_id);
  const colour = campaign?.color || 'var(--raised)';
  return (
    <section className="px-4 pt-5 pb-4 border-b border-[var(--rule)] grid gap-4">
      <p className="studio-eyebrow">{post.scheduled_at ? dayLabel(post.scheduled_at, now) : 'No date'}</p>
      <div className="grid grid-cols-[78px_1fr] gap-4 items-center">
        <Thumb src={small(post.thumbnail_url)} colour={colour} className="w-[78px]" eager />
        <div className="min-w-0">
          <p className="studio-display text-[40px] leading-none tabular-nums">{post.scheduled_at ? timeLabel(post.scheduled_at) : '—'}</p>
          <p className="studio-display text-[17px] mt-1.5 truncate">{campaign?.name || post.title || post.caption}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--text-muted)]">
            <span>{KIND_LABEL[kindOf(post)]}</span>
            <Marks post={post} />
          </p>
        </div>
      </div>
      <Pill href={`/admin/social-studio?post=${encodeURIComponent(post.id)}`}>Post</Pill>
      {day.length > 1 && <Rail posts={day} current={post.id} />}
    </section>
  );
}

/** The one drawn shape on the page */
function Pill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="studio-display flex items-center justify-center min-h-[52px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[19px] tracking-[0.02em] active:scale-[0.98] transition-transform"
    >
      {children}
    </Link>
  );
}

/** The day's posts in time order: filled when out, ringed for the one up now. Each opens in the Studio. */
function Rail({ posts, current }: { posts: QueuePost[]; current: string }) {
  return (
    <ol className="relative flex" aria-label="Today's posts">
      <span aria-hidden className="absolute top-[22px] border-t border-[var(--rule)]" style={{ left: `${50 / posts.length}%`, right: `${50 / posts.length}%` }} />
      {posts.map((p) => {
        const out = p.status === 'published' || allPlatformsDone(p);
        const now = p.id === current;
        const time = timeLabel(p.scheduled_at!);
        return (
          <li key={p.id} className="flex-1 min-w-0">
            <Link
              href={`/admin/social-studio?post=${encodeURIComponent(p.id)}`}
              aria-label={`${time}, ${out ? 'out' : now ? 'up now' : 'later'}`}
              aria-current={now ? 'true' : undefined}
              className="relative flex flex-col items-center gap-1 min-h-[44px] pt-4"
            >
              <span
                aria-hidden
                className={`block w-[13px] h-[13px] rounded-full ${
                  out ? 'bg-[var(--ok)] border-[1.5px] border-[var(--ok)]' : now ? 'bg-[var(--ground)] border-[3px] border-[var(--accent)]' : 'bg-[var(--ground)] border-[1.5px] border-[var(--rule)]'
                }`}
              />
              <span className={`text-xs tabular-nums ${now ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-muted)]'}`}>{time}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** One of his jobs: the name, its one fact, and where it goes */
function Row({ label, fact, hot, href, away, onClick }: { label: string; fact: string | null; hot?: boolean; href?: string; away?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="studio-display text-[22px]">{label}</span>
      <span className={`flex items-center gap-2 text-sm tabular-nums text-right min-w-0 ${hot ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)]'}`}>
        <span className="truncate">{fact}</span>
        {away ? (
          <span aria-hidden className="text-[13px] opacity-70">↗</span>
        ) : (
          <svg viewBox="0 0 8 13" className="w-2 h-[13px] flex-shrink-0 opacity-70" aria-hidden>
            <path d="M1 1l5.5 5.5L1 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        )}
      </span>
    </>
  );
  const className = 'w-full flex items-center justify-between gap-3 min-h-[58px] px-4 border-b border-[var(--rule)] text-left';
  if (href && away) return <a href={href} className={className}>{body}</a>;
  if (href) return <Link href={href} className={className}>{body}</Link>;
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

/** Every other tool, grouped, two to a line */
function Menu({ site, onClose, onTool, onSignOut }: { site: string; onClose: () => void; onTool: (tab: string) => void; onSignOut: () => void }) {
  const item = 'min-h-[44px] flex items-center studio-display !font-medium text-[17px] text-left';
  const out = <span aria-hidden className="ml-1 text-[13px] text-[var(--text-muted)]">↗</span>;
  return (
    <div className="studio fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Everything else">
      <TopBar
        action={
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        }
      />
      <div className="max-w-lg mx-auto px-4 pt-1 pb-[calc(20px+env(safe-area-inset-bottom))]">
        {MENU.map((g, i) => (
          <section key={g.group} className={`pt-3 pb-2 ${i ? 'border-t border-[var(--rule)]' : ''}`}>
            <h2 className="studio-eyebrow">{g.group}</h2>
            <div className="grid grid-cols-2 gap-x-3">
              {g.tools.map((t) =>
                'tab' in t ? (
                  <button key={t.label} type="button" onClick={() => onTool(t.tab)} className={item}>
                    {t.label}
                  </button>
                ) : 'page' in t ? (
                  <Link key={t.label} href={t.page} className={item}>
                    {t.label}
                  </Link>
                ) : 'site' in t ? (
                  <a key={t.label} href={`${site}${t.site}`} className={item}>
                    {t.label}
                    {out}
                  </a>
                ) : (
                  <a key={t.label} href={t.url} target="_blank" rel="noopener noreferrer" className={item}>
                    {t.label}
                    {out}
                  </a>
                ),
              )}
            </div>
          </section>
        ))}
        <div className="mt-2 flex justify-between border-t border-[var(--text)] pt-1 text-sm text-[var(--text-muted)]">
          <a href={`${site}/`} className="min-h-[44px] flex items-center">
            View the site<span aria-hidden className="ml-1">↗</span>
          </a>
          <button type="button" onClick={onSignOut} className="min-h-[44px]">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
