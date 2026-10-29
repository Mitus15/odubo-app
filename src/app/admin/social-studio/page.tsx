'use client';

import { useState, useEffect, useCallback, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { allPlatformsDone, queueOf, withPlatformMark, type PlatformMark } from '@/lib/social/postQueue';
import { ODUBO_MARK, ODUBO_MARK_ASPECT, ODUBO_SEAL } from '@/lib/brand/marks';
import TodayView, { type SendDetails } from './components/TodayView';
import ScheduleView from './components/ScheduleView';
import { Mark } from './components/parts';
import LibraryView from './components/LibraryView';

/**
 * The Social Studio: where the week's posts are made, on his phone.
 *
 * Three tabs. Today is the front door (the next post, ready to go out),
 * Schedule is every planned post day by day, Library is every clip song by
 * song. The rest (a new post, the month, the Post for Me dashboard, settings)
 * is in the menu, for releases planned here rather than posted by hand.
 *
 * Connected to the apps through Post for Me: on opening it reads what is
 * live on Instagram, TikTok and YouTube and ticks what he posted
 * (api/social/feeds), and a full song can be scheduled on YouTube, or a clip
 * sent to his TikTok drafts, from Today (api/social/posts/[id]/send).
 *
 * In development, ?fixtures loads public/_dev/studio-fixtures.json instead of
 * the live posts (git-ignored; nothing is written), and &now=<ISO> sets the
 * clock, to see a day before it comes.
 */

// =============================================================================
// TYPES
// =============================================================================

export type StudioView = 'today' | 'schedule' | 'library' | 'create' | 'calendar' | 'settings' | 'home' | 'post';

export interface Post {
  id: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  title?: string;
  caption?: string;
  caption_by_platform?: Record<string, string>;
  hashtags?: string[];
  notes?: string;
  tags?: string[];
  platform_status?: Record<string, unknown>;
  media_type: 'video' | 'image';
  media_url: string;
  thumbnail_url?: string;
  platforms: string[];
  account_ids?: string[];
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
  campaign_id?: string;
  slot_id?: string;
  postforme_status?: string;
  last_synced_at?: string;
  error_message?: string;
}

export interface Account {
  id: string;
  platform: string;
  account_handle: string;
  account_name?: string;
  profile_image_url?: string;
  is_active: boolean;
  postforme_account_id?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  color?: string;
  status: 'active' | 'completed' | 'archived';
  post_count: number;
}

export interface PostingSlot {
  id: string;
  day_of_week: number | null;
  time: string;
  timezone: string;
  platforms: string[];
  is_active: boolean;
  label?: string;
}

export interface DashboardData {
  today: Post[];
  attention: {
    failed: Post[];
    emptySlots: number;
    pending: Post[];
  };
  weekStats: {
    views: number;
    likes: number;
    engagement: number;
    topPost: Post | null;
  };
  upcoming: Post[];
}

type Tab = 'today' | 'schedule' | 'library';
type Room = 'create' | 'calendar' | 'dashboard' | 'settings';

interface AppsCheck {
  at?: string;
  busy?: boolean;
  apps?: Record<string, { ok: boolean; error?: string }>;
  error?: string;
}

// =============================================================================
// DYNAMIC IMPORTS (Code Splitting): the three tabs load with the page, so a
// tab opens at once; the back rooms load when one is opened
// =============================================================================

const HomeView = dynamic(() => import('./components/HomeView'), { loading: () => <ViewLoading /> });
const CalendarView = dynamic(() => import('./components/CalendarView'), { loading: () => <ViewLoading /> });
const CreateFlow = dynamic(() => import('./components/CreateFlow'), { loading: () => <ViewLoading /> });
const SettingsView = dynamic(() => import('./components/SettingsView'), { loading: () => <ViewLoading /> });
const PostDetailSheet = dynamic(() => import('./components/PostDetailSheet'));

function ViewLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--rule,#6b3a2b)] border-t-[var(--text,#f0d3ad)] animate-spin" />
    </div>
  );
}

/** How long a check of the apps holds before opening the Studio checks again */
const APPS_CHECK_EVERY_MS = 10 * 60 * 1000;
const APPS_CHECKED_KEY = 'studio:apps-checked';

const ROOM_TITLE: Record<Room, string> = {
  create: 'New post',
  calendar: 'Month',
  dashboard: 'Post for Me',
  settings: 'Settings',
};

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  {
    key: 'today',
    label: 'Today',
    // the seal, the player marker: you are up
    icon: <Mark src={ODUBO_SEAL} className="w-6 h-6" colour="currentColor" />,
  },
  {
    key: 'schedule',
    label: 'Schedule',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
        <path d="M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10" />
      </svg>
    ),
  },
  {
    key: 'library',
    label: 'Library',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <rect x="4" y="3" width="7" height="11" rx="1" />
        <rect x="13" y="3" width="7" height="11" rx="1" />
        <rect x="4" y="16" width="7" height="5" rx="1" />
        <rect x="13" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
];

function devFixtures(): { on: boolean; now?: Date } {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return { on: false };
  const q = new URLSearchParams(window.location.search);
  const at = q.get('now');
  return { on: q.has('fixtures'), now: at ? new Date(at) : undefined };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SocialStudioPage() {
  const [tab, setTab] = useState<Tab>('today');
  const [room, setRoom] = useState<Room | null>(null);
  const [menu, setMenu] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [slots, setSlots] = useState<PostingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [createForSlot, setCreateForSlot] = useState<{ date: string; time: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fixtures] = useState(devFixtures);
  const [now, setNow] = useState(() => fixtures.now || new Date());
  const [check, setCheck] = useState<AppsCheck>({});
  // The preview label only after the first paint: the server cannot know the query
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // A post asked for by the link (the admin home's Post: ?post=<id>) opens first
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('post');
    if (id) setOpenId(id);
  }, []);

  // The clock moves on, so what is due today moves with it
  useEffect(() => {
    if (fixtures.now) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [fixtures.now]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (fixtures.on) {
        const data = (await (await fetch('/_dev/studio-fixtures.json')).json()) as {
          posts: Post[];
          campaigns: Campaign[];
          accounts?: Account[];
        };
        setPosts(data.posts);
        setCampaigns(data.campaigns);
        setAccounts(data.accounts || []);
        return;
      }
      const [postsRes, accountsRes, campaignsRes, slotsRes] = await Promise.all([
        fetch('/api/social/posts?limit=1000'), // every post: the views filter by date themselves
        fetch('/api/social/accounts'),
        fetch('/api/social/studio/campaigns'),
        fetch('/api/social/studio/slots'),
      ]);

      // Not signed in here (or not an admin): the server keeps the posts back, so ask for
      // the sign-in instead of showing an empty Studio, and come back after it.
      if (postsRes.status === 401 || postsRes.status === 403) {
        window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (postsRes.ok) setPosts(((await postsRes.json()) as { posts?: Post[] }).posts || []);
      if (accountsRes.ok) setAccounts(((await accountsRes.json()) as { accounts?: Account[] }).accounts || []);
      if (campaignsRes.ok) setCampaigns(((await campaignsRes.json()) as { campaigns?: Campaign[] }).campaigns || []);
      if (slotsRes.ok) setSlots(((await slotsRes.json()) as { slots?: PostingSlot[] }).slots || []);
    } catch (err) {
      console.error('[SocialStudio] Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [fixtures.on]);

  // What went out on the apps: read their feeds and tick what he posted
  const checkApps = useCallback(async () => {
    if (fixtures.on) return;
    setCheck((c) => ({ ...c, busy: true }));
    try {
      const res = await fetch('/api/social/feeds', { method: 'POST' });
      const data = (await res.json()) as { checkedAt?: string; apps?: AppsCheck['apps']; updated?: number; error?: string };
      if (!res.ok) throw new Error(data.error || `The check did not run (${res.status})`);
      setCheck({ at: data.checkedAt, apps: data.apps });
      try {
        localStorage.setItem(APPS_CHECKED_KEY, data.checkedAt || new Date().toISOString());
      } catch {
        // storage unavailable: the next open checks again
      }
      if (data.updated) await fetchData();
    } catch (e) {
      setCheck({ error: (e as Error).message });
    }
  }, [fixtures.on, fetchData]);

  // Sync all posts from Post for Me (the dashboard's button)
  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch('/api/social/accounts/sync', { method: 'POST' });
      await fetch('/api/cron/social-sync', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('[SocialStudio] Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData().then(() => {
      let last = 0;
      try {
        last = new Date(localStorage.getItem(APPS_CHECKED_KEY) || 0).getTime();
      } catch {
        // storage unavailable: check now
      }
      if (Date.now() - last > APPS_CHECK_EVERY_MS) checkApps();
    });
  }, [fetchData, checkApps]);

  const replace = (next: Post) => setPosts((all) => all.map((p) => (p.id === next.id ? next : p)));

  // A tick by hand (or an Undo): saved on the post, at once on screen
  const onMark = useCallback(
    async (post: Post, platform: string, posted: boolean) => {
      const status = withPlatformMark(post.platform_status, platform, posted, new Date().toISOString());
      const finished = allPlatformsDone({ platforms: post.platforms, platform_status: status });
      const next: Post = { ...post, platform_status: status, ...(finished ? { status: 'published', published_at: new Date().toISOString() } : {}) };
      replace(next);
      if (fixtures.on) return true;
      try {
        const res = await fetch(`/api/social/posts/${post.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            finished ? { platform_status: status, status: 'published', published_at: next.published_at } : { platform_status: status },
          ),
        });
        if (!res.ok) throw new Error(String(res.status));
        return true;
      } catch {
        replace(post);
        return false;
      }
    },
    [fixtures.on],
  );

  // A send to the app through Post for Me (a YouTube upload, a TikTok draft)
  const onSend = useCallback(
    async (post: Post, platform: string, details?: SendDetails) => {
      if (fixtures.on) {
        replace({ ...post, platform_status: { ...post.platform_status, [platform]: { posted: false, sent: platform === 'youtube' ? 'scheduled' : 'draft', for: post.scheduled_at } } });
        return { ok: true };
      }
      try {
        const res = await fetch(`/api/social/posts/${post.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, ...details }),
        });
        const data = (await res.json()) as { ok?: boolean; mark?: PlatformMark; error?: string };
        if (data.mark) replace({ ...post, platform_status: { ...post.platform_status, [platform]: data.mark } });
        return { ok: res.ok, error: data.error };
      } catch {
        return { ok: false, error: 'The Studio could not reach the server. Try again.' };
      }
    },
    [fixtures.on],
  );

  const open = (id: string | null) => {
    setOpenId(id);
    setTab('today');
  };

  const go = (view: StudioView) => {
    setMenu(false);
    if (view === 'today' || view === 'schedule' || view === 'library') {
      setRoom(null);
      setTab(view);
    } else if (view === 'post' || view === 'home') {
      setRoom(null);
      setTab('today');
    } else {
      setRoom(view === 'create' ? 'create' : view === 'calendar' ? 'calendar' : 'settings');
    }
  };

  const dueCount = queueOf(posts, now).due.length;

  const renderRoom = (r: Room) => {
    switch (r) {
      case 'create':
        return (
          <CreateFlow
            accounts={accounts}
            campaigns={campaigns}
            slots={slots}
            prefillSlot={createForSlot}
            onComplete={() => {
              setCreateForSlot(null);
              setRoom(null);
              fetchData();
            }}
            onCancel={() => {
              setCreateForSlot(null);
              setRoom(null);
            }}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            posts={posts}
            slots={slots}
            onViewPost={setSelectedPostId}
            onCreateForSlot={(date, time) => {
              setCreateForSlot({ date, time });
              setRoom('create');
            }}
          />
        );
      case 'dashboard':
        return (
          <HomeView
            posts={posts}
            accounts={accounts}
            slots={slots}
            loading={loading}
            syncing={syncing}
            onSync={syncAll}
            onViewPost={setSelectedPostId}
            onCreateForSlot={(date, time) => {
              setCreateForSlot({ date, time });
              setRoom('create');
            }}
            onNavigate={go}
          />
        );
      case 'settings':
        return <SettingsView accounts={accounts} campaigns={campaigns} slots={slots} onRefresh={fetchData} />;
    }
  };

  return (
    <div className="studio fixed inset-0 z-40 flex flex-col">
      {/* the top bar: the name, a new post, the menu */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] border-b border-[var(--rule)]">
        <span className="min-h-[52px] flex items-center gap-2">
          {/* the danceman goes home, as on every admin page */}
          <Link href="/admin" aria-label="Home" className="min-h-[44px] min-w-[44px] -ml-2 pl-2 flex items-center">
            <Mark src={ODUBO_MARK} className="h-7" style={{ aspectRatio: ODUBO_MARK_ASPECT }} colour="var(--accent)" />
          </Link>
          <span className="studio-house text-[17px] tracking-[0.02em]">Studio</span>
          {mounted && fixtures.on && <span className="text-xs text-[var(--warn)]">preview</span>}
        </span>
        <div className="flex items-center -mr-2">
          <button type="button" onClick={() => go('create')} aria-label="New post" className="w-11 h-11 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button type="button" onClick={() => setMenu(true)} aria-label="Menu" className="w-11 h-11 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        <Suspense fallback={<ViewLoading />}>
          {tab === 'today' && (
            <TodayView
              posts={posts}
              campaigns={campaigns}
              loading={loading}
              now={now}
              openId={openId}
              onOpen={setOpenId}
              onMark={onMark}
              onSend={onSend}
              onDetails={setSelectedPostId}
              onSchedule={() => setTab('schedule')}
            />
          )}
          {tab === 'schedule' && <ScheduleView posts={posts} campaigns={campaigns} now={now} onOpen={open} />}
          {tab === 'library' && <LibraryView posts={posts} campaigns={campaigns} now={now} onOpen={open} />}
        </Suspense>
      </main>

      {/* the three tabs */}
      <nav className="flex-shrink-0 border-t border-[var(--rule)] pb-[env(safe-area-inset-bottom)]" aria-label="Studio">
        <div className="flex max-w-lg mx-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => go(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={`relative flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 ${tab === t.key ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
            >
              {t.icon}
              <span className={`text-[11px] ${tab === t.key ? 'font-semibold' : ''}`}>{t.label}</span>
              {t.key === 'today' && dueCount > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--text)] text-[var(--ground)] text-[10px] font-semibold flex items-center justify-center">
                  {dueCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* the menu */}
      {menu && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Menu" onClick={() => setMenu(false)}>
          <div className="studio w-full sm:max-w-sm bg-[var(--ground)] px-4 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button type="button" onClick={() => setMenu(false)} aria-label="Close" className="w-11 h-11 -mr-2 flex items-center justify-center text-xl">
                ×
              </button>
            </div>
            <button type="button" onClick={checkApps} disabled={check.busy || fixtures.on} className="w-full text-left py-3 border-b border-[var(--rule)] min-h-[56px] disabled:opacity-60">
              <span className="studio-display block text-lg">{check.busy ? 'Checking the apps…' : 'Check the apps now'}</span>
              <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                {check.error
                  ? check.error
                  : check.apps
                  ? Object.entries(check.apps)
                      .map(([p, a]) => `${p[0].toUpperCase()}${p.slice(1)} ${a.ok ? '✓' : `: ${a.error}`}`)
                      .join(' · ')
                  : check.at
                  ? `Checked ${new Date(check.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Ticks what you posted, with its link and views'}
              </span>
            </button>
            {(['create', 'calendar', 'dashboard', 'settings'] as Room[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setMenu(false);
                  setRoom(r);
                }}
                className="studio-display w-full text-left text-lg py-3 border-b border-[var(--rule)] last:border-0 min-h-[52px]"
              >
                {ROOM_TITLE[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* the back rooms: the tools for planned releases, as they were */}
      {room && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
          <header className="flex-shrink-0 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] border-b border-white/10">
            <span className="text-[13px] tracking-[0.3em] uppercase min-h-[52px] flex items-center">{ROOM_TITLE[room]}</span>
            <button type="button" onClick={() => setRoom(null)} aria-label="Close" className="w-11 h-11 -mr-2 flex items-center justify-center text-2xl">
              ×
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-hidden">
            <Suspense fallback={<ViewLoading />}>{renderRoom(room)}</Suspense>
          </div>
        </div>
      )}

      {selectedPostId && (
        <Suspense fallback={null}>
          <PostDetailSheet postId={selectedPostId} accounts={accounts} onClose={() => setSelectedPostId(null)} onRefresh={fetchData} />
        </Suspense>
      )}
    </div>
  );
}
