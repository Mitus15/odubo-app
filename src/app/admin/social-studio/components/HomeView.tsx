'use client';

import { useMemo, useState } from 'react';
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
      return 'bg-blue-500/80';
    case 'published':
      return 'bg-emerald-500/80';
    case 'failed':
      return 'bg-red-500/80';
    case 'publishing':
      return 'bg-purple-500/80';
    default:
      return 'bg-[#5a5554]';
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
  lightning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
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
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{ published: number; failed: number } | null>(null);

  // Handle manual post processing
  const handleProcessScheduled = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const response = await fetch('/api/social/posts/process-scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to process scheduled posts');
      }

      const data = await response.json() as { published: number; failed: number };
      setProcessResult(data);

      // Refresh the posts after processing
      if (data.published > 0) {
        setTimeout(() => {
          onSync();
        }, 1000);
      }

      // Clear result after 5 seconds
      setTimeout(() => {
        setProcessResult(null);
      }, 5000);
    } catch (error) {
      console.error('[HomeView] Process scheduled error:', error);
      alert('Failed to process scheduled posts');
    } finally {
      setProcessing(false);
    }
  };

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

    const weekStats = null;

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
          <div className="w-10 h-10 border-2 border-[#D4A853]/20 border-t-[#D4A853] rounded-full animate-spin mx-auto mb-4 shadow-[0_0_20px_rgba(212,168,83,0.15)]" />
          <p className="text-[#8a8584] tracking-wide">Loading your studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-6 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Social Studio</h1>
            <p className="text-sm text-[#8a8584] mt-1 tracking-wide">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleProcessScheduled}
              disabled={processing || syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#141414] border border-[#D4A853]/20 text-[#D4A853] text-sm font-medium hover:bg-[#1a1a1a] hover:border-[#D4A853]/40 active:bg-[#0f0f0f] transition-all disabled:opacity-50 min-h-[44px] shadow-[0_0_20px_rgba(212,168,83,0.05)]"
            >
              <span className={processing ? 'animate-pulse' : ''}>{Icons.lightning}</span>
              {processing ? 'Processing...' : 'Auto Post'}
            </button>
            <button
              onClick={onSync}
              disabled={syncing || processing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#141414] border border-[#D4A853]/20 text-[#D4A853] text-sm font-medium hover:bg-[#1a1a1a] hover:border-[#D4A853]/40 active:bg-[#0f0f0f] transition-all disabled:opacity-50 min-h-[44px] shadow-[0_0_20px_rgba(212,168,83,0.05)]"
            >
              <span className={syncing ? 'animate-spin' : ''}>{Icons.sync}</span>
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Process Result Banner */}
        {processResult && (
          <div className="p-4 rounded-xl bg-[#D4A853]/10 border border-[#D4A853]/20">
            <p className="text-sm text-white">
              ✅ Published {processResult.published} post{processResult.published !== 1 ? 's' : ''}
              {processResult.failed > 0 && ` • ❌ ${processResult.failed} failed`}
            </p>
          </div>
        )}

        {/* Today's Posts */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[#D4A853] uppercase tracking-[0.15em]">Today</h2>
            {today.length > 0 && (
              <span className="text-xs text-[#5a5554]">{today.length} post{today.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {today.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {today.map((post) => (
                <button
                  key={post.id}
                  onClick={() => onViewPost(post.id)}
                  className="flex-shrink-0 w-28 p-3 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#D4A853]/30 hover:bg-[#141414] transition-all text-left group"
                >
                  <div className="text-xs text-[#D4A853] font-medium mb-2 tracking-wide">
                    {formatTime(post.scheduled_at!)}
                  </div>
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-[#1a1a1a] mb-2 group-hover:ring-1 group-hover:ring-[#D4A853]/20 transition-all">
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
                      <span key={p} className="text-xs opacity-80">{PLATFORM_ICONS[p] || '📱'}</span>
                    ))}
                    {post.platforms.length > 2 && (
                      <span className="text-[10px] text-[#5a5554]">+{post.platforms.length - 2}</span>
                    )}
                  </div>
                </button>
              ))}

              {/* Add Post Button */}
              <button
                onClick={() => onNavigate('create')}
                className="flex-shrink-0 w-28 p-3 rounded-2xl border border-dashed border-[#2a2a2a] hover:border-[#D4A853]/40 transition-all flex flex-col items-center justify-center text-[#5a5554] hover:text-[#D4A853]"
              >
                {Icons.plus}
                <span className="text-xs mt-1 tracking-wide">Add</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('create')}
              className="w-full p-8 rounded-2xl bg-[#0a0a0a] border border-dashed border-[#1a1a1a] hover:border-[#D4A853]/30 transition-all text-center group"
            >
              <div className="text-3xl mb-3 opacity-60 group-hover:opacity-80 transition-opacity">📅</div>
              <p className="text-sm text-[#5a5554]">Nothing scheduled for today</p>
              <p className="text-xs text-[#D4A853] mt-2 tracking-wide">Tap to create a post</p>
            </button>
          )}
        </section>

        {/* Needs Attention */}
        {hasAttention && (
          <section className="p-4 rounded-2xl bg-gradient-to-br from-[#843c2d]/20 to-[#2a1510]/40 border border-[#843c2d]/30 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#e8a090]">{Icons.alert}</span>
              <h2 className="text-xs font-semibold text-[#e8a090] uppercase tracking-[0.1em]">Needs Attention</h2>
            </div>

            <div className="space-y-2">
              {attention.failed.length > 0 && (
                <button
                  onClick={() => onViewPost(attention.failed[0].id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-black/40 text-left hover:bg-black/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-sm text-white/90">
                      {attention.failed.length} failed post{attention.failed.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-[#5a5554] group-hover:text-[#8a8584] transition-colors">{Icons.chevronRight}</span>
                </button>
              )}

              {attention.emptySlots > 0 && (
                <button
                  onClick={() => onNavigate('calendar')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-black/40 text-left hover:bg-black/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#D4A853]" />
                    <span className="text-sm text-white/90">
                      {attention.emptySlots} empty slot{attention.emptySlots !== 1 ? 's' : ''} this week
                    </span>
                  </div>
                  <span className="text-[#5a5554] group-hover:text-[#8a8584] transition-colors">{Icons.chevronRight}</span>
                </button>
              )}

              {attention.pending.length > 0 && (
                <button
                  onClick={() => onNavigate('library')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-black/40 text-left hover:bg-black/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-sm text-white/90">
                      {attention.pending.length} draft{attention.pending.length !== 1 ? 's' : ''} to finish
                    </span>
                  </div>
                  <span className="text-[#5a5554] group-hover:text-[#8a8584] transition-colors">{Icons.chevronRight}</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Week Stats */}
        <section className="p-5 rounded-2xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-[#1a1a1a]">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[#D4A853]">{Icons.chart}</span>
            <h2 className="text-xs font-semibold text-white uppercase tracking-[0.1em]">This Week</h2>
          </div>

          {weekStats ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="text-center p-3 rounded-xl bg-[#141414]">
                  <div className="text-xl font-semibold text-white">{formatNumber(weekStats.views)}</div>
                  <div className="text-[10px] text-[#5a5554] uppercase tracking-wider mt-1">Views</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#141414]">
                  <div className="text-xl font-semibold text-white">{formatNumber(weekStats.likes)}</div>
                  <div className="text-[10px] text-[#5a5554] uppercase tracking-wider mt-1">Likes</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#141414]">
                  <div className="text-xl font-semibold text-[#D4A853]">{weekStats.engagement}%</div>
                  <div className="text-[10px] text-[#5a5554] uppercase tracking-wider mt-1">Engage</div>
                </div>
              </div>

              {weekStats.topPost && (
                <button
                  onClick={() => onViewPost(weekStats.topPost!.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#141414] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-[#D4A853]/20 transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#0f0f0f] flex-shrink-0 ring-1 ring-[#1a1a1a] group-hover:ring-[#D4A853]/20 transition-all">
                    {weekStats.topPost.thumbnail_url ? (
                      <img src={weekStats.topPost.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">🎬</div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-[10px] text-[#D4A853] uppercase tracking-wider">Top Performer</div>
                    <div className="text-sm text-white/90 truncate mt-0.5">
                      {weekStats.topPost.title || weekStats.topPost.caption?.slice(0, 30) || 'Untitled'}
                    </div>
                  </div>
                  <span className="text-[#3a3a3a] group-hover:text-[#5a5554] transition-colors">{Icons.chevronRight}</span>
                </button>
              )}
            </>
          ) : (
            <div className="text-sm text-[#5a5554]">
              Analytics aren’t synced yet. Use Sync to refresh.
            </div>
          )}
        </section>

        {/* Upcoming */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[#D4A853]">{Icons.calendar}</span>
              <h2 className="text-xs font-semibold text-white uppercase tracking-[0.1em]">Upcoming</h2>
            </div>
            <button
              onClick={() => onNavigate('calendar')}
              className="text-xs text-[#D4A853] hover:text-[#E5B863] transition-colors tracking-wide"
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
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#D4A853]/20 hover:bg-[#141414] transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#1a1a1a] flex-shrink-0 group-hover:ring-1 group-hover:ring-[#D4A853]/20 transition-all">
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
                      <span className="text-sm font-medium text-white/90 truncate">
                        {post.title || post.caption?.slice(0, 30) || 'Untitled'}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(post.status)}`} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#5a5554]">
                        {formatDate(post.scheduled_at!)}
                      </span>
                      <span className="text-xs text-[#D4A853]">
                        {formatTime(post.scheduled_at!)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {post.platforms.slice(0, 3).map((p) => (
                      <span key={p} className="text-sm opacity-70">{PLATFORM_ICONS[p] || '📱'}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a] text-center">
              <p className="text-sm text-[#5a5554]">No posts scheduled this week</p>
              <button
                onClick={() => onNavigate('create')}
                className="mt-2 text-xs text-[#D4A853] hover:text-[#E5B863] transition-colors tracking-wide"
              >
                Schedule your first post →
              </button>
            </div>
          )}
        </section>

        {/* Connected Accounts Summary */}
        {accounts.length > 0 && (
          <section className="p-4 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-white uppercase tracking-[0.1em]">Connected Accounts</h2>
              <button
                onClick={() => onNavigate('settings')}
                className="text-xs text-[#D4A853] hover:text-[#E5B863] transition-colors tracking-wide"
              >
                Manage →
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {accounts.filter((a) => a.is_active).slice(0, 5).map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141414] border border-[#1a1a1a]"
                  title={`@${account.account_handle}`}
                >
                  <span className="text-sm opacity-80">{PLATFORM_ICONS[account.platform] || '📱'}</span>
                  <span className="text-xs text-white/80 truncate max-w-[80px]">@{account.account_handle}</span>
                </div>
              ))}
              {accounts.filter((a) => a.is_active).length > 5 && (
                <span className="text-xs text-[#5a5554]">+{accounts.filter((a) => a.is_active).length - 5} more</span>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
