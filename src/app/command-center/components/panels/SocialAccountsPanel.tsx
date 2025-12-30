'use client';

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

interface SocialAccount {
  id: string;
  platform: string;
  account_handle: string;
  account_name: string;
  profile_image_url?: string;
  is_active: boolean;
  connected_at: string;
  last_synced_at?: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  accounts_synced: number;
  posts_synced: number;
  metrics_synced: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  triggered_by: string;
}

interface SyncStatus {
  is_configured: boolean;
  connected_accounts: Array<{ platform: string; count: number }>;
  last_successful_sync: SyncLog | null;
  recent_syncs: SyncLog[];
}

// =============================================================================
// Constants
// =============================================================================

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  tiktok: '#000000',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  threads: '#000000',
  pinterest: '#E60023',
  bluesky: '#0085FF',
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: 'camera',
  tiktok: 'music',
  youtube: 'play',
  twitter: 'bird',
  facebook: 'users',
  linkedin: 'briefcase',
  threads: 'at-sign',
  pinterest: 'pin',
  bluesky: 'cloud',
};

// =============================================================================
// Component
// =============================================================================

export function SocialAccountsPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('accounts');

  // Load sync status and accounts
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get sync status
      const statusRes = await fetch('/api/social/sync');
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as SyncStatus;
        setStatus(statusData);
      }

      // Get accounts (from our DB)
      const accountsRes = await fetch('/api/social/accounts');
      if (accountsRes.ok) {
        const accountsData = (await accountsRes.json()) as { accounts?: SocialAccount[] };
        setAccounts(accountsData.accounts || []);
      }
    } catch (e) {
      console.error('Failed to load social data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Trigger sync
  const handleSync = async (type: 'full' | 'accounts' | 'posts' | 'analytics' = 'full') => {
    setSyncing(true);
    try {
      const res = await fetch('/api/social/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, triggered_by: 'manual' }),
      });

      if (res.ok) {
        // Reload data after sync
        await loadData();
      } else {
        const error = await res.json();
        console.error('Sync failed:', error);
      }
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Format relative time
  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'just now';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Social Accounts</h3>
          <button
            onClick={() => handleSync('full')}
            disabled={syncing || !status?.is_configured}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              syncing || !status?.is_configured
                ? 'bg-[#302927] text-[#726d6c] cursor-not-allowed'
                : 'bg-[#843c2d] text-white hover:bg-[#9a4a3a]'
            }`}
          >
            {syncing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Sync Now
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['accounts', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-[#302927] text-[#ede8df]'
                  : 'text-[#726d6c] hover:text-[#ede8df]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !status?.is_configured ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🔌</div>
            <h3 className="font-semibold mb-2">Post for Me Not Configured</h3>
            <p className="text-sm text-[#726d6c] mb-4">
              Add your Post for Me API key to sync social accounts
            </p>
            <a
              href="https://www.postforme.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#843c2d] text-white rounded-lg text-sm hover:bg-[#9a4a3a] transition-colors"
            >
              Get API Key
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
            <p className="text-xs text-[#726d6c] mt-4">
              Then add POSTFORME_API_KEY to your environment
            </p>
          </div>
        ) : activeTab === 'accounts' ? (
          <div className="space-y-4">
            {/* Connected accounts summary */}
            <div className="grid grid-cols-3 gap-2">
              {status.connected_accounts.map((acc) => (
                <div
                  key={acc.platform}
                  className="p-3 rounded-lg bg-[#0d0c0a] border border-[#502d26]/20 text-center"
                >
                  <div
                    className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-white mb-2"
                    style={{ backgroundColor: PLATFORM_COLORS[acc.platform] || '#726d6c' }}
                  >
                    <span className="text-xs font-bold">{acc.count}</span>
                  </div>
                  <div className="text-[10px] text-[#726d6c]">
                    {PLATFORM_NAMES[acc.platform] || acc.platform}
                  </div>
                </div>
              ))}
            </div>

            {/* Account list */}
            {accounts.length > 0 ? (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0c0a] border border-[#502d26]/20"
                  >
                    <div
                      className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                      style={{
                        backgroundColor: PLATFORM_COLORS[account.platform] || '#726d6c',
                      }}
                    >
                      {account.profile_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.profile_image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-lg">
                          {account.account_handle?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {account.account_name || account.account_handle}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${PLATFORM_COLORS[account.platform]}20`,
                            color: PLATFORM_COLORS[account.platform],
                          }}
                        >
                          {PLATFORM_NAMES[account.platform] || account.platform}
                        </span>
                      </div>
                      <p className="text-xs text-[#726d6c]">@{account.account_handle}</p>
                    </div>
                    <div className="text-right text-xs text-[#726d6c]">
                      {account.last_synced_at && (
                        <div>Synced {timeAgo(account.last_synced_at)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📱</div>
                <p className="text-sm text-[#726d6c]">No accounts synced yet</p>
                <button
                  onClick={() => handleSync('accounts')}
                  className="mt-3 text-xs text-[#843c2d] hover:underline"
                >
                  Sync accounts from Post for Me
                </button>
              </div>
            )}

            {/* Last sync info */}
            {status.last_successful_sync && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs">
                <div className="flex items-center gap-2 text-green-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Last sync: {timeAgo(status.last_successful_sync.completed_at || '')}
                </div>
                <div className="text-[#726d6c] mt-1">
                  {status.last_successful_sync.accounts_synced} accounts,{' '}
                  {status.last_successful_sync.posts_synced} posts,{' '}
                  {status.last_successful_sync.metrics_synced} metrics
                </div>
              </div>
            )}
          </div>
        ) : (
          /* History tab */
          <div className="space-y-2">
            {status.recent_syncs.length > 0 ? (
              status.recent_syncs.map((sync) => (
                <div
                  key={sync.id}
                  className={`p-3 rounded-lg border ${
                    sync.status === 'completed'
                      ? 'bg-green-500/5 border-green-500/20'
                      : sync.status === 'failed'
                        ? 'bg-red-500/5 border-red-500/20'
                        : 'bg-[#0d0c0a] border-[#502d26]/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {sync.status === 'completed' ? (
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      ) : sync.status === 'failed' ? (
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      )}
                      <span className="text-sm font-medium capitalize">{sync.sync_type} sync</span>
                    </div>
                    <span className="text-xs text-[#726d6c]">{timeAgo(sync.started_at)}</span>
                  </div>
                  {sync.status === 'completed' && (
                    <div className="text-xs text-[#726d6c]">
                      {sync.accounts_synced} accounts, {sync.posts_synced} posts,{' '}
                      {sync.metrics_synced} metrics
                      {sync.duration_ms && ` (${Math.round(sync.duration_ms / 1000)}s)`}
                    </div>
                  )}
                  {sync.status === 'failed' && sync.error_message && (
                    <div className="text-xs text-red-400 mt-1">{sync.error_message}</div>
                  )}
                  <div className="text-[10px] text-[#502d26] mt-1">
                    Triggered by {sync.triggered_by}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm text-[#726d6c]">No sync history yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
