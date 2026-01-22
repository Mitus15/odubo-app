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
type MediaFilter = 'all' | 'video' | 'image';
type SourceFilter = 'all' | 'clips' | 'uploads' | 'imported';

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

function getStatusStyles(status: string): { bg: string; text: string; glow?: string } {
  switch (status) {
    case 'scheduled':
      return {
        bg: 'bg-[#843c2d]/20',
        text: 'text-[#e8a990]',
        glow: 'shadow-[0_0_8px_rgba(212,168,83,0.3)]'
      };
    case 'published':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        glow: 'shadow-[0_0_8px_rgba(52,211,153,0.3)]'
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
        glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]'
      };
    case 'draft':
      return {
        bg: 'bg-[#726d6c]/20',
        text: 'text-[#726d6c]'
      };
    default:
      return {
        bg: 'bg-[#726d6c]/20',
        text: 'text-[#726d6c]'
      };
  }
}

function getSourceBadge(post: Post): { icon: string; label: string; color: string } | null {
  // If imported from social platforms
  if (post.created_at && post.platforms && post.platforms.length > 0) {
    const platform = post.platforms[0];
    return {
      icon: PLATFORM_ICONS[platform] || '🔄',
      label: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Sync`,
      color: 'from-blue-500/20 to-purple-500/20 text-blue-300 border-blue-500/30'
    };
  }
  
  return null;
}

// Detect if content is likely landscape (music video) vs portrait (social clip)
function getContentOrientation(post: Post): 'landscape' | 'portrait' | 'unknown' {
  // Heuristic: YouTube videos are usually landscape (16:9)
  // TikTok/Instagram Reels are usually portrait (9:16)
  if (post.platforms) {
    const hasYouTube = post.platforms.includes('youtube');
    const hasTikTok = post.platforms.includes('tiktok');
    const hasInstagram = post.platforms.includes('instagram');
    
    // If only YouTube, likely landscape
    if (hasYouTube && !hasTikTok && !hasInstagram) {
      return 'landscape';
    }
    
    // If TikTok or Instagram, likely portrait
    if (hasTikTok || hasInstagram) {
      return 'portrait';
    }
  }
  
  return 'unknown';
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
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
  video: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  image: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
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
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const platformOptions = useMemo(() => {
    const platforms = new Set<string>();
    posts.forEach((post) => post.platforms?.forEach((p) => platforms.add(p)));
    return ['all', ...Array.from(platforms)];
  }, [posts]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    let result = posts;

    // Source filter (primary categorization)
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'clips') {
        result = result.filter((p) => p.platforms && p.platforms.length > 0);
      } else if (sourceFilter === 'uploads') {
        result = result.filter((p) => p.platforms && p.platforms.length === 0);
      } else if (sourceFilter === 'imported') {
        result = result.filter((p) => p.platforms && p.platforms.length > 0);
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Campaign filter
    if (campaignFilter) {
      result = result.filter((p) => p.campaign_id === campaignFilter);
    }

    // Platform filter
    if (platformFilter !== 'all') {
      result = result.filter((p) => p.platforms?.includes(platformFilter));
    }

    // Media filter
    if (mediaFilter !== 'all') {
      result = result.filter((p) => p.media_type === mediaFilter);
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
  }, [posts, sourceFilter, statusFilter, campaignFilter, searchQuery, platformFilter, mediaFilter]);

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
    <div className="h-full flex flex-col bg-black">
      {/* Header - Glass effect */}
      <div className="flex-shrink-0 px-4 pt-6 pb-4 bg-gradient-to-b from-black via-black to-transparent">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Library</h1>
            <p className="text-xs text-[#726d6c] mt-1">{filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}</p>
          </div>
          <button
            onClick={onRefresh}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0d0c0a] border border-[#302927] text-[#e8a990] hover:bg-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_20px_rgba(232,169,144,0.2)] transition-all duration-300 active:scale-95"
          >
            {Icons.refresh}
          </button>
        </div>

        {/* Search - Premium styling */}
        <div className="relative mb-5">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#726d6c]">
            {Icons.search}
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, caption, or hashtags..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-black border border-[#302927] text-white placeholder-[#726d6c] outline-none focus:border-[#e8a990]/40 focus:shadow-[0_0_20px_rgba(232,169,144,0.15)] transition-all duration-300 text-sm"
          />
        </div>

        {/* Source Filter Tabs - Primary content categorization */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-widest text-[#e8a990] mb-2.5">Content Type</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {[
              { value: 'all', label: 'All', icon: '📚' },
              { value: 'clips', label: 'Clips', icon: '🎬' },
              { value: 'uploads', label: 'Uploads', icon: '📤' },
              { value: 'imported', label: 'Synced', icon: '🔄' },
            ].map((source) => (
              <button
                key={source.value}
                onClick={() => setSourceFilter(source.value as SourceFilter)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2 active:scale-95 ${
                  sourceFilter === source.value
                    ? 'bg-gradient-to-r from-[#e8a990] to-[#c97b63] text-black shadow-[0_0_25px_rgba(232,169,144,0.35)]'
                    : 'bg-[#0d0c0a] text-[#726d6c] hover:bg-[#302927] hover:text-white border border-[#302927] hover:border-[#302927]'
                }`}
              >
                <span className="text-base">{source.icon}</span>
                {source.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Tabs */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-[#e8a990] mb-2.5">Status</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {(['all', 'scheduled', 'published', 'draft', 'failed'] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium tracking-wide transition-all duration-300 active:scale-95 ${
                  statusFilter === status
                    ? 'bg-[#e8a990]/15 text-[#e8a990] border border-[#e8a990]/40 shadow-[0_0_15px_rgba(232,169,144,0.2)]'
                    : 'bg-[#0d0c0a] text-[#726d6c] hover:bg-[#302927] hover:text-white border border-[#302927]'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className={`ml-1.5 text-[10px] ${
                  statusFilter === status ? 'opacity-80' : 'opacity-40'
                }`}>
                  {statusCounts[status]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters - Collapsed */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer text-xs text-[#726d6c] hover:text-[#e8a990] transition-colors mb-3">
            <span className="uppercase tracking-widest">Advanced Filters</span>
            <span className="group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black border border-[#302927] text-white text-xs focus:border-[#e8a990]/40 focus:outline-none transition-colors"
            >
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform === 'all' ? 'All Platforms' : platform}
                </option>
              ))}
            </select>
            <select
              value={mediaFilter}
              onChange={(e) => setMediaFilter(e.target.value as MediaFilter)}
              className="w-full px-3 py-2.5 rounded-xl bg-black border border-[#302927] text-white text-xs focus:border-[#e8a990]/40 focus:outline-none transition-colors"
            >
              <option value="all">All Media</option>
              <option value="video">Video</option>
              <option value="image">Image</option>
            </select>
          </div>
        </details>
      </div>

      {/* Campaign Pills */}
      {campaigns.length > 0 && (
        <div className="flex-shrink-0 px-4 pb-4">
          <p className="text-[10px] uppercase tracking-widest text-[#e8a990] mb-2.5">Campaigns</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <button
              onClick={() => setCampaignFilter(null)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-300 active:scale-95 ${
                !campaignFilter
                  ? 'bg-[#e8a990]/15 text-[#e8a990] border border-[#e8a990]/40 shadow-[0_0_15px_rgba(232,169,144,0.2)]'
                  : 'bg-black text-[#726d6c] border border-[#302927] hover:border-[#e8a990]/35 hover:text-white'
              }`}
            >
              All
            </button>
            {campaigns
              .filter((c) => c.status === 'active')
              .map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() =>
                    setCampaignFilter(campaignFilter === campaign.id ? null : campaign.id)
                  }
                  className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-300 flex items-center gap-1.5 active:scale-95 ${
                    campaignFilter === campaign.id
                      ? 'bg-[#e8a990]/15 text-[#e8a990] border border-[#e8a990]/40 shadow-[0_0_15px_rgba(232,169,144,0.2)]'
                      : 'bg-black text-[#726d6c] border border-[#302927] hover:border-[#e8a990]/35 hover:text-white'
                  }`}
                >
                  {campaign.color && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: campaign.color }}
                    />
                  )}
                  <span className="truncate max-w-[120px]">{campaign.name}</span>
                  <span className="opacity-50 text-[10px]">{campaignCounts[campaign.id] || 0}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex-shrink-0 px-4 pb-3 flex justify-end">
        <div className="flex gap-1 p-1 bg-black rounded-xl border border-[#302927]">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-all duration-300 ${
              viewMode === 'grid'
                ? 'bg-[#843c2d]/20 text-[#e8a990] shadow-[0_0_10px_rgba(212,168,83,0.2)]'
                : 'text-[#726d6c] hover:text-[#726d6c]'
            }`}
          >
            {Icons.grid}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all duration-300 ${
              viewMode === 'list'
                ? 'bg-[#843c2d]/20 text-[#e8a990] shadow-[0_0_10px_rgba(212,168,83,0.2)]'
                : 'text-[#726d6c] hover:text-[#726d6c]'
            }`}
          >
            {Icons.list}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#0d0c0a] border border-[#302927] flex items-center justify-center mb-4">
              <span className="text-3xl opacity-50">📭</span>
            </div>
            <p className="text-[#726d6c] text-sm text-center">
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
            {filteredPosts.map((post) => {
              const statusStyle = getStatusStyles(post.status);
              const sourceBadge = getSourceBadge(post);
              const orientation = getContentOrientation(post);
              const isLandscape = orientation === 'landscape';
              
              return (
                <button
                  key={post.id}
                  onClick={() => onViewPost(post.id)}
                  className="group rounded-2xl overflow-hidden bg-black border border-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_30px_rgba(212,168,83,0.1)] transition-all duration-300 text-left"
                >
                  {/* Thumbnail - Dynamic aspect ratio */}
                  <div className={`relative bg-[#0d0c0a] overflow-hidden ${
                    isLandscape ? 'aspect-video' : 'aspect-square'
                  }`}>
                    {post.thumbnail_url ? (
                      <img
                        src={post.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#3a3534]">
                        {post.media_type === 'video' ? Icons.video : Icons.image}
                      </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Landscape indicator */}
                    {isLandscape && (
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-1 rounded-lg text-[10px] font-medium bg-black/70 backdrop-blur-md text-white border border-white/20">
                          16:9
                        </span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className={`absolute ${isLandscape ? 'top-2.5 left-14' : 'top-2.5 left-2.5'}`}>
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold tracking-wide uppercase ${statusStyle.bg} ${statusStyle.text} ${statusStyle.glow || ''}`}
                      >
                        {getStatusLabel(post.status)}
                      </span>
                    </div>

                    {/* Source Badge - top right */}
                    {sourceBadge && (
                      <div className="absolute top-2.5 right-2.5">
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-medium backdrop-blur-md bg-gradient-to-r border flex items-center gap-1 ${sourceBadge.color}`}
                        >
                          <span className="text-xs">{sourceBadge.icon}</span>
                          {sourceBadge.label}
                        </span>
                      </div>
                    )}

                    {/* Platform Icons */}
                    <div className="absolute bottom-2.5 right-2.5 flex gap-1">
                      {post.platforms.slice(0, 3).map((p) => (
                        <span
                          key={p}
                          className="w-6 h-6 rounded-lg bg-black/70 backdrop-blur-sm flex items-center justify-center text-xs border border-white/10"
                        >
                          {PLATFORM_ICONS[p] || '📱'}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 border-t border-[#302927]">
                    <div className="text-sm text-white truncate font-medium">
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
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {filteredPosts.map((post) => {
              const statusStyle = getStatusStyles(post.status);
              const sourceBadge = getSourceBadge(post);
              return (
                <button
                  key={post.id}
                  onClick={() => onViewPost(post.id)}
                  className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-black border border-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_25px_rgba(212,168,83,0.08)] transition-all duration-300 text-left"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#0d0c0a] flex-shrink-0 border border-[#302927] group-hover:border-[#e8a990]/25 transition-colors">
                    {post.thumbnail_url ? (
                      <img
                        src={post.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#3a3534]">
                        {post.media_type === 'video' ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate group-hover:text-[#e8a990] transition-colors">
                        {post.title || post.caption?.slice(0, 40) || 'Untitled'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        {getStatusLabel(post.status)}
                      </span>

                      {sourceBadge && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r border flex items-center gap-1 ${sourceBadge.color}`}
                        >
                          <span className="text-xs">{sourceBadge.icon}</span>
                          {sourceBadge.label}
                        </span>
                      )}

                      <span className="text-xs text-[#726d6c]">
                        {post.status === 'scheduled' && post.scheduled_at
                          ? `${formatScheduledDate(post.scheduled_at)} • ${formatTime(post.scheduled_at)}`
                          : post.status === 'published' && post.published_at
                          ? formatDate(post.published_at)
                          : formatDate(post.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      {post.platforms.slice(0, 4).map((p) => (
                        <span key={p} className="text-xs opacity-70">
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
                      className="w-1 h-12 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          campaigns.find((c) => c.id === post.campaign_id)?.color || '#726d6c',
                      }}
                    />
                  )}

                  {/* Hover arrow */}
                  <div className="text-[#3a3534] group-hover:text-[#e8a990] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
