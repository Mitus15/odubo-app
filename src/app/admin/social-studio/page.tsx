'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';

// =============================================================================
// TYPES
// =============================================================================

export type StudioView = 'home' | 'calendar' | 'create' | 'library' | 'settings';

export interface Post {
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

// =============================================================================
// DYNAMIC IMPORTS (Code Splitting)
// =============================================================================

const HomeView = dynamic(() => import('./components/HomeView'), {
  loading: () => <ViewLoading label="Dashboard" />,
});

const CalendarView = dynamic(() => import('./components/CalendarView'), {
  loading: () => <ViewLoading label="Calendar" />,
});

const CreateFlow = dynamic(() => import('./components/CreateFlow'), {
  loading: () => <ViewLoading label="Create Post" />,
});

const LibraryView = dynamic(() => import('./components/LibraryView'), {
  loading: () => <ViewLoading label="Library" />,
});

const SettingsView = dynamic(() => import('./components/SettingsView'), {
  loading: () => <ViewLoading label="Settings" />,
});

const PostDetailSheet = dynamic(() => import('./components/PostDetailSheet'));

// =============================================================================
// LOADING COMPONENT
// =============================================================================

function ViewLoading({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#D4A853]/30 border-t-[#D4A853] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-[#726d6c]">Loading {label}...</p>
      </div>
    </div>
  );
}

// =============================================================================
// BOTTOM NAV ICONS
// =============================================================================

const Icons = {
  home: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.592 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  calendar: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  create: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  library: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  settings: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SocialStudioPage() {
  const [view, setView] = useState<StudioView>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [slots, setSlots] = useState<PostingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [createForSlot, setCreateForSlot] = useState<{ date: string; time: string } | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, accountsRes, campaignsRes, slotsRes] = await Promise.all([
        fetch('/api/social/posts'),
        fetch('/api/social/accounts'),
        fetch('/api/social/studio/campaigns'),
        fetch('/api/social/studio/slots'),
      ]);

      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(data.posts || []);
      }

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.accounts || []);
      }

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns || []);
      }

      if (slotsRes.ok) {
        const data = await slotsRes.json();
        setSlots(data.slots || []);
      }
    } catch (err) {
      console.error('[SocialStudio] Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync all posts from Post for Me
  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      // Sync accounts first
      await fetch('/api/social/accounts/sync', { method: 'POST' });

      // Refetch data
      await fetchData();
    } catch (err) {
      console.error('[SocialStudio] Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle opening create with pre-filled slot
  const handleCreateForSlot = (date: string, time: string) => {
    setCreateForSlot({ date, time });
    setView('create');
  };

  // Handle create complete
  const handleCreateComplete = () => {
    setCreateForSlot(null);
    setView('home');
    fetchData();
  };

  // Handle view post detail
  const handleViewPost = (postId: string) => {
    setSelectedPostId(postId);
  };

  // Render current view
  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <HomeView
            posts={posts}
            accounts={accounts}
            slots={slots}
            loading={loading}
            syncing={syncing}
            onSync={syncAll}
            onViewPost={handleViewPost}
            onCreateForSlot={handleCreateForSlot}
            onNavigate={setView}
          />
        );

      case 'calendar':
        return (
          <CalendarView
            posts={posts}
            slots={slots}
            onViewPost={handleViewPost}
            onCreateForSlot={handleCreateForSlot}
          />
        );

      case 'create':
        return (
          <CreateFlow
            accounts={accounts}
            campaigns={campaigns}
            slots={slots}
            prefillSlot={createForSlot}
            onComplete={handleCreateComplete}
            onCancel={() => {
              setCreateForSlot(null);
              setView('home');
            }}
          />
        );

      case 'library':
        return (
          <LibraryView
            posts={posts}
            campaigns={campaigns}
            onViewPost={handleViewPost}
            onRefresh={fetchData}
          />
        );

      case 'settings':
        return (
          <SettingsView
            accounts={accounts}
            campaigns={campaigns}
            slots={slots}
            onRefresh={fetchData}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<ViewLoading label="" />}>
          {renderView()}
        </Suspense>
      </div>

      {/* Bottom Navigation - Fixed */}
      <nav className="flex-shrink-0 bg-black border-t border-[#1a1a1a] safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {/* Home */}
          <button
            onClick={() => setView('home')}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
              view === 'home' ? 'text-[#D4A853]' : 'text-[#726d6c]'
            }`}
          >
            {Icons.home}
            <span className="text-[10px] mt-0.5 font-medium">Home</span>
          </button>

          {/* Calendar */}
          <button
            onClick={() => setView('calendar')}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
              view === 'calendar' ? 'text-[#D4A853]' : 'text-[#726d6c]'
            }`}
          >
            {Icons.calendar}
            <span className="text-[10px] mt-0.5 font-medium">Calendar</span>
          </button>

          {/* Create (Center - Gold) */}
          <button
            onClick={() => setView('create')}
            className="flex items-center justify-center w-14 h-14 -mt-4 rounded-full bg-[#D4A853] text-black shadow-lg shadow-[#D4A853]/30 active:scale-95 transition-transform"
          >
            {Icons.create}
          </button>

          {/* Library */}
          <button
            onClick={() => setView('library')}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
              view === 'library' ? 'text-[#D4A853]' : 'text-[#726d6c]'
            }`}
          >
            {Icons.library}
            <span className="text-[10px] mt-0.5 font-medium">Library</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setView('settings')}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
              view === 'settings' ? 'text-[#D4A853]' : 'text-[#726d6c]'
            }`}
          >
            {Icons.settings}
            <span className="text-[10px] mt-0.5 font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Post Detail Sheet */}
      {selectedPostId && (
        <Suspense fallback={null}>
          <PostDetailSheet
            postId={selectedPostId}
            accounts={accounts}
            onClose={() => setSelectedPostId(null)}
            onRefresh={fetchData}
          />
        </Suspense>
      )}
    </div>
  );
}
