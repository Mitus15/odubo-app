'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Account, Campaign, PostingSlot } from '../page';

// =============================================================================
// TYPES
// =============================================================================

interface CreateFlowProps {
  accounts: Account[];
  campaigns: Campaign[];
  slots: PostingSlot[];
  prefillSlot?: { date: string; time: string } | null;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'content' | 'details' | 'review';

interface PostDraft {
  mediaUrl: string;
  mediaType: 'video' | 'image';
  thumbnailUrl?: string;
  title?: string;
  accountIds: string[];
  caption: string;
  hashtags: string[];
  scheduleMode: 'slot' | 'time' | 'now';
  scheduledAt?: string;
  campaignId?: string;
}

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

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'from-pink-500 to-purple-600',
  tiktok: 'from-black to-gray-800',
  youtube: 'from-red-600 to-red-700',
  facebook: 'from-blue-600 to-blue-700',
  threads: 'from-gray-800 to-black',
  twitter: 'from-sky-400 to-sky-500',
  linkedin: 'from-blue-700 to-blue-800',
  pinterest: 'from-red-600 to-red-700',
  bluesky: 'from-sky-500 to-blue-500',
};

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

function getNextSlot(slots: PostingSlot[]): { date: string; time: string } | null {
  const now = new Date();
  const activeSlots = slots.filter((s) => s.is_active);

  if (activeSlots.length === 0) return null;

  // Look through next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const dayOfWeek = checkDate.getDay();

    for (const slot of activeSlots) {
      // Check if slot applies to this day
      if (slot.day_of_week !== null && slot.day_of_week !== dayOfWeek) continue;

      // Check if time hasn't passed today
      if (dayOffset === 0) {
        const [slotHours, slotMinutes] = slot.time.split(':').map(Number);
        const slotDate = new Date(checkDate);
        slotDate.setHours(slotHours, slotMinutes, 0, 0);
        if (slotDate <= now) continue;
      }

      return {
        date: checkDate.toISOString().split('T')[0],
        time: slot.time,
      };
    }
  }

  return null;
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  close: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  back: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  upload: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  link: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
  camera: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  ),
  folder: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CreateFlow({
  accounts,
  campaigns,
  slots,
  prefillSlot,
  onComplete,
  onCancel,
}: CreateFlowProps) {
  const [step, setStep] = useState<Step>('content');
  const [draft, setDraft] = useState<PostDraft>({
    mediaUrl: '',
    mediaType: 'video',
    thumbnailUrl: '',
    title: '',
    accountIds: accounts.filter((a) => a.is_active).map((a) => a.id),
    caption: '',
    hashtags: [],
    scheduleMode: prefillSlot ? 'time' : 'slot',
    scheduledAt: prefillSlot
      ? `${prefillSlot.date}T${prefillSlot.time}:00`
      : undefined,
    campaignId: undefined,
  });
  const [urlInput, setUrlInput] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextSlot = useMemo(() => getNextSlot(slots), [slots]);
  const selectedAccounts = accounts.filter((a) => draft.accountIds.includes(a.id));
  const activeAccounts = accounts.filter((a) => a.is_active);

  // Group accounts by platform
  const accountsByPlatform = useMemo(() => {
    const grouped: Record<string, Account[]> = {};
    activeAccounts.forEach((acc) => {
      if (!grouped[acc.platform]) {
        grouped[acc.platform] = [];
      }
      grouped[acc.platform].push(acc);
    });
    return grouped;
  }, [activeAccounts]);

  // Handle media URL submission
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;

    // Detect media type from URL
    const url = urlInput.trim();
    const isVideo = /\.(mp4|mov|webm|m3u8)|video|stream/i.test(url);

    setDraft((d) => ({
      ...d,
      mediaUrl: url,
      mediaType: isVideo ? 'video' : 'image',
    }));
    setUrlInput('');
  };

  // Handle account toggle
  const toggleAccount = (accountId: string) => {
    setDraft((d) => ({
      ...d,
      accountIds: d.accountIds.includes(accountId)
        ? d.accountIds.filter((id) => id !== accountId)
        : [...d.accountIds, accountId],
    }));
  };

  // Handle hashtag add
  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (!tag || draft.hashtags.includes(tag)) return;
    setDraft((d) => ({
      ...d,
      hashtags: [...d.hashtags, tag],
    }));
    setHashtagInput('');
  };

  // Handle hashtag remove
  const removeHashtag = (tag: string) => {
    setDraft((d) => ({
      ...d,
      hashtags: d.hashtags.filter((t) => t !== tag),
    }));
  };

  // Calculate scheduled datetime
  const getScheduledAt = useCallback((): string | undefined => {
    if (draft.scheduleMode === 'now') return undefined;
    if (draft.scheduleMode === 'time' && draft.scheduledAt) return draft.scheduledAt;
    if (draft.scheduleMode === 'slot' && nextSlot) {
      return `${nextSlot.date}T${nextSlot.time}:00`;
    }
    return undefined;
  }, [draft.scheduleMode, draft.scheduledAt, nextSlot]);

  // Submit post
  const handleSubmit = async () => {
    if (!draft.mediaUrl || draft.accountIds.length === 0) return;

    setSubmitting(true);
    try {
      const scheduledAt = getScheduledAt();

      const response = await fetch('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: draft.mediaUrl,
          media_type: draft.mediaType,
          thumbnail_url: draft.thumbnailUrl,
          title: draft.title,
          caption: draft.caption,
          hashtags: draft.hashtags,
          account_ids: draft.accountIds,
          platforms: [...new Set(selectedAccounts.map((a) => a.platform))],
          scheduled_at: scheduledAt,
          campaign_id: draft.campaignId,
          status: draft.scheduleMode === 'now' ? 'publishing' : 'scheduled',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create post');
      }

      onComplete();
    } catch (error) {
      console.error('[CreateFlow] Error creating post:', error);
      // TODO: Show error toast
    } finally {
      setSubmitting(false);
    }
  };

  // Can proceed to next step?
  const canProceed = useMemo(() => {
    if (step === 'content') {
      return draft.mediaUrl && draft.accountIds.length > 0;
    }
    if (step === 'details') {
      return true; // Caption and hashtags are optional
    }
    return true;
  }, [step, draft]);

  // Handle next
  const handleNext = () => {
    if (step === 'content') setStep('details');
    else if (step === 'details') setStep('review');
  };

  // Handle back
  const handleBack = () => {
    if (step === 'details') setStep('content');
    else if (step === 'review') setStep('details');
    else onCancel();
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center text-white">
          {step === 'content' ? Icons.close : Icons.back}
        </button>

        <h1 className="text-lg font-semibold text-white">
          {step === 'content' && 'Create Post'}
          {step === 'details' && 'Add Details'}
          {step === 'review' && 'Review'}
        </h1>

        {step !== 'review' ? (
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              canProceed
                ? 'bg-[#D4A853] text-black'
                : 'bg-[#252525] text-[#726d6c]'
            }`}
          >
            Next
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Step 1: Content Selection */}
        {step === 'content' && (
          <div className="py-4 space-y-6">
            {/* Media Selection */}
            <section>
              <h2 className="text-sm font-semibold text-[#D4A853] uppercase tracking-wide mb-3">
                Select Content
              </h2>

              {!draft.mediaUrl ? (
                <>
                  {/* Source Options */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors">
                      <span className="text-[#D4A853]">{Icons.folder}</span>
                      <span className="text-sm text-white">From Clips</span>
                    </button>

                    <button className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors">
                      <span className="text-[#D4A853]">{Icons.camera}</span>
                      <span className="text-sm text-white">Camera Roll</span>
                    </button>

                    <button className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors">
                      <span className="text-[#D4A853]">{Icons.upload}</span>
                      <span className="text-sm text-white">Upload</span>
                    </button>

                    <div className="flex flex-col p-4 rounded-xl bg-[#1a1a1a] border border-[#252525]">
                      <span className="text-[#D4A853] mb-2">{Icons.link}</span>
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                        placeholder="Paste URL..."
                        className="w-full bg-transparent text-sm text-white placeholder-[#726d6c] outline-none"
                      />
                      {urlInput && (
                        <button
                          onClick={handleUrlSubmit}
                          className="mt-2 text-xs text-[#D4A853]"
                        >
                          Use URL
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Media Preview */
                <div className="relative rounded-xl overflow-hidden bg-[#1a1a1a] aspect-[9/16] max-h-[300px]">
                  {draft.mediaType === 'video' ? (
                    <video
                      src={draft.mediaUrl}
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                    />
                  ) : (
                    <img
                      src={draft.mediaUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}

                  <button
                    onClick={() => setDraft((d) => ({ ...d, mediaUrl: '', thumbnailUrl: '' }))}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    {Icons.close}
                  </button>
                </div>
              )}
            </section>

            {/* Platform Selection */}
            <section>
              <h2 className="text-sm font-semibold text-[#D4A853] uppercase tracking-wide mb-3">
                Platforms
              </h2>

              <div className="space-y-3">
                {Object.entries(accountsByPlatform).map(([platform, platformAccounts]) => (
                  <div key={platform} className="space-y-2">
                    {platformAccounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => toggleAccount(account.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          draft.accountIds.includes(account.id)
                            ? 'bg-[#D4A853]/10 border-[#D4A853]'
                            : 'bg-[#1a1a1a] border-[#252525] hover:border-[#D4A853]/30'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${PLATFORM_COLORS[platform] || 'from-gray-600 to-gray-700'} flex items-center justify-center text-xl`}
                        >
                          {account.profile_image_url ? (
                            <img
                              src={account.profile_image_url}
                              alt=""
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            PLATFORM_ICONS[platform] || '📱'
                          )}
                        </div>

                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium text-white">
                            {account.account_name || `@${account.account_handle}`}
                          </div>
                          <div className="text-xs text-[#726d6c]">
                            @{account.account_handle}
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            draft.accountIds.includes(account.id)
                              ? 'border-[#D4A853] bg-[#D4A853] text-black'
                              : 'border-[#726d6c]'
                          }`}
                        >
                          {draft.accountIds.includes(account.id) && Icons.check}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}

                {Object.keys(accountsByPlatform).length === 0 && (
                  <div className="p-6 rounded-xl bg-[#1a1a1a] border border-[#252525] text-center">
                    <p className="text-sm text-[#726d6c]">No connected accounts</p>
                    <p className="text-xs text-[#D4A853] mt-1">Connect accounts in Settings</p>
                  </div>
                )}
              </div>
            </section>

            {/* Schedule */}
            <section>
              <h2 className="text-sm font-semibold text-[#D4A853] uppercase tracking-wide mb-3">
                Schedule
              </h2>

              <div className="space-y-2">
                {nextSlot && (
                  <button
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        scheduleMode: 'slot',
                        scheduledAt: undefined,
                      }))
                    }
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                      draft.scheduleMode === 'slot'
                        ? 'bg-[#D4A853]/10 border-[#D4A853]'
                        : 'bg-[#1a1a1a] border-[#252525] hover:border-[#D4A853]/30'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        draft.scheduleMode === 'slot'
                          ? 'border-[#D4A853] bg-[#D4A853]'
                          : 'border-[#726d6c]'
                      }`}
                    >
                      {draft.scheduleMode === 'slot' && (
                        <div className="w-2 h-2 rounded-full bg-black" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm text-white">Next available slot</div>
                      <div className="text-xs text-[#726d6c]">
                        {new Date(nextSlot.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at {formatSlotTime(nextSlot.time)}
                      </div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => setDraft((d) => ({ ...d, scheduleMode: 'time' }))}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                    draft.scheduleMode === 'time'
                      ? 'bg-[#D4A853]/10 border-[#D4A853]'
                      : 'bg-[#1a1a1a] border-[#252525] hover:border-[#D4A853]/30'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      draft.scheduleMode === 'time'
                        ? 'border-[#D4A853] bg-[#D4A853]'
                        : 'border-[#726d6c]'
                    }`}
                  >
                    {draft.scheduleMode === 'time' && (
                      <div className="w-2 h-2 rounded-full bg-black" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm text-white">Pick a time</div>
                  </div>
                </button>

                {draft.scheduleMode === 'time' && (
                  <div className="flex gap-2 pl-8">
                    <input
                      type="date"
                      value={draft.scheduledAt?.split('T')[0] || ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          scheduledAt: `${e.target.value}T${d.scheduledAt?.split('T')[1] || '14:00:00'}`,
                        }))
                      }
                      className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#252525] text-white text-sm"
                    />
                    <input
                      type="time"
                      value={draft.scheduledAt?.split('T')[1]?.slice(0, 5) || ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          scheduledAt: `${d.scheduledAt?.split('T')[0] || new Date().toISOString().split('T')[0]}T${e.target.value}:00`,
                        }))
                      }
                      className="w-28 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#252525] text-white text-sm"
                    />
                  </div>
                )}

                <button
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      scheduleMode: 'now',
                      scheduledAt: undefined,
                    }))
                  }
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                    draft.scheduleMode === 'now'
                      ? 'bg-[#D4A853]/10 border-[#D4A853]'
                      : 'bg-[#1a1a1a] border-[#252525] hover:border-[#D4A853]/30'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      draft.scheduleMode === 'now'
                        ? 'border-[#D4A853] bg-[#D4A853]'
                        : 'border-[#726d6c]'
                    }`}
                  >
                    {draft.scheduleMode === 'now' && (
                      <div className="w-2 h-2 rounded-full bg-black" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm text-white">Post now</div>
                  </div>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <div className="py-4 space-y-6">
            {/* Preview */}
            <section className="relative rounded-xl overflow-hidden bg-[#1a1a1a] aspect-video">
              {draft.mediaType === 'video' ? (
                <video
                  src={draft.mediaUrl}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={draft.mediaUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Platform badges */}
              <div className="absolute bottom-2 left-2 flex gap-1">
                {selectedAccounts.map((acc) => (
                  <span
                    key={acc.id}
                    className="px-2 py-1 rounded-full bg-black/60 text-xs"
                  >
                    {PLATFORM_ICONS[acc.platform]}
                  </span>
                ))}
              </div>
            </section>

            {/* Title (optional) */}
            <section>
              <label className="block text-sm font-semibold text-[#D4A853] uppercase tracking-wide mb-2">
                Title (Optional)
              </label>
              <input
                type="text"
                value={draft.title || ''}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Give your post a title..."
                className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#252525] text-white placeholder-[#726d6c] outline-none focus:border-[#D4A853]/50 transition-colors"
              />
            </section>

            {/* Caption */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-[#D4A853] uppercase tracking-wide">
                  Caption
                </label>
                <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1a1a1a] text-xs text-[#D4A853] hover:bg-[#252525] transition-colors">
                  {Icons.sparkles}
                  AI Help
                </button>
              </div>
              <textarea
                value={draft.caption}
                onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                placeholder="Write your caption..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#252525] text-white placeholder-[#726d6c] outline-none focus:border-[#D4A853]/50 transition-colors resize-none"
              />
            </section>

            {/* Hashtags */}
            <section>
              <label className="block text-sm font-semibold text-[#D4A853] uppercase tracking-wide mb-2">
                Hashtags
              </label>

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                  placeholder="#hashtag"
                  className="flex-1 px-4 py-2 rounded-xl bg-[#1a1a1a] border border-[#252525] text-white placeholder-[#726d6c] outline-none focus:border-[#D4A853]/50 transition-colors"
                />
                <button
                  onClick={addHashtag}
                  className="px-4 py-2 rounded-xl bg-[#252525] text-white hover:bg-[#333] transition-colors"
                >
                  Add
                </button>
              </div>

              {draft.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {draft.hashtags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => removeHashtag(tag)}
                      className="px-3 py-1 rounded-full bg-[#1a1a1a] border border-[#252525] text-sm text-white hover:border-red-500/50 hover:text-red-400 transition-colors"
                    >
                      #{tag} ×
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Campaign */}
            {campaigns.length > 0 && (
              <section>
                <label className="block text-sm font-semibold text-[#D4A853] uppercase tracking-wide mb-2">
                  Campaign (Optional)
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDraft((d) => ({ ...d, campaignId: undefined }))}
                    className={`px-4 py-2 rounded-xl border transition-colors ${
                      !draft.campaignId
                        ? 'bg-[#D4A853]/10 border-[#D4A853] text-[#D4A853]'
                        : 'bg-[#1a1a1a] border-[#252525] text-white hover:border-[#D4A853]/30'
                    }`}
                  >
                    None
                  </button>
                  {campaigns
                    .filter((c) => c.status === 'active')
                    .map((campaign) => (
                      <button
                        key={campaign.id}
                        onClick={() => setDraft((d) => ({ ...d, campaignId: campaign.id }))}
                        className={`px-4 py-2 rounded-xl border transition-colors ${
                          draft.campaignId === campaign.id
                            ? 'bg-[#D4A853]/10 border-[#D4A853] text-[#D4A853]'
                            : 'bg-[#1a1a1a] border-[#252525] text-white hover:border-[#D4A853]/30'
                        }`}
                        style={{
                          borderColor:
                            draft.campaignId === campaign.id
                              ? campaign.color || '#D4A853'
                              : undefined,
                        }}
                      >
                        {campaign.color && (
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: campaign.color }}
                          />
                        )}
                        {campaign.name}
                      </button>
                    ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="py-4 space-y-6">
            {/* Preview */}
            <section className="relative rounded-xl overflow-hidden bg-[#1a1a1a] aspect-video">
              {draft.mediaType === 'video' ? (
                <video
                  src={draft.mediaUrl}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={draft.mediaUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              )}
            </section>

            {/* Summary */}
            <section className="space-y-4">
              {/* Title */}
              {draft.title && (
                <div>
                  <div className="text-xs text-[#726d6c] mb-1">Title</div>
                  <div className="text-white">{draft.title}</div>
                </div>
              )}

              {/* Caption */}
              {draft.caption && (
                <div>
                  <div className="text-xs text-[#726d6c] mb-1">Caption</div>
                  <div className="text-white whitespace-pre-wrap">{draft.caption}</div>
                </div>
              )}

              {/* Hashtags */}
              {draft.hashtags.length > 0 && (
                <div>
                  <div className="text-xs text-[#726d6c] mb-1">Hashtags</div>
                  <div className="text-[#D4A853]">
                    {draft.hashtags.map((t) => `#${t}`).join(' ')}
                  </div>
                </div>
              )}

              {/* Schedule */}
              <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#252525]">
                <div className="flex items-center gap-3">
                  <span className="text-[#D4A853]">{Icons.calendar}</span>
                  <div>
                    <div className="text-sm text-white">
                      {draft.scheduleMode === 'now'
                        ? 'Posting immediately'
                        : draft.scheduleMode === 'slot' && nextSlot
                        ? `${new Date(nextSlot.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })} at ${formatSlotTime(nextSlot.time)}`
                        : draft.scheduledAt
                        ? `${new Date(draft.scheduledAt).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })} at ${new Date(draft.scheduledAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}`
                        : 'No schedule set'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Platforms */}
              <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#252525]">
                <div className="text-xs text-[#726d6c] mb-2">Posting to</div>
                <div className="flex flex-wrap gap-2">
                  {selectedAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#252525]"
                    >
                      <span>{PLATFORM_ICONS[acc.platform]}</span>
                      <span className="text-sm text-white">@{acc.account_handle}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campaign */}
              {draft.campaignId && (
                <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#252525]">
                  <div className="text-xs text-[#726d6c] mb-1">Campaign</div>
                  <div className="text-white">
                    {campaigns.find((c) => c.id === draft.campaignId)?.name || 'Unknown'}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Footer (Review step only) */}
      {step === 'review' && (
        <div className="flex-shrink-0 p-4 border-t border-[#1a1a1a] safe-area-bottom">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-[#D4A853] text-black font-semibold text-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {submitting
              ? 'Creating...'
              : draft.scheduleMode === 'now'
              ? 'Post Now'
              : 'Schedule Post'}
          </button>
        </div>
      )}
    </div>
  );
}
