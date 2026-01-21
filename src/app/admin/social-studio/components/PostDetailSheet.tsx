'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Account } from '../page';

// =============================================================================
// TYPES
// =============================================================================

interface PostDetailSheetProps {
  postId: string;
  accounts: Account[];
  onClose: () => void;
  onRefresh: () => void;
}

interface PostDetail {
  id: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  title?: string;
  caption?: string;
  hashtags?: string[];
  media_type: 'video' | 'image';
  media_url: string;
  thumbnail_url?: string;
  platforms: string[];
  account_ids?: string[];
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
  campaign_id?: string;
  postforme_status?: string;
  last_synced_at?: string;
  error_message?: string;
  platform_post_ids?: Record<string, string>;
}

interface Analytics {
  views: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
  fetched_at: string;
}

// =============================================================================
// PLATFORM DATA
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'published':
      return 'Published';
    case 'publishing':
      return 'Publishing...';
    case 'failed':
      return 'Failed';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

function getStatusStyles(status: string): { bg: string; text: string; glow?: string } {
  switch (status) {
    case 'scheduled':
      return {
        bg: 'bg-[#D4A853]/20',
        text: 'text-[#D4A853]',
        glow: 'shadow-[0_0_12px_rgba(212,168,83,0.3)]'
      };
    case 'published':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        glow: 'shadow-[0_0_12px_rgba(52,211,153,0.3)]'
      };
    case 'publishing':
      return {
        bg: 'bg-purple-500/20',
        text: 'text-purple-400'
      };
    case 'failed':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]'
      };
    case 'draft':
      return {
        bg: 'bg-[#5a5554]/20',
        text: 'text-[#8a8584]'
      };
    default:
      return {
        bg: 'bg-[#5a5554]/20',
        text: 'text-[#8a8584]'
      };
  }
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  sync: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  retry: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  externalLink: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  ),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PostDetailSheet({
  postId,
  accounts,
  onClose,
  onRefresh,
}: PostDetailSheetProps) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch post details
  const fetchPost = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/social/posts/${postId}`);
      if (response.ok) {
        const data = await response.json();
        setPost(data.post);
      }
    } catch (error) {
      console.error('[PostDetailSheet] Error fetching post:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/social/posts/${postId}/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('[PostDetailSheet] Error fetching analytics:', error);
    }
  }, [postId]);

  const handleRefreshAnalytics = async () => {
    setRefreshingAnalytics(true);
    try {
      await fetch(`/api/social/posts/${postId}/sync`, { method: 'POST' });
      await fetchAnalytics();
    } catch (error) {
      console.error('[PostDetailSheet] Analytics refresh error:', error);
    } finally {
      setRefreshingAnalytics(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPost();
    fetchAnalytics();
  }, [fetchPost, fetchAnalytics]);

  // Sync post
  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/social/posts/${postId}/sync`, { method: 'POST' });
      await fetchPost();
      await fetchAnalytics();
      onRefresh();
    } catch (error) {
      console.error('[PostDetailSheet] Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Delete post
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    setDeleting(true);
    try {
      await fetch(`/api/social/posts/${postId}`, { method: 'DELETE' });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('[PostDetailSheet] Delete error:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Retry failed post
  const handleRetry = async () => {
    try {
      await fetch(`/api/social/posts/${postId}/publish`, { method: 'POST' });
      await fetchPost();
      onRefresh();
    } catch (error) {
      console.error('[PostDetailSheet] Retry error:', error);
    }
  };

  // Get linked accounts
  const linkedAccounts = accounts.filter((a) => post?.account_ids?.includes(a.id));
  const statusStyles = post ? getStatusStyles(post.status) : null;
  const platformLinks = post?.platform_post_ids
    ? Object.entries(post.platform_post_ids)
        .filter(([key, value]) => key !== 'postforme_id' && typeof value === 'string')
        .map(([platform, url]) => ({ platform, url: url as string }))
        .filter((item) => /^https?:\/\//i.test(item.url))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg max-h-[92vh] bg-[#0a0a0a] rounded-t-[2rem] overflow-hidden flex flex-col animate-slide-up border-t border-[#1a1a1a] shadow-[0_-20px_60px_rgba(0,0,0,0.8)]">
        {/* Drag Handle */}
        <div className="flex-shrink-0 flex justify-center py-4">
          <div className="w-12 h-1 rounded-full bg-[#2a2a2a]" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pb-4 border-b border-[#1a1a1a]">
          <h2 className="text-lg font-semibold text-white tracking-tight">Post Details</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#141414] border border-[#1a1a1a] text-[#5a5554] hover:text-white hover:border-[#D4A853]/30 transition-all duration-300"
          >
            {Icons.close}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 border-2 border-[#D4A853]/20 border-t-[#D4A853] rounded-full animate-spin shadow-[0_0_20px_rgba(212,168,83,0.15)]" />
            </div>
          ) : post ? (
            <div className="px-5 pb-24 space-y-5">
              {/* Media Preview */}
              <div className="relative rounded-2xl overflow-hidden bg-[#0f0f0f] aspect-video mt-4 border border-[#1a1a1a]">
                {post.media_type === 'video' ? (
                  <video
                    src={post.media_url}
                    poster={post.thumbnail_url}
                    className="w-full h-full object-cover"
                    controls
                    playsInline
                  />
                ) : (
                  <img
                    src={post.media_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Title & Status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-white truncate">
                    {post.title || post.caption?.slice(0, 50) || 'Untitled'}
                  </h3>
                </div>
                {statusStyles && (
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wide ${statusStyles.bg} ${statusStyles.text} ${statusStyles.glow || ''}`}>
                    {getStatusLabel(post.status)}
                  </span>
                )}
              </div>

              {/* Error Message (if failed) */}
              {post.status === 'failed' && post.error_message && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <div className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">Error</div>
                  <div className="text-sm text-red-300/80">{post.error_message}</div>
                </div>
              )}

              {/* Schedule Info */}
              {(post.scheduled_at || post.published_at) && (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a]">
                  <div className="w-10 h-10 rounded-xl bg-[#D4A853]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#D4A853]">{Icons.calendar}</span>
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">
                      {post.status === 'published' && post.published_at
                        ? `Published ${formatDate(post.published_at)}`
                        : post.scheduled_at
                        ? `Scheduled for ${formatDate(post.scheduled_at)}`
                        : 'Not scheduled'}
                    </div>
                    {post.scheduled_at && post.status !== 'published' && (
                      <div className="text-xs text-[#5a5554] mt-0.5">
                        at {formatTime(post.scheduled_at)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Platforms */}
              <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a]">
                <div className="text-[10px] text-[#5a5554] uppercase tracking-widest mb-3">
                  {post.status === 'published' ? 'Posted to' : 'Posting to'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {linkedAccounts.length > 0 ? (
                    linkedAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]"
                      >
                        <span>{PLATFORM_ICONS[acc.platform] || '📱'}</span>
                        <span className="text-sm text-white">@{acc.account_handle}</span>
                      </div>
                    ))
                  ) : (
                    post.platforms.map((p) => (
                      <div
                        key={p}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]"
                      >
                        <span>{PLATFORM_ICONS[p] || '📱'}</span>
                        <span className="text-sm text-white capitalize">{p}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Caption */}
              {post.caption && (
                <div>
                  <div className="text-[10px] text-[#5a5554] uppercase tracking-widest mb-2">Caption</div>
                  <div className="text-sm text-[#b8b2b1] whitespace-pre-wrap leading-relaxed">{post.caption}</div>
                </div>
              )}

              {/* Hashtags */}
              {post.hashtags && post.hashtags.length > 0 && (
                <div>
                  <div className="text-[10px] text-[#5a5554] uppercase tracking-widest mb-2">Hashtags</div>
                  <div className="text-sm text-[#D4A853]">
                    {post.hashtags.map((t) => `#${t}`).join(' ')}
                  </div>
                </div>
              )}

              {/* Analytics (Published posts only) */}
              {post.status === 'published' && analytics && (
                <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] text-[#5a5554] uppercase tracking-widest">Performance</div>
                    <button
                      onClick={handleRefreshAnalytics}
                      disabled={refreshingAnalytics}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141414] border border-[#1a1a1a] text-[10px] text-[#D4A853] hover:border-[#D4A853]/30 disabled:opacity-60"
                    >
                      <span className={refreshingAnalytics ? 'animate-spin' : ''}>{Icons.sync}</span>
                      {refreshingAnalytics ? 'Refreshing' : 'Refresh'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                      <div className="text-xl font-bold text-white">
                        {formatNumber(analytics.views)}
                      </div>
                      <div className="text-[10px] text-[#5a5554] uppercase tracking-wide mt-1">Views</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                      <div className="text-xl font-bold text-white">
                        {formatNumber(analytics.likes)}
                      </div>
                      <div className="text-[10px] text-[#5a5554] uppercase tracking-wide mt-1">Likes</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-[#D4A853]/10 border border-[#D4A853]/20">
                      <div className="text-xl font-bold text-[#D4A853]">
                        {analytics.engagement_rate.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-[#D4A853]/70 uppercase tracking-wide mt-1">Engage</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-[#1a1a1a]">
                    <div className="text-center">
                      <div className="text-sm font-medium text-white">
                        {formatNumber(analytics.comments)}
                      </div>
                      <div className="text-[9px] text-[#5a5554] uppercase tracking-wide mt-0.5">Comments</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-white">
                        {formatNumber(analytics.shares)}
                      </div>
                      <div className="text-[9px] text-[#5a5554] uppercase tracking-wide mt-0.5">Shares</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-white">
                        {formatNumber(analytics.saves)}
                      </div>
                      <div className="text-[9px] text-[#5a5554] uppercase tracking-wide mt-0.5">Saves</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-white">
                        {formatNumber(analytics.reach)}
                      </div>
                      <div className="text-[9px] text-[#5a5554] uppercase tracking-wide mt-0.5">Reach</div>
                    </div>
                  </div>
                </div>
              )}

              {post.status === 'published' && !analytics && (
                <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] text-sm text-[#5a5554]">
                  Analytics aren’t available yet. Use Refresh to sync.
                </div>
              )}

              {/* View on Platform Links */}
              {post.status === 'published' && platformLinks.length > 0 && (
                <div>
                  <div className="text-[10px] text-[#5a5554] uppercase tracking-widest mb-3">View on</div>
                  <div className="flex flex-wrap gap-2">
                    {platformLinks.map(({ platform, url }) => (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] text-white text-sm hover:border-[#D4A853]/30 hover:shadow-[0_0_20px_rgba(212,168,83,0.1)] transition-all duration-300"
                      >
                        {PLATFORM_ICONS[platform] || '🔗'}
                        <span className="capitalize">{platform}</span>
                        <span className="text-[#5a5554] group-hover:text-[#D4A853] transition-colors">{Icons.externalLink}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Sync Info */}
              {post.last_synced_at && (
                <div className="text-[10px] text-[#3a3534] text-center uppercase tracking-wide">
                  Last synced {new Date(post.last_synced_at).toLocaleString()}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] text-white text-sm font-medium hover:border-[#D4A853]/30 hover:shadow-[0_0_20px_rgba(212,168,83,0.1)] transition-all duration-300 disabled:opacity-50"
                >
                  <span className={syncing ? 'animate-spin' : ''}>{Icons.sync}</span>
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>

                {post.status === 'failed' && (
                  <button
                    onClick={handleRetry}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#B8923F] text-black text-sm font-semibold hover:shadow-[0_0_25px_rgba(212,168,83,0.4)] transition-all duration-300"
                  >
                    {Icons.retry}
                    Retry
                  </button>
                )}

                {(post.status === 'draft' || post.status === 'scheduled') && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/15 hover:border-red-500/30 transition-all duration-300 disabled:opacity-50"
                  >
                    {Icons.trash}
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-14 h-14 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] flex items-center justify-center mb-4">
                <span className="text-2xl opacity-40">📭</span>
              </div>
              <p className="text-sm text-[#5a5554]">Post not found</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
