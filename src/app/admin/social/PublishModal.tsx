'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SocialContent {
  id: number;
  upload_uid: string | null;
  thumbnail_url: string | null;
  title: string;
  caption_instagram: string | null;
  caption_tiktok: string | null;
  caption_youtube: string | null;
  hashtags_instagram: string | null;
  hashtags_tiktok: string | null;
  hashtags_youtube: string | null;
  status: string;
  scheduled_for?: string | null;
}

interface ConnectedAccount {
  id: string;
  handle: string;
  postforme_id: string;
}

interface PublishModalProps {
  content: SocialContent;
  onClose: () => void;
  onPublished: () => void;
  preSelectedDate?: Date;
}

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: '📸', color: '#E4405F' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000000' },
  { id: 'youtube', name: 'YouTube', icon: '📺', color: '#FF0000' },
] as const;

type PublishMode = 'now' | 'schedule';

// Format date for datetime-local input
function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Get default schedule time (next hour, rounded)
function getDefaultScheduleTime(): string {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  now.setMinutes(0);
  now.setSeconds(0);
  return formatDateTimeLocal(now);
}

export default function PublishModal({ content, onClose, onPublished, preSelectedDate }: PublishModalProps) {
  const [mode, setMode] = useState<PublishMode>('now');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'tiktok', 'youtube']);
  const [accounts, setAccounts] = useState<Record<string, ConnectedAccount[]>>({});
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedCaption, setExpandedCaption] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() => {
    if (preSelectedDate) {
      return formatDateTimeLocal(preSelectedDate);
    }
    if (content.scheduled_for) {
      return formatDateTimeLocal(new Date(content.scheduled_for));
    }
    return getDefaultScheduleTime();
  });

  // If preSelectedDate is provided, default to schedule mode
  useEffect(() => {
    if (preSelectedDate) {
      setMode('schedule');
    }
  }, [preSelectedDate]);

  const thumbnailUrl = content.thumbnail_url ||
    (content.upload_uid ? `https://videodelivery.net/${content.upload_uid}/thumbnails/thumbnail.jpg` : null);

  // Fetch connected accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin/social/publish', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        const data = await res.json() as { accounts?: Record<string, ConnectedAccount[]> };
        setAccounts(data.accounts || {});
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      setError('Select at least one platform');
      return;
    }

    // Check all selected platforms have connected accounts
    const missingAccounts = selectedPlatforms.filter(p => !accounts[p] || accounts[p].length === 0);
    if (missingAccounts.length > 0) {
      setError(`No connected accounts for: ${missingAccounts.join(', ')}. Go to Connected Accounts tab to sync from PostForMe.`);
      return;
    }

    // Validate schedule date
    if (mode === 'schedule') {
      const scheduledTime = new Date(scheduleDate);
      const now = new Date();
      if (scheduledTime <= now) {
        setError('Schedule time must be in the future');
        return;
      }
    }

    setIsPublishing(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/social/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          content_id: content.id,
          platforms: selectedPlatforms,
          publish_now: mode === 'now',
          schedule_at: mode === 'schedule' ? new Date(scheduleDate).toISOString() : undefined,
        }),
      });

      const data = await res.json() as { success?: boolean; error?: string; status?: string };

      if (data.success) {
        setSuccess(true);
        setSuccessMessage(
          mode === 'now'
            ? 'Published successfully!'
            : `Scheduled for ${new Date(scheduleDate).toLocaleDateString()} at ${new Date(scheduleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        );
        setTimeout(() => {
          onPublished();
          onClose();
        }, 1500);
      } else {
        setError(data.error || 'Failed to publish');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Publish error:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  const getCaption = (platformId: string): string => {
    let caption = '';
    let hashtags = '';

    if (platformId === 'instagram') {
      caption = content.caption_instagram || content.title || '';
      hashtags = content.hashtags_instagram || '';
    } else if (platformId === 'tiktok') {
      caption = content.caption_tiktok || content.title || '';
      hashtags = content.hashtags_tiktok || '';
    } else if (platformId === 'youtube') {
      caption = content.caption_youtube || content.title || '';
      hashtags = content.hashtags_youtube || '';
    }

    return hashtags ? `${caption}\n\n${hashtags}` : caption;
  };

  const availablePlatformsCount = Object.keys(accounts).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:w-auto sm:max-w-lg sm:mx-4 max-h-[90vh] sm:max-h-[85vh] bg-[#0d0b0a] border-t sm:border border-[#302927] rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        >
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[#302927] bg-[#0d0b0a]">
            <h2 className="text-lg font-semibold text-[#ede8df]">
              {mode === 'now' ? 'Publish Content' : 'Schedule Content'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-[#726d6c] hover:text-[#ede8df] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Video Preview */}
            <div className="flex items-start gap-4">
              {thumbnailUrl ? (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[#1a1816]">
                  <img
                    src={thumbnailUrl}
                    alt={content.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[#1a1816] flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">🎬</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[#ede8df] truncate">{content.title || 'Untitled'}</h3>
                <p className="text-sm text-[#726d6c] mt-1">
                  {content.upload_uid ? 'Video ready' : 'No video attached'}
                </p>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-[#1a1816] rounded-xl">
              <button
                onClick={() => setMode('now')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all min-h-[48px] ${
                  mode === 'now'
                    ? 'bg-[#843c2d] text-white'
                    : 'text-[#726d6c] hover:text-[#ede8df]'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Publish Now
              </button>
              <button
                onClick={() => setMode('schedule')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all min-h-[48px] ${
                  mode === 'schedule'
                    ? 'bg-[#843c2d] text-white'
                    : 'text-[#726d6c] hover:text-[#ede8df]'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Schedule
              </button>
            </div>

            {/* Schedule Date/Time Picker */}
            {mode === 'schedule' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#b2a491]">When to post</label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={formatDateTimeLocal(new Date())}
                  className="w-full px-4 py-3 bg-[#1a1816] border border-[#302927] rounded-xl text-[#ede8df] focus:outline-none focus:border-[#843c2d] min-h-[50px] text-base"
                />
              </div>
            )}

            {/* Platform Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-[#b2a491]">Platforms</label>
                {loadingAccounts && (
                  <div className="w-4 h-4 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
                )}
              </div>

              {availablePlatformsCount === 0 && !loadingAccounts ? (
                <div className="p-4 bg-[#1a1816] rounded-xl border border-[#302927] text-center">
                  <p className="text-sm text-[#726d6c] mb-3">No accounts connected</p>
                  <p className="text-xs text-[#502d26]">
                    Go to Social → Connected Accounts to sync from PostForMe
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {PLATFORMS.map((platform) => {
                    const isSelected = selectedPlatforms.includes(platform.id);
                    const hasAccount = accounts[platform.id] && accounts[platform.id].length > 0;
                    const account = hasAccount ? accounts[platform.id][0] : null;
                    const caption = getCaption(platform.id);
                    const isExpanded = expandedCaption === platform.id;

                    return (
                      <div key={platform.id} className="space-y-2">
                        <button
                          onClick={() => hasAccount && togglePlatform(platform.id)}
                          disabled={!hasAccount}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all min-h-[56px] ${
                            isSelected && hasAccount
                              ? 'bg-[#843c2d]/20 border-[#843c2d]/50'
                              : hasAccount
                              ? 'bg-[#1a1816] border-[#302927] hover:border-[#502d26]/50'
                              : 'bg-[#1a1816]/50 border-[#302927]/50 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          {/* Platform Icon */}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                            style={{ backgroundColor: platform.color + '20' }}
                          >
                            {platform.icon}
                          </div>

                          {/* Platform Info */}
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium text-[#ede8df] text-sm">{platform.name}</div>
                            {account ? (
                              <div className="text-xs text-[#726d6c] truncate">@{account.handle}</div>
                            ) : (
                              <div className="text-xs text-[#502d26]">Not connected</div>
                            )}
                          </div>

                          {/* Checkbox */}
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected && hasAccount
                                ? 'bg-[#843c2d] border-[#843c2d]'
                                : 'border-[#726d6c]'
                            }`}
                          >
                            {isSelected && hasAccount && (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>

                        {/* Caption Preview */}
                        {isSelected && hasAccount && caption && (
                          <button
                            onClick={() => setExpandedCaption(isExpanded ? null : platform.id)}
                            className="w-full text-left px-3 py-2 bg-[#1a1816]/50 rounded-lg border border-[#302927]/50"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-[#726d6c]">Caption</span>
                              <svg
                                className={`w-4 h-4 text-[#726d6c] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            <p className={`text-xs text-[#ede8df]/70 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {caption}
                            </p>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-emerald-400">{successMessage}</p>
              </div>
            )}
          </div>

          {/* Footer - Sticky */}
          <div className="sticky bottom-0 z-10 p-4 border-t border-[#302927] bg-[#0d0b0a] safe-area-inset-bottom">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isPublishing}
                className="flex-1 px-4 py-3.5 bg-[#1a1816] hover:bg-[#252220] active:bg-[#302927] border border-[#302927] rounded-xl font-medium text-[#ede8df] transition-colors min-h-[50px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || selectedPlatforms.length === 0 || success || !content.upload_uid}
                className="flex-1 px-4 py-3.5 bg-[#843c2d] hover:bg-[#6b3225] active:bg-[#5a2a1f] rounded-xl font-medium text-white transition-colors min-h-[50px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPublishing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{mode === 'now' ? 'Publishing...' : 'Scheduling...'}</span>
                  </>
                ) : success ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Done!</span>
                  </>
                ) : mode === 'now' ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    <span>Publish Now</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    <span>Schedule</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
