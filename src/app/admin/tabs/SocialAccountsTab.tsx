'use client';

import { useState, useEffect, useCallback } from 'react';

interface Entity {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

interface ConnectedAccount {
  id: string;
  entity_id?: string;
  platform: string;
  account_handle: string;
  account_name?: string;
  profile_image_url?: string;
  is_active: boolean;
  connected_at: string;
  last_synced_at?: string;
}

const PLATFORM_CONFIG: Record<string, { icon: string; color: string; name: string }> = {
  instagram: { icon: '📸', color: '#E4405F', name: 'Instagram' },
  tiktok: { icon: '🎵', color: '#000000', name: 'TikTok' },
  youtube: { icon: '📺', color: '#FF0000', name: 'YouTube' },
  twitter: { icon: '🐦', color: '#1DA1F2', name: 'Twitter/X' },
  facebook: { icon: '👤', color: '#1877F2', name: 'Facebook' },
};

export default function SocialAccountsTab() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Fetch entities
  useEffect(() => {
    const loadEntities = async () => {
      try {
        const res = await fetch('/api/entities');
        const data = await res.json() as { entities?: Entity[] };
        setEntities(data.entities || []);
        if (data.entities && data.entities.length > 0 && !selectedEntity) {
          setSelectedEntity(data.entities[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch entities:', err);
      }
    };
    loadEntities();
  }, [selectedEntity]);

  // Fetch accounts for selected entity
  const fetchAccounts = useCallback(async () => {
    if (!selectedEntity) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/social/accounts?entity_id=${selectedEntity}`);
      const data: { accounts?: ConnectedAccount[] } = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntity]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Sync accounts from PostForMe
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/social/accounts/sync', { method: 'POST' });
      const data: { success?: boolean } = await res.json();
      if (data.success) {
        await fetchAccounts();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Group accounts by platform
  const accountsByPlatform = accounts.reduce((acc, account) => {
    const platform = account.platform.toLowerCase();
    if (!acc[platform]) acc[platform] = [];
    acc[platform].push(account);
    return acc;
  }, {} as Record<string, ConnectedAccount[]>);

  const selectedEntityData = entities.find(e => e.id === selectedEntity);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#ede8df]">Connected Accounts</h1>
          <p className="text-sm text-[#726d6c] mt-1">
            Manage social media accounts
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-3 sm:py-2 bg-[#843c2d] hover:bg-[#6b3225] active:bg-[#5a2a1f] text-white rounded-xl sm:rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <svg className={`w-5 h-5 sm:w-4 sm:h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span className="font-medium">{syncing ? 'Syncing...' : 'Sync from PostForMe'}</span>
        </button>
      </div>

      {/* Entity Selector - horizontal scroll on mobile */}
      {entities.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#b2a491] mb-2">Entity</label>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            {entities.map(entity => (
              <button
                key={entity.id}
                onClick={() => setSelectedEntity(entity.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  selectedEntity === entity.id
                    ? 'bg-[#843c2d] text-white'
                    : 'bg-[#1a1816] text-[#726d6c] hover:text-[#b2a491] border border-[#302927] active:bg-[#302927]'
                }`}
              >
                {entity.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[#1a1816] rounded-xl border border-[#302927]">
          <div className="text-5xl mb-4">📱</div>
          <h3 className="text-lg font-medium text-[#ede8df] mb-2">No Accounts Connected</h3>
          <p className="text-sm text-[#726d6c] mb-6 max-w-xs mx-auto">
            Connect your social accounts in PostForMe, then sync them here to start posting
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full sm:w-auto px-6 py-3 bg-[#843c2d] hover:bg-[#6b3225] active:bg-[#5a2a1f] text-white rounded-xl transition-colors min-h-[44px]"
          >
            Sync from PostForMe
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(accountsByPlatform).map(([platform, platformAccounts]) => {
            const config = PLATFORM_CONFIG[platform] || { icon: '🌐', color: '#666', name: platform };
            return (
              <div key={platform}>
                <h3 className="text-sm font-medium text-[#b2a491] mb-3 flex items-center gap-2 px-1">
                  <span className="text-lg">{config.icon}</span>
                  {config.name}
                  <span className="text-xs text-[#726d6c]">({platformAccounts.length})</span>
                </h3>
                <div className="space-y-2">
                  {platformAccounts.map(account => (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-[#1a1816] rounded-xl border border-[#302927] hover:border-[#502d26]/50 transition-colors"
                    >
                      {/* Profile Image */}
                      {account.profile_image_url ? (
                        <img
                          src={account.profile_image_url}
                          alt={account.account_handle}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl sm:text-2xl flex-shrink-0"
                          style={{ backgroundColor: config.color + '20' }}
                        >
                          {config.icon}
                        </div>
                      )}

                      {/* Account Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[#ede8df] truncate text-sm sm:text-base">
                          {account.account_name || account.account_handle}
                        </div>
                        <div className="text-xs sm:text-sm text-[#726d6c] truncate">
                          @{account.account_handle}
                        </div>
                      </div>

                      {/* Status Pill */}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 ${
                        account.is_active
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-[#726d6c]/20 text-[#726d6c]'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${account.is_active ? 'bg-emerald-500' : 'bg-[#726d6c]'}`} />
                        <span className="text-xs font-medium">
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Last Synced - hidden on mobile */}
                      {account.last_synced_at && (
                        <div className="hidden sm:block text-xs text-[#502d26] flex-shrink-0">
                          Synced {new Date(account.last_synced_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <div className="mt-8 p-4 bg-[#302927]/30 rounded-xl border border-[#502d26]/20">
        <h4 className="text-sm font-medium text-[#b2a491] mb-2">How it works</h4>
        <p className="text-xs text-[#726d6c] leading-relaxed">
          1. Connect your Instagram, TikTok, and YouTube accounts in{' '}
          <a href="https://postforme.dev" target="_blank" rel="noopener noreferrer" className="text-[#843c2d] hover:underline">
            PostForMe
          </a>
          <br />
          2. Click &quot;Sync from PostForMe&quot; to pull them in here
          <br />
          3. Then use Content CMS to publish directly to all platforms
        </p>
      </div>
    </div>
  );
}
