'use client';

import { useMemo } from 'react';
import type { Post, Account, PostingSlot, StudioView } from '../page';

// =============================================================================
// TYPES
// =============================================================================

interface HomeViewProps {
  posts: Post[];
  accounts: Account[];
  slots: PostingSlot[];
  loading: boolean;
  syncing: boolean;
  onSync: () => void;
  onViewPost: (postId: string) => void;
  onCreateForSlot: (date: string, time: string) => void;
  onNavigate: (view: StudioView) => void;
}

// =============================================================================
// PLATFORM ICONS
// =============================================================================

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📷',
  tiktok: '📱',
  youtube: '▶️',
  facebook: '👤',
  threads: '🧵',
  twitter: '🐦',
  linkedin: '💼',
  pinterest: '📌',
  bluesky: '🦋',
};

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-500';
    case 'published':
      return 'bg-emerald-500';
    case 'failed':
      return 'bg-red-500';
    case 'publishing':
      return 'bg-purple-500';
    default:
      return 'bg-[#726d6c]';
  }
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  sync: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function HomeView({
  posts,
  accounts,
  slots,
  loading,
  syncing,
  onSync,
  onViewPost,
  onCreateForSlot,
  onNavigate,
}: HomeViewProps) {
  // Calculate dashboard data
  const dashboardData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    // Today's posts
    const today = posts.filter((p) => {
      if (!p.scheduled_at) return false;
      const date = new Date(p.scheduled_at);
      return date >= todayStart && date < todayEnd;
    });

    // Failed posts
    const failed = posts.filter((p) => p.status === 'failed');

    // Pending approval
    const pending = posts.filter((p) => p.status === 'draft');

    // Upcoming posts (next 7 days, excluding today)
    const upcoming = posts
      .filter((p) => {
        if (!p.scheduled_at || p.status === 'published' || p.status === 'failed') return false;
        const date = new Date(p.scheduled_at);
        return date >= todayEnd && date < weekEnd;
      })
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      .slice(0, 7);

    // Calculate empty slots this week
    const activeSlots = slots.filter((s) => s.is_active);
    const slotsPerWeek = activeSlots.length * 7;
    const scheduledThisWeek = posts.filter((p) => {
      if (!p.scheduled_at) return false;
      const date = new Date(p.scheduled_at);
      return date >= todayStart && date < weekEnd && p.status === 'scheduled';
    }).length;
    const emptySlots = Math.max(0, slotsPerWeek - scheduledThisWeek);

    // Week stats (mock for now - would come from analytics)
    const weekStats = {
      views: 12400,
      likes: 847,
      engagement: 2.8,
      topPost: posts.find((p) => p.status === 'published') || null,
    };

    return {
      today,
      attention: { failed, emptySlots, pending },
      weekStats,
      upcoming,
    };
  }, [posts, slots]);

  const { today, attention, weekStats, upcoming } = dashboardData;
  const hasAttention = attention.failed.length > 0 || attention.emptySlots > 0 || attention.pending.length > 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#D4A853]/30 border-t-[#D4A853] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#726d6c]">Loading your studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Social Studio</h1>
            <p className="text-sm text-[#726d6c] mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a1a1a] text-[#D4A853] text-sm font-medium hover:bg-[#252525] active:bg-[#1a1a1a] transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <span className={syncing ? 'animate-spin' : ''}>{Icons.sync}</span>
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {/* Today's Posts */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#D4A853] uppercase tracking-wide">Today</h2>
            {today.length > 0 && (
              <span className="text-xs text-[#726d6c]">{today.length} post{today.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {today.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {today.map((post) => (
                <button
                  key={post.id}
                  onClick={() => onViewPost(post.id)}
                  className="flex-shrink-0 w-28 p-3 rounded-xl bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors text-left"
                >
                  <div className="text-xs text-[#D4A853] font-medium mb-2">
                    {formatTime(post.scheduled_at!)}
                  </div>
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#252525] mb-2">
                    {post.thumbnail_url ? (
                      <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        {post.media_type === 'video' ? '🎬' : '📷'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {post.platforms.slice(0, 2).map((p) => (
                      <span key={p} className="text-xs">{PLATFORM_ICONS[p] || '📱'}</span>
                    ))}
                    {post.platforms.length > 2 && (
                      <span className="text-[10px] text-[#726d6c]">+{post.platforms.length - 2}</span>
                    )}
                  </div>
                </button>
              ))}

              {/* Add Post Button */}
              <button
                onClick={() => onNavigate('create')}
                className="flex-shrink-0 w-28 p-3 rounded-xl border-2 border-dashed border-[#252525] hover:border-[#D4A853]/30 transition-colors flex flex-col items-center justify-center text-[#726d6c] hover:text-[#D4A853]"
              >
                {Icons.plus}
                <span className="text-xs mt-1">Add</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('create')}
              className="w-full p-6 rounded-xl border-2 border-dashed border-[#252525] hover:border-[#D4A853]/30 transition-colors text-center"
            >
              <div className="text-3xl mb-2">📅</div>
              <p className="text-sm text-[#726d6c]">Nothing scheduled for today</p>
              <p className="text-xs text-[#D4A853] mt-1">Tap to create a post</p>
            </button>
          )}
        </section>

        {/* Needs Attention */}
        {hasAttention && (
          <section className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 to-red-950/40 border border-amber-900/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-400">{Icons.alert}</span>
              <h2 className="text-sm font-semibold text-amber-400">Needs Attention</h2>
            </div>

            <div className="space-y-2">
              {attention.failed.length > 0 && (
                <button
                  onClick={() => onViewPost(attention.failed[0].id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-black/30 text-left hover:bg-black/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm text-white">
                      {attention.failed.length} failed post{attention.failed.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {Icons.chevronRight}
                </button>
              )}

              {attention.emptySlots > 0 && (
                <button
                  onClick={() => onNavigate('calendar')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-black/30 text-left hover:bg-black/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm text-white">
                      {attention.emptySlots} empty slot{attention.emptySlots !== 1 ? 's' : ''} this week
                    </span>
                  </div>
                  {Icons.chevronRight}
                </button>
              )}

              {attention.pending.length > 0 && (
                <button
                  onClick={() => onNavigate('library')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-black/30 text-left hover:bg-black/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm text-white">
                      {attention.pending.length} draft{attention.pending.length !== 1 ? 's' : ''} to finish
                    </span>
                  </div>
                  {Icons.chevronRight}
                </button>
              )}
            </div>
          </section>
        )}

        {/* Week Stats */}
        <section className="p-4 rounded-xl bg-[#1a1a1a] border border-[#252525]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#D4A853]">{Icons.chart}</span>
            <h2 className="text-sm font-semibold text-white">This Week</h2>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{formatNumber(weekStats.views)}</div>
              <div className="text-xs text-[#726d6c]">Views</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{formatNumber(weekStats.likes)}</div>
              <div className="text-xs text-[#726d6c]">Likes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{weekStats.engagement}%</div>
              <div className="text-xs text-[#726d6c]">Engage</div>
            </div>
          </div>

          {weekStats.topPost && (
            <button
              onClick={() => onViewPost(weekStats.topPost!.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#252525] hover:bg-[#2a2a2a] transition-colors"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1a1a1a] flex-shrink-0">
                {weekStats.topPost.thumbnail_url ? (
                  <img src={weekStats.topPost.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">🎬</div>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs text-[#D4A853]">Top Performer</div>
                <div className="text-sm text-white truncate">
                  {weekStats.topPost.title || weekStats.topPost.caption?.slice(0, 30) || 'Untitled'}
                </div>
              </div>
              {Icons.chevronRight}
            </button>
          )}
        </section>

        {/* Upcoming */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[#D4A853]">{Icons.calendar}</span>
              <h2 className="text-sm font-semibold text-white">Upcoming</h2>
            </div>
            <button
              onClick={() => onNavigate('calendar')}
              className="text-xs text-[#D4A853] hover:text-[#E5B863] transition-colors"
            >
              View All →
            </button>
          </div>

          {upcoming.length > 0 ? (
            <div className="space-y-2">
              {upcoming.map((post) => (
                <button
                  key={post.id}
                  onClick={() => onViewPost(post.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#252525] flex-shrink-0">
                    {post.thumbnail_url ? (
                      <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        {post.media_type === 'video' ? '🎬' : '📷'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {post.title || post.caption?.slice(0, 30) || 'Untitled'}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(post.status)}`} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#726d6c]">
                        {formatDate(post.scheduled_at!)}
                      </span>
                      <span className="text-xs text-[#D4A853]">
                        {formatTime(post.scheduled_at!)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {post.platforms.slice(0, 3).map((p) => (
                      <span key={p} className="text-sm">{PLATFORM_ICONS[p] || '📱'}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[#1a1a1a] border border-[#252525] text-center">
              <p className="text-sm text-[#726d6c]">No posts scheduled this week</p>
              <button
                onClick={() => onNavigate('create')}
                className="mt-2 text-xs text-[#D4A853] hover:text-[#E5B863] transition-colors"
              >
                Schedule your first post →
              </button>
            </div>
          )}
        </section>

        {/* Connected Accounts Summary */}
        {accounts.length > 0 && (
          <section className="p-4 rounded-xl bg-[#1a1a1a] border border-[#252525]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Connected Accounts</h2>
              <button
                onClick={() => onNavigate('settings')}
                className="text-xs text-[#D4A853] hover:text-[#E5B863] transition-colors"
              >
                Manage →
              </button>
            </div>

            <div className="flex items-center gap-2">
              {accounts.filter((a) => a.is_active).slice(0, 5).map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#252525]"
                  title={`@${account.account_handle}`}
                >
                  <span className="text-sm">{PLATFORM_ICONS[account.platform] || '📱'}</span>
                  <span className="text-xs text-white truncate max-w-[80px]">@{account.account_handle}</span>
                </div>
              ))}
              {accounts.filter((a) => a.is_active).length > 5 && (
                <span className="text-xs text-[#726d6c]">+{accounts.filter((a) => a.is_active).length - 5} more</span>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
