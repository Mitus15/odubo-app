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
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#ede8df]">Connected Accounts</h1>
          <p className="text-sm text-[#726d6c] mt-1">
            Manage social media accounts for each entity
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-[#843c2d] hover:bg-[#6b3225] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {syncing ? 'Syncing...' : 'Sync Accounts'}
        </button>
      </div>

      {/* Entity Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#b2a491] mb-2">Entity</label>
        <div className="flex gap-2">
          {entities.map(entity => (
            <button
              key={entity.id}
              onClick={() => setSelectedEntity(entity.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedEntity === entity.id
                  ? 'bg-[#843c2d] text-white'
                  : 'bg-[#1a1816] text-[#726d6c] hover:text-[#b2a491] border border-[#302927]'
              }`}
            >
              {entity.name}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1816] rounded-xl border border-[#302927]">
          <div className="text-4xl mb-4">📱</div>
          <h3 className="text-lg font-medium text-[#ede8df] mb-2">No Accounts Connected</h3>
          <p className="text-sm text-[#726d6c] mb-4">
            Connect social accounts for {selectedEntityData?.name || 'this entity'} to start posting
          </p>
          <button
            onClick={handleSync}
            className="px-4 py-2 bg-[#843c2d] hover:bg-[#6b3225] text-white rounded-lg transition-colors"
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
                <h3 className="text-sm font-medium text-[#b2a491] mb-3 flex items-center gap-2">
                  <span>{config.icon}</span>
                  {config.name}
                </h3>
                <div className="space-y-2">
                  {platformAccounts.map(account => (
                    <div
                      key={account.id}
                      className="flex items-center gap-4 p-4 bg-[#1a1816] rounded-xl border border-[#302927] hover:border-[#502d26]/50 transition-colors"
                    >
                      {/* Profile Image */}
                      {account.profile_image_url ? (
                        <img
                          src={account.profile_image_url}
                          alt={account.account_handle}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                          style={{ backgroundColor: config.color + '20' }}
                        >
                          {config.icon}
                        </div>
                      )}

                      {/* Account Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[#ede8df] truncate">
                          {account.account_name || account.account_handle}
                        </div>
                        <div className="text-sm text-[#726d6c]">
                          @{account.account_handle}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${account.is_active ? 'bg-emerald-500' : 'bg-[#726d6c]'}`} />
                        <span className="text-xs text-[#726d6c]">
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Last Synced */}
                      {account.last_synced_at && (
                        <div className="text-xs text-[#502d26]">
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
        <h4 className="text-sm font-medium text-[#b2a491] mb-2">About Connected Accounts</h4>
        <p className="text-xs text-[#726d6c] leading-relaxed">
          Accounts are synced from PostForMe. Each entity can have multiple accounts per platform.
          When creating posts, you can select which specific accounts to publish to.
        </p>
      </div>
    </div>
  );
}
