'use client';

import { useState, useMemo } from 'react';
import type { Post, Campaign } from '../page';

// =============================================================================
// TYPES
// =============================================================================

interface LibraryViewProps {
  posts: Post[];
  campaigns: Campaign[];
  onViewPost: (postId: string) => void;
  onRefresh: () => void;
}

type StatusFilter = 'all' | 'scheduled' | 'published' | 'draft' | 'failed';

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatScheduledDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'published':
      return 'Posted';
    case 'publishing':
      return 'Posting...';
    case 'failed':
      return 'Failed';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-500';
    case 'published':
      return 'bg-emerald-500';
    case 'publishing':
      return 'bg-purple-500';
    case 'failed':
      return 'bg-red-500';
    case 'draft':
      return 'bg-[#726d6c]';
    default:
      return 'bg-[#726d6c]';
  }
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  search: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  grid: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  list: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function LibraryView({
  posts,
  campaigns,
  onViewPost,
  onRefresh,
}: LibraryViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter posts
  const filteredPosts = useMemo(() => {
    let result = posts;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Campaign filter
    if (campaignFilter) {
      result = result.filter((p) => p.campaign_id === campaignFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.caption?.toLowerCase().includes(query) ||
          p.hashtags?.some((h) => h.toLowerCase().includes(query))
      );
    }

    // Sort by date (newest first)
    return result.sort((a, b) => {
      const dateA = a.scheduled_at || a.created_at;
      const dateB = b.scheduled_at || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [posts, statusFilter, campaignFilter, searchQuery]);

  // Count by status
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: posts.length,
      scheduled: 0,
      published: 0,
      draft: 0,
      failed: 0,
    };

    posts.forEach((p) => {
      if (p.status in counts) {
        counts[p.status as StatusFilter]++;
      }
    });

    return counts;
  }, [posts]);

  // Campaign counts
  const campaignCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => {
      if (p.campaign_id) {
        counts[p.campaign_id] = (counts[p.campaign_id] || 0) + 1;
      }
    });
    return counts;
  }, [posts]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Library</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1a1a1a] text-[#D4A853] hover:bg-[#252525] transition-colors"
            >
              {Icons.refresh}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#726d6c]">
            {Icons.search}
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#252525] text-white placeholder-[#726d6c] outline-none focus:border-[#D4A853]/50 transition-colors"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {(['all', 'scheduled', 'published', 'draft', 'failed'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-[#D4A853] text-black'
                  : 'bg-[#1a1a1a] text-white hover:bg-[#252525]'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1.5 opacity-60">{statusCounts[status]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Pills */}
      {campaigns.length > 0 && (
        <div className="flex-shrink-0 px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            <button
              onClick={() => setCampaignFilter(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !campaignFilter
                  ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]'
                  : 'bg-[#1a1a1a] text-[#726d6c] border border-[#252525] hover:border-[#D4A853]/30'
              }`}
            >
              All Campaigns
            </button>
            {campaigns
              .filter((c) => c.status === 'active')
              .map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() =>
                    setCampaignFilter(campaignFilter === campaign.id ? null : campaign.id)
                  }
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    campaignFilter === campaign.id
                      ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]'
                      : 'bg-[#1a1a1a] text-[#726d6c] border border-[#252525] hover:border-[#D4A853]/30'
                  }`}
                  style={{
                    borderColor:
                      campaignFilter === campaign.id ? campaign.color || '#D4A853' : undefined,
                  }}
                >
                  {campaign.color && (
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: campaign.color }}
                    />
                  )}
                  {campaign.name}
                  <span className="ml-1 opacity-60">{campaignCounts[campaign.id] || 0}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex-shrink-0 px-4 pb-2 flex justify-end">
        <div className="flex gap-1 p-1 bg-[#1a1a1a] rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-[#252525] text-white' : 'text-[#726d6c]'
            }`}
          >
            {Icons.grid}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-[#252525] text-white' : 'text-[#726d6c]'
            }`}
          >
            {Icons.list}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-[#726d6c] text-center">
              {searchQuery
                ? 'No posts match your search'
                : statusFilter !== 'all'
                ? `No ${statusFilter} posts`
                : 'No posts yet'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 gap-3">
            {filteredPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => onViewPost(post.id)}
                className="rounded-xl overflow-hidden bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors text-left"
              >
                {/* Thumbnail */}
                <div className="aspect-square relative bg-[#252525]">
                  {post.thumbnail_url ? (
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {post.media_type === 'video' ? '🎬' : '📷'}
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2 left-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                        post.status
                      )} text-white`}
                    >
                      {getStatusLabel(post.status)}
                    </span>
                  </div>

                  {/* Platform Icons */}
                  <div className="absolute bottom-2 right-2 flex gap-0.5">
                    {post.platforms.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-xs"
                      >
                        {PLATFORM_ICONS[p] || '📱'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="text-sm text-white truncate">
                    {post.title || post.caption?.slice(0, 30) || 'Untitled'}
                  </div>
                  <div className="text-xs text-[#726d6c] mt-1">
                    {post.status === 'scheduled' && post.scheduled_at
                      ? `${formatScheduledDate(post.scheduled_at)} • ${formatTime(post.scheduled_at)}`
                      : post.status === 'published' && post.published_at
                      ? formatDate(post.published_at)
                      : formatDate(post.created_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {filteredPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => onViewPost(post.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors text-left"
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#252525] flex-shrink-0">
                  {post.thumbnail_url ? (
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {post.media_type === 'video' ? '🎬' : '📷'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {post.title || post.caption?.slice(0, 40) || 'Untitled'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                        post.status
                      )} text-white`}
                    >
                      {getStatusLabel(post.status)}
                    </span>

                    <span className="text-xs text-[#726d6c]">
                      {post.status === 'scheduled' && post.scheduled_at
                        ? `${formatScheduledDate(post.scheduled_at)} • ${formatTime(post.scheduled_at)}`
                        : post.status === 'published' && post.published_at
                        ? formatDate(post.published_at)
                        : formatDate(post.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1.5">
                    {post.platforms.slice(0, 4).map((p) => (
                      <span key={p} className="text-xs">
                        {PLATFORM_ICONS[p] || '📱'}
                      </span>
                    ))}
                    {post.platforms.length > 4 && (
                      <span className="text-[10px] text-[#726d6c]">
                        +{post.platforms.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                {/* Campaign color indicator */}
                {post.campaign_id && (
                  <div
                    className="w-1 h-12 rounded-full"
                    style={{
                      backgroundColor:
                        campaigns.find((c) => c.id === post.campaign_id)?.color || '#726d6c',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
