'use client';

import { useState, useEffect, useCallback } from 'react';
import { PostWizard } from './PostWizard';
import { CalendarView } from './CalendarView';

// =============================================================================
// TYPES
// =============================================================================

type ViewMode = 'dashboard' | 'create' | 'calendar' | 'library';
type PostStatus = 'draft' | 'pending_approval' | 'scheduled' | 'publishing' | 'published' | 'failed';

interface Entity {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  color?: string;
}

interface ScheduledPost {
  id: string;
  status: PostStatus;
  entity_id?: string;
  account_ids?: string[];
  title?: string;
  caption?: string;
  media_type: 'video' | 'image' | 'carousel';
  media_url: string;
  thumbnail_url?: string;
  platforms: string[];
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
  requires_approval: boolean;
  error_message?: string;
}

interface ConnectedAccount {
  id: string;
  entity_id?: string;
  platform: string;
  account_handle: string;
  account_name?: string;
  profile_image_url?: string;
  is_active: boolean;
  postforme_account_id?: string;
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  create: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  library: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  alert: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
};

// Platform icons and colors
const PLATFORM_CONFIG: Record<string, { icon: string; color: string; name: string }> = {
  tiktok: { icon: '📱', color: '#00f2ea', name: 'TikTok' },
  instagram: { icon: '📷', color: '#E4405F', name: 'Instagram' },
  youtube: { icon: '▶️', color: '#FF0000', name: 'YouTube' },
  facebook: { icon: '👤', color: '#1877F2', name: 'Facebook' },
  threads: { icon: '🧵', color: '#000000', name: 'Threads' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) {
    // Past
    if (diffMins > -60) return `${Math.abs(diffMins)}m ago`;
    if (diffHours > -24) return `${Math.abs(diffHours)}h ago`;
    return `${Math.abs(diffDays)}d ago`;
  } else {
    // Future
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    return `in ${diffDays}d`;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusBadge(status: PostStatus): { label: string; className: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', className: 'bg-[#302927] text-[#726d6c]' };
    case 'pending_approval':
      return { label: 'Pending', className: 'bg-amber-900/30 text-amber-400' };
    case 'scheduled':
      return { label: 'Scheduled', className: 'bg-blue-900/30 text-blue-400' };
    case 'publishing':
      return { label: 'Publishing...', className: 'bg-purple-900/30 text-purple-400' };
    case 'published':
      return { label: 'Published', className: 'bg-green-900/30 text-green-400' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-900/30 text-red-400' };
    default:
      return { label: status, className: 'bg-[#302927] text-[#726d6c]' };
  }
}

// =============================================================================
// DASHBOARD VIEW
// =============================================================================

function DashboardView({
  posts,
  accounts,
  loading,
  onCreatePost,
  onViewCalendar,
  onRefresh,
}: {
  posts: ScheduledPost[];
  accounts: ConnectedAccount[];
  loading: boolean;
  onCreatePost: () => void;
  onViewCalendar: () => void;
  onRefresh: () => void;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

  // Categorize posts
  const todayPosts = posts.filter((p) => {
    if (!p.scheduled_at) return false;
    const scheduledDate = new Date(p.scheduled_at);
    return scheduledDate >= todayStart && scheduledDate < todayEnd;
  });

  const upcomingPosts = posts.filter((p) => {
    if (!p.scheduled_at) return false;
    const scheduledDate = new Date(p.scheduled_at);
    return scheduledDate >= todayEnd && scheduledDate < weekEnd && p.status === 'scheduled';
  });

  const pendingApproval = posts.filter((p) => p.status === 'pending_approval');
  const failedPosts = posts.filter((p) => p.status === 'failed');
  const drafts = posts.filter((p) => p.status === 'draft');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header with Quick Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#ede8df]">Social Command</h2>
            <p className="text-sm text-[#726d6c] mt-1">
              {accounts.length} connected account{accounts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-[#726d6c] hover:text-[#ede8df] hover:border-[#502d26] transition-colors disabled:opacity-50"
              title="Refresh"
            >
              {Icons.refresh}
            </button>
            <button
              onClick={onCreatePost}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] transition-colors"
            >
              {Icons.create}
              <span>Create Post</span>
            </button>
          </div>
        </div>

        {/* Failure Alert */}
        {failedPosts.length > 0 && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-900/30">
                {Icons.alert}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">
                  {failedPosts.length} post{failedPosts.length !== 1 ? 's' : ''} failed to publish
                </p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  Review and retry failed posts
                </p>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-red-900/30 text-red-400 text-xs hover:bg-red-900/50 transition-colors">
                View All
              </button>
            </div>
          </div>
        )}

        {/* Today's Posts */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-[#ede8df]">Today</h3>
            <span className="text-xs text-[#726d6c]">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>

          {todayPosts.length > 0 ? (
            <div className="space-y-3">
              {todayPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-[#502d26]/40 text-center">
              <p className="text-sm text-[#726d6c]">No posts scheduled for today</p>
              <button
                onClick={onCreatePost}
                className="mt-3 text-sm text-[#843c2d] hover:text-[#9a4a3a] transition-colors"
              >
                Schedule a post →
              </button>
            </div>
          )}
        </section>

        {/* Pending Approval */}
        {pendingApproval.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-[#ede8df]">Pending Approval</h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 text-xs">
                {pendingApproval.length}
              </span>
            </div>
            <div className="space-y-3">
              {pendingApproval.slice(0, 3).map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming This Week */}
        {upcomingPosts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-[#ede8df]">Coming Up</h3>
              <button
                onClick={onViewCalendar}
                className="text-xs text-[#843c2d] hover:text-[#9a4a3a] transition-colors"
              >
                View Calendar →
              </button>
            </div>
            <div className="space-y-3">
              {upcomingPosts.slice(0, 5).map((post) => (
                <PostCard key={post.id} post={post} compact />
              ))}
            </div>
          </section>
        )}

        {/* Drafts */}
        {drafts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-[#ede8df]">Drafts</h3>
              <span className="text-xs text-[#726d6c]">{drafts.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {drafts.slice(0, 4).map((post) => (
                <DraftCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* Quick Stats */}
        <section className="grid grid-cols-3 gap-4">
          <StatCard
            label="Scheduled"
            value={posts.filter((p) => p.status === 'scheduled').length}
            icon={Icons.clock}
          />
          <StatCard
            label="Published"
            value={posts.filter((p) => p.status === 'published').length}
            icon={Icons.check}
          />
          <StatCard
            label="This Week"
            value={upcomingPosts.length + todayPosts.length}
            icon={Icons.calendar}
          />
        </section>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function PostCard({ post, compact = false }: { post: ScheduledPost; compact?: boolean }) {
  const statusBadge = getStatusBadge(post.status);
  const platforms = post.platforms || [];

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-[#171616] border border-[#502d26]/20 hover:border-[#502d26]/40 transition-colors cursor-pointer">
      {/* Thumbnail */}
      <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded-lg overflow-hidden bg-[#302927] flex-shrink-0`}>
        {post.thumbnail_url ? (
          <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">
            {post.media_type === 'video' ? '🎬' : '📷'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {post.title || post.caption?.slice(0, 50) || 'Untitled Post'}
          </p>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1">
          {/* Platforms */}
          <div className="flex items-center gap-1">
            {platforms.map((p) => (
              <span key={p} title={PLATFORM_CONFIG[p]?.name || p} className="text-xs">
                {PLATFORM_CONFIG[p]?.icon || '📱'}
              </span>
            ))}
          </div>

          {/* Time */}
          {post.scheduled_at && (
            <span className="text-xs text-[#726d6c]">
              {compact ? formatRelativeTime(post.scheduled_at) : formatDate(post.scheduled_at)}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </div>
  );
}

function DraftCard({ post }: { post: ScheduledPost }) {
  return (
    <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/20 hover:border-[#502d26]/40 transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#302927] flex-shrink-0">
          {post.thumbnail_url ? (
            <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm">📝</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {post.title || 'Untitled Draft'}
          </p>
          <p className="text-[10px] text-[#726d6c] truncate mt-0.5">
            {post.caption?.slice(0, 30) || 'No caption'}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-[#171616] border border-[#502d26]/20">
      <div className="flex items-center gap-2 text-[#726d6c] mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-[#ede8df]">{value}</p>
    </div>
  );
}

// =============================================================================
// PLACEHOLDER VIEWS
// =============================================================================

function LibraryView() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-[#171616] border border-[#502d26]/40 flex items-center justify-center mx-auto mb-4">
          {Icons.library}
        </div>
        <h3 className="text-lg font-medium text-[#ede8df] mb-2">Content Library</h3>
        <p className="text-sm text-[#726d6c]">
          Upload and manage media for social posts. Drag-drop uploads, batch processing, and organization.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SocialPostingPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);

  // Fetch entities first
  useEffect(() => {
    async function loadEntities() {
      try {
        const res = await fetch('/api/entities');
        if (res.ok) {
          const data = (await res.json()) as { entities?: Entity[] };
          const entityList = data.entities || [];
          setEntities(entityList);
          // Auto-select first entity
          if (entityList.length > 0 && !selectedEntityId) {
            setSelectedEntityId(entityList[0].id);
          }
        }
      } catch (err) {
        console.error('[SocialPosting] Failed to load entities:', err);
      }
    }
    loadEntities();
  }, []);

  // Fetch posts and accounts when entity changes
  const fetchData = useCallback(async () => {
    if (!selectedEntityId) return;

    setLoading(true);
    try {
      // Fetch posts filtered by entity
      const postsRes = await fetch(`/api/social/posts?entity_id=${selectedEntityId}`);
      if (postsRes.ok) {
        const postsData = (await postsRes.json()) as { posts?: ScheduledPost[] };
        setPosts(postsData.posts || []);
      }

      // Fetch accounts filtered by entity
      const accountsRes = await fetch(`/api/social/accounts?entity_id=${selectedEntityId}`);
      if (accountsRes.ok) {
        const accountsData = (await accountsRes.json()) as { accounts?: ConnectedAccount[] };
        setAccounts(accountsData.accounts || []);
      }
    } catch (err) {
      console.error('[SocialPosting] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    if (selectedEntityId) {
      fetchData();
    }
  }, [selectedEntityId, fetchData]);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);

  const navItems = [
    { id: 'dashboard' as ViewMode, label: 'Dashboard', icon: Icons.dashboard },
    { id: 'create' as ViewMode, label: 'Create', icon: Icons.create },
    { id: 'calendar' as ViewMode, label: 'Calendar', icon: Icons.calendar },
    { id: 'library' as ViewMode, label: 'Library', icon: Icons.library },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0d0c0a]">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between p-3 border-b border-[#502d26]/20 bg-[#0d0c0a]/80 backdrop-blur-sm">
        {/* Left: Nav Items */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setViewMode(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === item.id
                  ? 'bg-[#302927] text-[#ede8df]'
                  : 'text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927]/50'
              }`}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Right: Entity Selector */}
        <div className="relative">
          <button
            onClick={() => setEntityDropdownOpen(!entityDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/30 hover:border-[#502d26]/50 transition-colors"
          >
            {selectedEntity?.logo_url ? (
              <img src={selectedEntity.logo_url} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: selectedEntity?.color || '#843c2d' }}
              >
                {selectedEntity?.name?.charAt(0) || '?'}
              </div>
            )}
            <span className="text-sm font-medium">{selectedEntity?.name || 'Select'}</span>
            <svg className="w-4 h-4 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Dropdown */}
          {entityDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setEntityDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[#171616] border border-[#502d26]/40 shadow-xl z-20 overflow-hidden">
                {entities.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => {
                      setSelectedEntityId(entity.id);
                      setEntityDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#302927] transition-colors ${
                      selectedEntityId === entity.id ? 'bg-[#302927]' : ''
                    }`}
                  >
                    {entity.logo_url ? (
                      <img src={entity.logo_url} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: entity.color || '#843c2d' }}
                      >
                        {entity.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entity.name}</p>
                      {entity.description && (
                        <p className="text-[10px] text-[#726d6c] truncate">{entity.description}</p>
                      )}
                    </div>
                    {selectedEntityId === entity.id && (
                      <svg className="w-4 h-4 text-[#843c2d]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'dashboard' && (
          <DashboardView
            posts={posts}
            accounts={accounts}
            loading={loading}
            onCreatePost={() => setViewMode('create')}
            onViewCalendar={() => setViewMode('calendar')}
            onRefresh={fetchData}
          />
        )}
        {viewMode === 'create' && selectedEntityId && (
          <PostWizard
            entityId={selectedEntityId}
            entityName={selectedEntity?.name || ''}
            accounts={accounts}
            onClose={() => setViewMode('dashboard')}
            onComplete={() => {
              fetchData();
              setViewMode('dashboard');
            }}
          />
        )}
        {viewMode === 'calendar' && (
          <CalendarView
            posts={posts}
            onPostClick={(post) => {
              // TODO: Open post detail/edit view
              console.log('Post clicked:', post.id);
            }}
            onCreatePost={(date) => {
              // TODO: Pre-fill date in wizard
              console.log('Create post for:', date);
              setViewMode('create');
            }}
          />
        )}
        {viewMode === 'library' && <LibraryView />}
      </div>
    </div>
  );
}

export default SocialPostingPanel;
