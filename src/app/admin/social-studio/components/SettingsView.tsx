'use client';

import { useState, useEffect } from 'react';
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

type SettingsSection = 'general' | 'ai' | 'accounts' | 'schedule' | 'campaigns';

type TonePreset = 'professional' | 'casual' | 'playful' | 'artistic' | 'custom';

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
  tiktok: 'from-[#00f2ea] to-[#ff0050]', // TikTok brand colors
  youtube: 'from-red-600 to-red-700',
  facebook: 'from-blue-600 to-blue-700',
  threads: 'from-gray-600 to-gray-700',
  twitter: 'from-sky-400 to-sky-500',
  linkedin: 'from-blue-700 to-blue-800',
  pinterest: 'from-red-600 to-red-700',
  bluesky: 'from-sky-500 to-blue-500',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  archive: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 22.5l-.394-1.933a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  externalLink: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
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
  const [expandedSection, setExpandedSection] = useState<SettingsSection | null>('general');
  const [syncing, setSyncing] = useState(false);
  const [showNewSlotForm, setShowNewSlotForm] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('14:00');
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignColor, setNewCampaignColor] = useState('#843c2d');
  
  // General settings state
  const [settings, setSettings] = useState<{
    slots_per_day: number;
    default_timezone: string;
    auto_hashtag_limit: number;
    require_approval: boolean;
  } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // AI Voice settings state
  const [aiProfile, setAiProfile] = useState<{
    id: number;
    tone_description: string | null;
    custom_instructions: string | null;
    max_emojis: number;
    max_hashtags: number;
    is_active: number;
  } | null>(null);
  const [tonePreset, setTonePreset] = useState<TonePreset>('casual');
  const [customTone, setCustomTone] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [maxEmojis, setMaxEmojis] = useState(1);
  const [maxHashtags, setMaxHashtags] = useState(7);
  const [savingAi, setSavingAi] = useState(false);

  const activeAccounts = accounts.filter((a) => a.is_active);
  const activeSlots = slots.filter((s) => s.is_active);
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');

  // Load settings
  useEffect(() => {
    fetchSettings();
    fetchAiProfile();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/social/settings');
      const data = await response.json() as { success: boolean; settings: typeof settings };
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('[Settings] Fetch error:', error);
    }
  };

  const handleUpdateSettings = async (updates: Partial<typeof settings>) => {
    if (!settings) return;
    
    setSavingSettings(true);
    try {
      const response = await fetch('/api/admin/social/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        setSettings({ ...settings, ...updates });
      }
    } catch (error) {
      console.error('[Settings] Update error:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  // Fetch AI profile
  const fetchAiProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/ai-studio/profiles', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json() as { activeProfile: typeof aiProfile };
        const active = data.activeProfile;
        if (active) {
          setAiProfile(active);
          setCustomTone(active.tone_description || '');
          setCustomInstructions(active.custom_instructions || '');
          setMaxEmojis(active.max_emojis || 1);
          setMaxHashtags(active.max_hashtags || 7);
          
          // Determine preset from tone description
          const tone = (active.tone_description || '').toLowerCase();
          if (tone.includes('professional') || tone.includes('corporate')) setTonePreset('professional');
          else if (tone.includes('playful') || tone.includes('fun')) setTonePreset('playful');
          else if (tone.includes('artistic') || tone.includes('creative')) setTonePreset('artistic');
          else if (tone.includes('casual') || tone.includes('friendly')) setTonePreset('casual');
          else setTonePreset('custom');
        }
      }
    } catch (error) {
      console.error('[Settings] AI profile fetch error:', error);
    }
  };

  // Save AI profile
  const handleSaveAiProfile = async () => {
    setSavingAi(true);
    try {
      const token = localStorage.getItem('token');
      
      // Get tone description based on preset
      let toneDescription = customTone;
      if (tonePreset === 'professional') {
        toneDescription = 'Professional, polished, and business-appropriate. Clear and concise messaging.';
      } else if (tonePreset === 'casual') {
        toneDescription = 'Casual, friendly, and approachable. Conversational and relatable.';
      } else if (tonePreset === 'playful') {
        toneDescription = 'Playful, energetic, and fun. Engaging with personality and humor.';
      } else if (tonePreset === 'artistic') {
        toneDescription = 'Artistic, creative, and expressive. Poetic and thought-provoking.';
      }

      if (aiProfile) {
        // Update existing profile
        const response = await fetch('/api/admin/ai-studio/profiles', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            id: aiProfile.id,
            tone_description: toneDescription,
            custom_instructions: customInstructions || null,
            max_emojis: maxEmojis,
            max_hashtags: maxHashtags,
          }),
        });
        
        if (response.ok) {
          await fetchAiProfile();
        }
      } else {
        // Create new profile
        const response = await fetch('/api/admin/ai-studio/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            name: 'Social Studio Voice',
            tone_description: toneDescription,
            custom_instructions: customInstructions || null,
            max_emojis: maxEmojis,
            max_hashtags: maxHashtags,
            is_active: true,
          }),
        });
        
        if (response.ok) {
          await fetchAiProfile();
        }
      }
    } catch (error) {
      console.error('[Settings] AI profile save error:', error);
    } finally {
      setSavingAi(false);
    }
  };

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
          day_of_week: null,
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
      await fetch(`/api/social/studio/slots/${slotId}`, { method: 'DELETE' });
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
      setNewCampaignColor('#843c2d');
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

  // Section Header Component
  const SectionHeader = ({
    icon,
    title,
    subtitle,
    section,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    section: SettingsSection;
  }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === section ? null : section)}
      className="w-full flex items-center justify-between p-4 text-left group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0d0c0a] flex items-center justify-center text-[#e8a990] group-hover:bg-[#302927] transition-colors">
          {icon}
        </div>
        <div>
          <div className="text-white font-medium tracking-tight">{title}</div>
          <div className="text-xs text-[#726d6c]">{subtitle}</div>
        </div>
      </div>
      <span
        className={`text-[#726d6c] transition-all duration-300 ${
          expandedSection === section ? 'rotate-90 text-[#e8a990]' : ''
        }`}
      >
        {Icons.chevronRight}
      </span>
    </button>
  );

  return (
    <div className="h-full overflow-y-auto bg-black">
      <div className="px-4 pt-6 pb-28 space-y-4">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-[#e8a990] mb-1">Configuration</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-[#726d6c] mt-1">
            Manage your publishing settings, accounts, and campaigns
          </p>
        </div>

        {/* General Settings Section */}
        <section className="rounded-2xl bg-black border border-[#302927] overflow-hidden hover:border-[#e8a990]/25 transition-all duration-300">
          <SectionHeader
            icon={Icons.clock}
            title="General Settings"
            subtitle="Daily slots, timezone, and posting preferences"
            section="general"
          />

          {expandedSection === 'general' && settings && (
            <div className="px-4 pb-4 space-y-4">
              {/* Slots Per Day */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Posts Per Day
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={settings.slots_per_day}
                    onChange={(e) => handleUpdateSettings({ slots_per_day: parseInt(e.target.value) })}
                    disabled={savingSettings}
                    className="flex-1 h-2 bg-[#302927] rounded-lg appearance-none cursor-pointer accent-[#843c2d]"
                  />
                  <div className="w-16 text-center">
                    <div className="text-2xl font-bold text-[#e8a990]">{settings.slots_per_day}</div>
                    <div className="text-xs text-[#726d6c]">slots</div>
                  </div>
                </div>
                <p className="text-xs text-[#726d6c] mt-2">
                  💡 All posts publish at midnight. Slot numbers help organize multiple posts per day.
                </p>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Default Timezone
                </label>
                <select
                  value={settings.default_timezone}
                  onChange={(e) => handleUpdateSettings({ default_timezone: e.target.value })}
                  disabled={savingSettings}
                  className="w-full px-4 py-3 rounded-xl bg-[#0d0c0a] border border-[#302927] text-white text-sm focus:border-[#843c2d]/40 focus:outline-none transition-colors"
                >
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              {/* Auto Hashtag Limit */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Max Hashtags (AI Suggestions)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={settings.auto_hashtag_limit}
                  onChange={(e) => handleUpdateSettings({ auto_hashtag_limit: parseInt(e.target.value) || 0 })}
                  disabled={savingSettings}
                  className="w-full px-4 py-3 rounded-xl bg-[#0d0c0a] border border-[#302927] text-white text-sm focus:border-[#843c2d]/40 focus:outline-none transition-colors"
                />
                <p className="text-xs text-[#726d6c] mt-2">
                  Limit how many hashtags AI suggests per post (0-30)
                </p>
              </div>

              {/* Require Approval Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#0d0c0a] border border-[#302927]">
                <div>
                  <div className="text-sm font-medium text-white">Require Approval</div>
                  <div className="text-xs text-[#726d6c] mt-1">
                    Posts need manual approval before publishing
                  </div>
                </div>
                <button
                  onClick={() => handleUpdateSettings({ require_approval: !settings.require_approval })}
                  disabled={savingSettings}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                    settings.require_approval ? 'bg-[#843c2d]' : 'bg-[#302927]'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                      settings.require_approval ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {savingSettings && (
                <div className="text-xs text-[#e8a990] text-center py-2">
                  Saving...
                </div>
              )}
            </div>
          )}
        </section>

        {/* AI Voice Section */}
        <section className="rounded-2xl bg-black border border-[#302927] overflow-hidden hover:border-[#e8a990]/25 transition-all duration-300">
          <SectionHeader
            icon={Icons.sparkles}
            title="AI Voice"
            subtitle={aiProfile ? "✨ AI Ready" : "Setup AI captions & hashtags"}
            section="ai"
          />

          {expandedSection === 'ai' && (
            <div className="px-4 pb-4 space-y-4">
              {/* Tone Presets */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Brand Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['professional', 'casual', 'playful', 'artistic'] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        setTonePreset(preset);
                        setCustomTone('');
                      }}
                      className={`py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                        tonePreset === preset
                          ? 'bg-gradient-to-r from-[#843c2d] to-[#6b3323] text-black shadow-[0_0_15px_rgba(212,168,83,0.2)]'
                          : 'bg-[#0d0c0a] border border-[#302927] text-[#726d6c] hover:border-[#e8a990]/35 hover:text-white'
                      }`}
                    >
                      {preset === 'professional' && '💼'} 
                      {preset === 'casual' && '😊'} 
                      {preset === 'playful' && '🎉'} 
                      {preset === 'artistic' && '🎨'}
                      {' '}
                      {preset.charAt(0).toUpperCase() + preset.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Tone (for custom preset) */}
              {tonePreset === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Custom Tone Description
                  </label>
                  <textarea
                    value={customTone}
                    onChange={(e) => setCustomTone(e.target.value)}
                    placeholder="e.g., Edgy and bold with a street art influence..."
                    className="w-full px-4 py-3 rounded-xl bg-[#0d0c0a] border border-[#302927] text-white text-sm focus:border-[#843c2d]/40 focus:outline-none transition-colors resize-none"
                    rows={3}
                  />
                </div>
              )}

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Custom Instructions (Optional)
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g., Always mention the artist name, avoid slang, include call-to-action..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0d0c0a] border border-[#302927] text-white text-sm focus:border-[#843c2d]/40 focus:outline-none transition-colors resize-none"
                  rows={3}
                />
              </div>

              {/* Max Emojis */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Max Emojis per Post
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={maxEmojis}
                    onChange={(e) => setMaxEmojis(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-[#302927] rounded-lg appearance-none cursor-pointer accent-[#843c2d]"
                  />
                  <div className="w-12 text-center">
                    <div className="text-lg font-bold text-[#e8a990]">{maxEmojis}</div>
                  </div>
                </div>
              </div>

              {/* Max Hashtags */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Max Hashtags per Post
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={maxHashtags}
                    onChange={(e) => setMaxHashtags(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-[#302927] rounded-lg appearance-none cursor-pointer accent-[#843c2d]"
                  />
                  <div className="w-12 text-center">
                    <div className="text-lg font-bold text-[#e8a990]">{maxHashtags}</div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveAiProfile}
                disabled={savingAi}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6b3323] text-black font-semibold tracking-wide shadow-[0_0_20px_rgba(212,168,83,0.2)] hover:shadow-[0_0_30px_rgba(212,168,83,0.3)] transition-all duration-300 disabled:opacity-50"
              >
                {savingAi ? 'Saving...' : aiProfile ? 'Update AI Voice' : 'Create AI Voice'}
              </button>

              {/* Link to Advanced Settings */}
              <a
                href="/admin/ai-studio"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#302927] text-[#726d6c] text-sm font-medium hover:border-[#e8a990]/35 hover:text-[#e8a990] hover:bg-[#843c2d]/5 transition-all duration-300"
              >
                <span>Advanced AI Settings</span>
                {Icons.externalLink}
              </a>

              <div className="text-xs text-[#726d6c] text-center mt-2">
                💡 AI will auto-suggest captions when you create posts
              </div>
            </div>
          )}
        </section>

        {/* Connected Accounts Section */}
        <section className="rounded-2xl bg-black border border-[#302927] overflow-hidden hover:border-[#e8a990]/25 transition-all duration-300">
          <SectionHeader
            icon={Icons.users}
            title="Connected Accounts"
            subtitle={`${activeAccounts.length} active account${activeAccounts.length !== 1 ? 's' : ''}`}
            section="accounts"
          />

          {expandedSection === 'accounts' && (
            <div className="px-4 pb-4 space-y-3">
              {/* Sync Button */}
              <button
                onClick={handleSyncAccounts}
                disabled={syncing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6b3323] text-black font-semibold tracking-wide shadow-[0_0_20px_rgba(212,168,83,0.2)] hover:shadow-[0_0_30px_rgba(212,168,83,0.3)] transition-all duration-300 disabled:opacity-50"
              >
                <span className={syncing ? 'animate-spin' : ''}>{Icons.sync}</span>
                {syncing ? 'Syncing...' : 'Sync from Post for Me'}
              </button>

              {/* Account List */}
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                      account.is_active
                        ? 'bg-[#0d0c0a] border border-[#302927] hover:border-[#e8a990]/25'
                        : 'bg-[#0d0c0a]/50 opacity-40'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${
                        PLATFORM_COLORS[account.platform] || 'from-gray-600 to-gray-700'
                      } flex items-center justify-center overflow-hidden shadow-lg`}
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
                      <div className="text-sm font-medium text-white tracking-tight">
                        {account.account_name || `@${account.account_handle}`}
                      </div>
                      <div className="text-xs text-[#726d6c]">
                        {account.platform.charAt(0).toUpperCase() + account.platform.slice(1)} •
                        @{account.account_handle}
                      </div>
                    </div>

                    {account.is_active && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider shadow-[0_0_8px_rgba(52,211,153,0.2)]">
                        Active
                      </span>
                    )}
                  </div>
                ))}

                {accounts.length === 0 && (
                  <div className="p-8 text-center rounded-xl bg-[#0d0c0a] border border-dashed border-[#302927]">
                    <div className="w-12 h-12 rounded-full bg-[#302927] flex items-center justify-center mx-auto mb-3">
                      <span className="text-[#726d6c]">{Icons.users}</span>
                    </div>
                    <p className="text-sm text-[#726d6c]">No accounts connected</p>
                    <p className="text-xs text-[#e8a990] mt-1">
                      Connect accounts via Post for Me
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Posting Schedule Section */}
        <section className="rounded-2xl bg-black border border-[#302927] overflow-hidden hover:border-[#e8a990]/25 transition-all duration-300">
          <SectionHeader
            icon={Icons.clock}
            title="Posting Schedule"
            subtitle={`${activeSlots.length} time slot${activeSlots.length !== 1 ? 's' : ''} per day`}
            section="schedule"
          />

          {expandedSection === 'schedule' && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-[#726d6c] px-1">
                Content auto-schedules to these time slots
              </p>

              {/* Slot List */}
              <div className="space-y-2">
                {slots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                      slot.is_active
                        ? 'bg-[#0d0c0a] border border-[#302927] hover:border-[#e8a990]/25'
                        : 'bg-[#0d0c0a]/50 opacity-40'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#302927] border border-[#302927] flex items-center justify-center">
                      <span className="text-[#e8a990]">{Icons.clock}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white tracking-tight">
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
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-[#726d6c] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-300"
                    >
                      {Icons.trash}
                    </button>
                  </div>
                ))}

                {slots.length === 0 && (
                  <div className="p-8 text-center rounded-xl bg-[#0d0c0a] border border-dashed border-[#302927]">
                    <div className="w-12 h-12 rounded-full bg-[#302927] flex items-center justify-center mx-auto mb-3">
                      <span className="text-[#726d6c]">{Icons.clock}</span>
                    </div>
                    <p className="text-sm text-[#726d6c]">No time slots configured</p>
                  </div>
                )}
              </div>

              {/* Add New Slot */}
              {showNewSlotForm ? (
                <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#302927] space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#726d6c] mb-2">
                      Time
                    </label>
                    <input
                      type="time"
                      value={newSlotTime}
                      onChange={(e) => setNewSlotTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#302927] border border-[#302927] text-white text-sm focus:border-[#843c2d]/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewSlotForm(false)}
                      className="flex-1 py-3 rounded-xl bg-[#302927] border border-[#302927] text-[#726d6c] text-sm font-medium hover:bg-[#302927] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateSlot}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6b3323] text-black text-sm font-semibold shadow-[0_0_15px_rgba(212,168,83,0.2)]"
                    >
                      Add Slot
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewSlotForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed border-[#302927] text-[#726d6c] hover:border-[#e8a990]/35 hover:text-[#e8a990] hover:bg-[#843c2d]/5 transition-all duration-300"
                >
                  {Icons.plus}
                  <span className="text-sm font-medium">Add Time Slot</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* Campaigns Section */}
        <section className="rounded-2xl bg-black border border-[#302927] overflow-hidden hover:border-[#e8a990]/25 transition-all duration-300">
          <SectionHeader
            icon={Icons.folder}
            title="Campaigns"
            subtitle={`${activeCampaigns.length} active campaign${activeCampaigns.length !== 1 ? 's' : ''}`}
            section="campaigns"
          />

          {expandedSection === 'campaigns' && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-[#726d6c] px-1">
                Organize posts by project or theme
              </p>

              {/* Campaign List */}
              <div className="space-y-2">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                      campaign.status === 'active'
                        ? 'bg-[#0d0c0a] border border-[#302927] hover:border-[#e8a990]/25'
                        : 'bg-[#0d0c0a]/50 opacity-40'
                    }`}
                  >
                    <div
                      className="w-2 h-10 rounded-full"
                      style={{
                        backgroundColor: campaign.color || '#726d6c',
                        boxShadow: campaign.status === 'active' ? `0 0 10px ${campaign.color || '#726d6c'}40` : 'none'
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white tracking-tight">{campaign.name}</div>
                      <div className="text-xs text-[#726d6c]">
                        {campaign.post_count} post{campaign.post_count !== 1 ? 's' : ''} •{' '}
                        <span className={campaign.status === 'active' ? 'text-emerald-400' : ''}>
                          {campaign.status}
                        </span>
                      </div>
                    </div>

                    {campaign.status === 'active' && (
                      <button
                        onClick={() => handleArchiveCampaign(campaign.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-[#726d6c] hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all duration-300"
                        title="Archive"
                      >
                        {Icons.archive}
                      </button>
                    )}
                  </div>
                ))}

                {campaigns.length === 0 && (
                  <div className="p-8 text-center rounded-xl bg-[#0d0c0a] border border-dashed border-[#302927]">
                    <div className="w-12 h-12 rounded-full bg-[#302927] flex items-center justify-center mx-auto mb-3">
                      <span className="text-[#726d6c]">{Icons.folder}</span>
                    </div>
                    <p className="text-sm text-[#726d6c]">No campaigns created</p>
                  </div>
                )}
              </div>

              {/* Add New Campaign */}
              {showNewCampaignForm ? (
                <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#302927] space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#726d6c] mb-2">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="e.g., Album Launch"
                      className="w-full px-4 py-3 rounded-xl bg-[#302927] border border-[#302927] text-white text-sm placeholder-[#726d6c] focus:border-[#843c2d]/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#726d6c] mb-2">
                      Color
                    </label>
                    <div className="flex gap-2">
                      {['#843c2d', '#843c2d', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'].map(
                        (color) => (
                          <button
                            key={color}
                            onClick={() => setNewCampaignColor(color)}
                            className={`w-8 h-8 rounded-lg transition-all duration-200 ${
                              newCampaignColor === color
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d0c0a] scale-110'
                                : 'hover:scale-105'
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
                      className="flex-1 py-3 rounded-xl bg-[#302927] border border-[#302927] text-[#726d6c] text-sm font-medium hover:bg-[#302927] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCampaign}
                      disabled={!newCampaignName.trim()}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6b3323] text-black text-sm font-semibold shadow-[0_0_15px_rgba(212,168,83,0.2)] disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCampaignForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed border-[#302927] text-[#726d6c] hover:border-[#e8a990]/35 hover:text-[#e8a990] hover:bg-[#843c2d]/5 transition-all duration-300"
                >
                  {Icons.plus}
                  <span className="text-sm font-medium">New Campaign</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* About Section */}
        <section className="rounded-2xl bg-gradient-to-br from-[black] to-[#0d0c0a] border border-[#302927] p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#843c2d]/20 to-[#843c2d]/5 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(212,168,83,0.1)]">
            <span className="text-2xl">📱</span>
          </div>
          <div className="text-sm font-semibold text-white tracking-tight">Social Studio</div>
          <div className="text-xs text-[#726d6c] mt-1">
            Powered by Post for Me
          </div>
          <div className="mt-4 pt-4 border-t border-[#302927]">
            <div className="text-[10px] uppercase tracking-widest text-[#e8a990]">
              Odubo Platform
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
