'use client';

import { useState } from 'react';
import type { Account, Campaign, PostingSlot } from '../page';

// =============================================================================
// TYPES
// =============================================================================

interface SettingsViewProps {
  accounts: Account[];
  campaigns: Campaign[];
  slots: PostingSlot[];
  onRefresh: () => void;
}

type SettingsSection = 'accounts' | 'schedule' | 'campaigns';

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

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'from-pink-500 to-purple-600',
  tiktok: 'from-gray-800 to-black',
  youtube: 'from-red-600 to-red-700',
  facebook: 'from-blue-600 to-blue-700',
  threads: 'from-gray-700 to-gray-800',
  twitter: 'from-sky-400 to-sky-500',
  linkedin: 'from-blue-700 to-blue-800',
  pinterest: 'from-red-600 to-red-700',
  bluesky: 'from-sky-500 to-blue-500',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// =============================================================================
// HELPERS
// =============================================================================

function formatSlotTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  chevronRight: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  folder: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  sync: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  trash: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  edit: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SettingsView({
  accounts,
  campaigns,
  slots,
  onRefresh,
}: SettingsViewProps) {
  const [expandedSection, setExpandedSection] = useState<SettingsSection | null>('accounts');
  const [syncing, setSyncing] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [newSlotTime, setNewSlotTime] = useState('14:00');
  const [showNewSlotForm, setShowNewSlotForm] = useState(false);
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignColor, setNewCampaignColor] = useState('#D4A853');

  const activeAccounts = accounts.filter((a) => a.is_active);
  const activeSlots = slots.filter((s) => s.is_active);
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');

  // Sync accounts
  const handleSyncAccounts = async () => {
    setSyncing(true);
    try {
      await fetch('/api/social/accounts/sync', { method: 'POST' });
      onRefresh();
    } catch (error) {
      console.error('[Settings] Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Create new slot
  const handleCreateSlot = async () => {
    try {
      await fetch('/api/social/studio/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: newSlotTime,
          day_of_week: null, // Every day
          platforms: ['instagram', 'tiktok'],
          is_active: true,
        }),
      });
      setShowNewSlotForm(false);
      setNewSlotTime('14:00');
      onRefresh();
    } catch (error) {
      console.error('[Settings] Create slot error:', error);
    }
  };

  // Delete slot
  const handleDeleteSlot = async (slotId: string) => {
    try {
      await fetch(`/api/social/studio/slots/${slotId}`, {
        method: 'DELETE',
      });
      onRefresh();
    } catch (error) {
      console.error('[Settings] Delete slot error:', error);
    }
  };

  // Create new campaign
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    try {
      await fetch('/api/social/studio/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          color: newCampaignColor,
          status: 'active',
        }),
      });
      setShowNewCampaignForm(false);
      setNewCampaignName('');
      setNewCampaignColor('#D4A853');
      onRefresh();
    } catch (error) {
      console.error('[Settings] Create campaign error:', error);
    }
  };

  // Archive campaign
  const handleArchiveCampaign = async (campaignId: string) => {
    try {
      await fetch(`/api/social/studio/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      onRefresh();
    } catch (error) {
      console.error('[Settings] Archive campaign error:', error);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-[#726d6c] mt-1">
            Configure your posting schedule and accounts
          </p>
        </div>

        {/* Connected Accounts Section */}
        <section className="rounded-xl bg-[#1a1a1a] border border-[#252525] overflow-hidden">
          <button
            onClick={() =>
              setExpandedSection(expandedSection === 'accounts' ? null : 'accounts')
            }
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#D4A853]">{Icons.users}</span>
              <div>
                <div className="text-white font-medium">Connected Accounts</div>
                <div className="text-xs text-[#726d6c]">
                  {activeAccounts.length} active account{activeAccounts.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <span
              className={`text-[#726d6c] transition-transform ${
                expandedSection === 'accounts' ? 'rotate-90' : ''
              }`}
            >
              {Icons.chevronRight}
            </span>
          </button>

          {expandedSection === 'accounts' && (
            <div className="px-4 pb-4 space-y-3">
              {/* Sync Button */}
              <button
                onClick={handleSyncAccounts}
                disabled={syncing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#252525] text-[#D4A853] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50"
              >
                <span className={syncing ? 'animate-spin' : ''}>{Icons.sync}</span>
                {syncing ? 'Syncing...' : 'Sync from Post for Me'}
              </button>

              {/* Account List */}
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      account.is_active
                        ? 'bg-[#252525]'
                        : 'bg-[#252525]/50 opacity-50'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                        PLATFORM_COLORS[account.platform] || 'from-gray-600 to-gray-700'
                      } flex items-center justify-center overflow-hidden`}
                    >
                      {account.profile_image_url ? (
                        <img
                          src={account.profile_image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">{PLATFORM_ICONS[account.platform] || '📱'}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">
                        {account.account_name || `@${account.account_handle}`}
                      </div>
                      <div className="text-xs text-[#726d6c]">
                        {account.platform.charAt(0).toUpperCase() + account.platform.slice(1)} •
                        @{account.account_handle}
                      </div>
                    </div>

                    {account.is_active && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                        Active
                      </span>
                    )}
                  </div>
                ))}

                {accounts.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-[#726d6c]">No accounts connected</p>
                    <p className="text-xs text-[#D4A853] mt-1">
                      Connect accounts via Post for Me
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Posting Schedule Section */}
        <section className="rounded-xl bg-[#1a1a1a] border border-[#252525] overflow-hidden">
          <button
            onClick={() =>
              setExpandedSection(expandedSection === 'schedule' ? null : 'schedule')
            }
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#D4A853]">{Icons.clock}</span>
              <div>
                <div className="text-white font-medium">Posting Schedule</div>
                <div className="text-xs text-[#726d6c]">
                  {activeSlots.length} time slot{activeSlots.length !== 1 ? 's' : ''} per day
                </div>
              </div>
            </div>
            <span
              className={`text-[#726d6c] transition-transform ${
                expandedSection === 'schedule' ? 'rotate-90' : ''
              }`}
            >
              {Icons.chevronRight}
            </span>
          </button>

          {expandedSection === 'schedule' && (
            <div className="px-4 pb-4 space-y-3">
              <div className="text-xs text-[#726d6c] mb-2">
                Content auto-schedules to these time slots
              </div>

              {/* Slot List */}
              <div className="space-y-2">
                {slots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      slot.is_active ? 'bg-[#252525]' : 'bg-[#252525]/50 opacity-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                      <span className="text-[#D4A853]">{Icons.clock}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">
                        {formatSlotTime(slot.time)}
                      </div>
                      <div className="text-xs text-[#726d6c]">
                        {slot.day_of_week !== null
                          ? DAY_NAMES[slot.day_of_week]
                          : 'Every day'}
                        {slot.label && ` • ${slot.label}`}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#726d6c] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      {Icons.trash}
                    </button>
                  </div>
                ))}

                {slots.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-[#726d6c]">No time slots configured</p>
                  </div>
                )}
              </div>

              {/* Add New Slot */}
              {showNewSlotForm ? (
                <div className="p-4 rounded-xl bg-[#252525] space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={newSlotTime}
                      onChange={(e) => setNewSlotTime(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewSlotForm(false)}
                      className="flex-1 py-2 rounded-lg bg-[#1a1a1a] text-[#726d6c] text-sm hover:bg-[#252525] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateSlot}
                      className="flex-1 py-2 rounded-lg bg-[#D4A853] text-black text-sm font-medium"
                    >
                      Add Slot
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewSlotForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#252525] text-[#726d6c] hover:border-[#D4A853]/30 hover:text-[#D4A853] transition-colors"
                >
                  {Icons.plus}
                  <span className="text-sm">Add Time Slot</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* Campaigns Section */}
        <section className="rounded-xl bg-[#1a1a1a] border border-[#252525] overflow-hidden">
          <button
            onClick={() =>
              setExpandedSection(expandedSection === 'campaigns' ? null : 'campaigns')
            }
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#D4A853]">{Icons.folder}</span>
              <div>
                <div className="text-white font-medium">Campaigns</div>
                <div className="text-xs text-[#726d6c]">
                  {activeCampaigns.length} active campaign
                  {activeCampaigns.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <span
              className={`text-[#726d6c] transition-transform ${
                expandedSection === 'campaigns' ? 'rotate-90' : ''
              }`}
            >
              {Icons.chevronRight}
            </span>
          </button>

          {expandedSection === 'campaigns' && (
            <div className="px-4 pb-4 space-y-3">
              <div className="text-xs text-[#726d6c] mb-2">
                Organize posts by project or theme
              </div>

              {/* Campaign List */}
              <div className="space-y-2">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      campaign.status === 'active'
                        ? 'bg-[#252525]'
                        : 'bg-[#252525]/50 opacity-50'
                    }`}
                  >
                    <div
                      className="w-3 h-10 rounded-full"
                      style={{ backgroundColor: campaign.color || '#726d6c' }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{campaign.name}</div>
                      <div className="text-xs text-[#726d6c]">
                        {campaign.post_count} post{campaign.post_count !== 1 ? 's' : ''} •{' '}
                        {campaign.status}
                      </div>
                    </div>

                    {campaign.status === 'active' && (
                      <button
                        onClick={() => handleArchiveCampaign(campaign.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#726d6c] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        title="Archive"
                      >
                        {Icons.folder}
                      </button>
                    )}
                  </div>
                ))}

                {campaigns.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-[#726d6c]">No campaigns created</p>
                  </div>
                )}
              </div>

              {/* Add New Campaign */}
              {showNewCampaignForm ? (
                <div className="p-4 rounded-xl bg-[#252525] space-y-3">
                  <input
                    type="text"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    placeholder="Campaign name..."
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm placeholder-[#726d6c]"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#726d6c]">Color:</span>
                    <div className="flex gap-2">
                      {['#D4A853', '#843c2d', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899'].map(
                        (color) => (
                          <button
                            key={color}
                            onClick={() => setNewCampaignColor(color)}
                            className={`w-6 h-6 rounded-full ${
                              newCampaignColor === color
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-[#252525]'
                                : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewCampaignForm(false)}
                      className="flex-1 py-2 rounded-lg bg-[#1a1a1a] text-[#726d6c] text-sm hover:bg-[#252525] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCampaign}
                      disabled={!newCampaignName.trim()}
                      className="flex-1 py-2 rounded-lg bg-[#D4A853] text-black text-sm font-medium disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCampaignForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#252525] text-[#726d6c] hover:border-[#D4A853]/30 hover:text-[#D4A853] transition-colors"
                >
                  {Icons.plus}
                  <span className="text-sm">New Campaign</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* About Section */}
        <section className="rounded-xl bg-[#1a1a1a] border border-[#252525] p-4">
          <div className="text-center">
            <div className="text-2xl mb-2">📱</div>
            <div className="text-sm font-medium text-white">Social Studio</div>
            <div className="text-xs text-[#726d6c] mt-1">
              Powered by Post for Me
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
