'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  sourceType?: 'clip' | 'upload' | 'url';
  sourceId?: string;
  accountIds: string[];
  caption: string;
  hashtags: string[];
  scheduleMode: 'day' | 'now';
  scheduledDate?: string; // YYYY-MM-DD format
  slotNumber?: number; // Which slot on that day (dynamic based on settings)
  campaignId?: string;
}

interface Clip {
  id: number;
  title: string;
  url: string;  // HLS stream URL
  uid: string;  // Cloudflare Stream UID for thumbnail
  mp4_url?: string;
  thumbnail?: string;
  poster_url?: string;
}

interface AiSuggestions {
  captions: Record<string, string[]>;
  hashtags: Record<string, string[]>;
}

// Construct thumbnail URL from Cloudflare Stream UID
function getClipThumbnail(clip: Clip): string {
  // If thumbnail or poster_url exists and is not empty, use it
  if (clip.thumbnail && clip.thumbnail.length > 0) return clip.thumbnail;
  if (clip.poster_url && clip.poster_url.length > 0) return clip.poster_url;
  // Otherwise construct from UID
  if (clip.uid) {
    return `https://customer-tpkm273r1u0s40no.cloudflarestream.com/${clip.uid}/thumbnails/thumbnail.jpg?time=2s`;
  }
  return '';
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
  tiktok: 'from-[#00f2ea] to-[#ff0050]', // TikTok brand colors (cyan to red)
  youtube: 'from-red-600 to-red-700',
  facebook: 'from-blue-600 to-blue-700',
  threads: 'from-gray-600 to-gray-700',
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

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function toComparableDate(parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number }) {
  return new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0
  ));
}

function formatSlotDate(dateStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getNextSlot(slots: PostingSlot[]): { date: string; time: string; timezone: string } | null {
  const activeSlots = slots.filter((s) => s.is_active);
  if (activeSlots.length === 0) return null;

  // Get the timezone from slots (assume all slots use same timezone)
  const slotTimezone = activeSlots[0]?.timezone || 'America/Los_Angeles';

  // Get current time in the slot's timezone (comparable date)
  const nowParts = getZonedParts(new Date(), slotTimezone);
  const nowInSlotTz = toComparableDate(nowParts);

  // Sort slots by time (earliest first)
  const sortedSlots = [...activeSlots].sort((a, b) => {
    const [aH, aM] = a.time.split(':').map(Number);
    const [bH, bM] = b.time.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });

  // Look through next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(nowInSlotTz);
    checkDate.setUTCDate(checkDate.getUTCDate() + dayOffset);
    const dayOfWeek = new Date(Date.UTC(
      checkDate.getUTCFullYear(),
      checkDate.getUTCMonth(),
      checkDate.getUTCDate()
    )).getUTCDay();

    for (const slot of sortedSlots) {
      // Check if slot applies to this day (null = every day)
      if (slot.day_of_week !== null && slot.day_of_week !== dayOfWeek) continue;

      // Build the slot datetime in the slot's timezone
      const [slotHours, slotMinutes] = slot.time.split(':').map(Number);
      const slotDate = toComparableDate({
        year: checkDate.getUTCFullYear(),
        month: checkDate.getUTCMonth() + 1,
        day: checkDate.getUTCDate(),
        hour: slotHours,
        minute: slotMinutes,
      });

      // Skip if this slot time has already passed
      if (slotDate <= nowInSlotTz) continue;

      // Format date as YYYY-MM-DD
      const year = checkDate.getUTCFullYear();
      const month = String(checkDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(checkDate.getUTCDate()).padStart(2, '0');

      return {
        date: `${year}-${month}-${day}`,
        time: slot.time,
        timezone: slotTimezone,
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
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  back: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  upload: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  link: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
  camera: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  ),
  folder: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
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
    scheduleMode: 'day',
    scheduledDate: new Date().toISOString().split('T')[0], // Today
    slotNumber: 1, // Default to slot 1
    campaignId: undefined,
  });
  const [urlInput, setUrlInput] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showClipsPicker, setShowClipsPicker] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [clipFilter, setClipFilter] = useState<'all' | 'unposted'>('unposted');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestions | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [aiPlatform, setAiPlatform] = useState<string>('instagram');
  const [slotsPerDay, setSlotsPerDay] = useState(2); // Default to 2 slots
  const [aiProfileStatus, setAiProfileStatus] = useState<'loading' | 'ready' | 'none'>('loading');
  const [showAiSetup, setShowAiSetup] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const nextSlot = useMemo(() => getNextSlot(slots), [slots]);

  // Fetch settings to get slots_per_day
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/social/settings');
        if (res.ok) {
          const data = await res.json() as { settings?: { slots_per_day?: number } };
          if (data.settings?.slots_per_day) {
            setSlotsPerDay(data.settings.slots_per_day);
          }
        }
      } catch (error) {
        console.error('[CreateFlow] Failed to fetch settings:', error);
      }
    };
    fetchSettings();

    // Check AI profile status
    const checkAiProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin/ai-studio/profiles', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json() as { activeProfile?: boolean };
          setAiProfileStatus(data.activeProfile ? 'ready' : 'none');
        } else {
          setAiProfileStatus('none');
        }
      } catch (error) {
        console.error('[CreateFlow] AI profile check error:', error);
        setAiProfileStatus('none');
      }
    };
    checkAiProfile();
  }, []);

  // Auto-select next available slot
  useEffect(() => {
    if (draft.scheduleMode === 'day' && !draft.scheduledDate) {
      const today = new Date().toISOString().split('T')[0];
      setDraft((d) => ({ ...d, scheduledDate: today, slotNumber: 1 }));
    }
  }, [draft.scheduleMode, draft.scheduledDate]);

  // Fetch clips when picker opens
  useEffect(() => {
    if (showClipsPicker) {
      fetchClips();
    }
  }, [showClipsPicker, clipFilter]);

  const fetchClips = async () => {
    setLoadingClips(true);
    try {
      const endpoint = clipFilter === 'unposted'
        ? '/api/social/undistributed-clips'
        : '/api/clips?limit=50';
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json() as { clips?: Clip[] };
        const normalized = (data.clips || []).map((clip: any) => ({
          id: Number(clip.id),
          uid: clip.uid,
          title: clip.title || 'Untitled',
          url: clip.url,
          mp4_url: clip.mp4_url,
          thumbnail: clip.thumbnail,
          poster_url: clip.poster_url || clip.posterUrl,
        }));
        setClips(normalized);
      }
    } catch (error) {
      console.error('[CreateFlow] Error fetching clips:', error);
    } finally {
      setLoadingClips(false);
    }
  };

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Determine media type
      const isVideo = file.type.startsWith('video/');

      // Create a local URL for preview
      const localUrl = URL.createObjectURL(file);

      // Upload to R2 via social library upload API
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/social/library/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json() as { url: string; type?: 'video' | 'image'; id?: number };
        setDraft((d) => ({
          ...d,
          mediaUrl: data.url,
          mediaType: data.type || (isVideo ? 'video' : 'image'),
          sourceType: 'upload',
          sourceId: data.id ? String(data.id) : d.sourceId,
        }));
        // Revoke local URL since upload succeeded
        URL.revokeObjectURL(localUrl);
      } else {
        // Fallback to local URL for preview (won't persist)
        console.warn('[CreateFlow] Upload failed, using local preview');
        setDraft((d) => ({
          ...d,
          mediaUrl: localUrl,
          mediaType: isVideo ? 'video' : 'image',
          sourceType: 'upload',
        }));
      }
    } catch (error) {
      console.error('[CreateFlow] Upload error:', error);
    } finally {
      setUploading(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  // Select clip from picker
  const handleSelectClip = (clip: Clip) => {
    setDraft((d) => ({
      ...d,
      mediaUrl: clip.mp4_url || clip.url, // Prefer MP4 for social posting
      mediaType: 'video',
      thumbnailUrl: getClipThumbnail(clip),
      title: clip.title || d.title,
      sourceType: 'clip',
      sourceId: String(clip.id),
    }));
    setShowClipsPicker(false);
  };
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

  const uniquePlatforms = useMemo(
    () => Array.from(new Set(selectedAccounts.map((acc) => acc.platform))),
    [selectedAccounts]
  );

  useEffect(() => {
    if (uniquePlatforms.length > 0) {
      setAiPlatform((prev) => (uniquePlatforms.includes(prev) ? prev : uniquePlatforms[0]));
    }
  }, [uniquePlatforms]);

  const scheduledDate = useMemo(() => {
    const dateStr = draft.scheduledDate || nextSlot?.date || formatLocalDate(new Date());
    const [year, month, day] = dateStr.split('-').map(Number);
    return { dateStr, year, month, day };
  }, [draft.scheduledDate, nextSlot]);

  const scheduledTime = useMemo(() => {
    const timeStr = nextSlot?.time || '12:00';
    const [hour, minute] = timeStr.split(':').map(Number);
    return { timeStr, hour, minute };
  }, [nextSlot]);

  const daysInMonth = useMemo(
    () => getDaysInMonth(scheduledDate.year, scheduledDate.month),
    [scheduledDate]
  );

  const updateScheduledAt = (dateStr: string, timeStr: string) => {
    setDraft((d) => ({ ...d, scheduledAt: `${dateStr}T${timeStr}:00` }));
  };

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
      sourceType: 'url',
    }));
    setUrlInput('');
  };

  const handleAiHelp = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/admin/social/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          caption: draft.caption,
          platforms: uniquePlatforms.length > 0 ? uniquePlatforms : ['instagram'],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, any>;
        const errorMsg = errorData?.details || errorData?.error || 'AI request failed';
        throw new Error(errorMsg);
      }

      const data = await response.json() as { suggestions?: AiSuggestions | null };
      const suggestions = data.suggestions || null;
      setAiSuggestions(suggestions);
      
      // Auto-populate caption if it's empty and we have suggestions
      if (suggestions && !draft.caption) {
        const primaryPlatform = uniquePlatforms[0] || 'instagram';
        const firstCaption = suggestions.captions?.[primaryPlatform]?.[0];
        const firstHashtags = suggestions.hashtags?.[primaryPlatform] || [];
        
        if (firstCaption) {
          setDraft((d) => ({
            ...d,
            caption: firstCaption,
            hashtags: firstHashtags.map((tag: string) => tag.replace(/^#/, '')),
          }));
        }
      }
    } catch (error) {
      console.error('[CreateFlow] AI help error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setAiError(`AI suggestions unavailable: ${errorMsg}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplySuggestion = (caption: string, hashtags: string[]) => {
    setDraft((d) => ({
      ...d,
      caption,
      hashtags: hashtags.map((tag) => tag.replace(/^#/, '')),
    }));
  };

  const submitAiFeedback = async (platform: string, text: string, rating: 'up' | 'down') => {
    const key = `${platform}:${text}`;
    setAiFeedback((prev) => ({ ...prev, [key]: rating }));

    try {
      await fetch('/api/admin/social/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          generated_text: text,
          rating: rating === 'up' ? 1 : 0,
          source: 'create_flow',
        }),
      });
    } catch (error) {
      console.error('[CreateFlow] Feedback error:', error);
    }
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

  // Calculate scheduled datetime - always midnight since cron runs at midnight
  const getScheduledAt = useCallback((): string | undefined => {
    if (draft.scheduleMode === 'now') return undefined;
    if (draft.scheduleMode === 'day' && draft.scheduledDate) {
      // Set to midnight - cron processes all posts for the day at midnight
      return `${draft.scheduledDate}T00:00:00`;
    }
    return undefined;
  }, [draft.scheduleMode, draft.scheduledDate]);

  // Submit post
  const handleSubmit = async () => {
    if (!draft.mediaUrl || draft.accountIds.length === 0) return;

    setSubmitting(true);
    try {
      const scheduledAt = getScheduledAt();
      if (draft.scheduleMode !== 'now' && scheduledAt) {
        const scheduledTime = new Date(scheduledAt);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (Number.isNaN(scheduledTime.getTime()) || scheduledTime.getTime() < todayStart.getTime()) {
          alert('Please choose today or a future date to schedule this post.');
          setSubmitting(false);
          return;
        }
      }
      const scheduledAtIso = scheduledAt ? new Date(scheduledAt).toISOString() : undefined;

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
          source_type: draft.sourceType,
          source_id: draft.sourceId,
          scheduled_at: scheduledAtIso,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          campaign_id: draft.campaignId,
          status: 'draft',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create post');
      }

      const data = await response.json() as { id?: string };
      const postId = data?.id as string | undefined;

      if (postId) {
        const publishRes = await fetch('/api/social/posts/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: postId,
            publish_now: draft.scheduleMode === 'now',
          }),
        });

        if (!publishRes.ok) {
          const errorData = await publishRes.json().catch(() => ({}));
          console.error('[CreateFlow] Publish error:', errorData);
        }
      }

      onComplete();
    } catch (error) {
      console.error('[CreateFlow] Error creating post:', error);
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
      return true;
    }
    return true;
  }, [step, draft]);

  // Handle next
  const handleNext = () => {
    if (step === 'content') {
      setStep('details');
      // Auto-trigger AI suggestions when moving to details step if AI is ready
      if (aiProfileStatus === 'ready' && draft.mediaUrl && !aiSuggestions && !aiLoading) {
        setTimeout(() => handleAiHelp(), 300); // Small delay to let step transition complete
      }
    } else if (step === 'details') {
      setStep('review');
    }
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
      <div className="flex-shrink-0 border-b border-[#302927] bg-gradient-to-b from-black to-transparent">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0d0c0a] border border-[#302927] text-[#726d6c] hover:text-white hover:border-[#e8a990]/35 hover:bg-[#302927] transition-all duration-300 active:scale-95"
          >
            {step === 'content' ? Icons.close : Icons.back}
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white tracking-tight">
              {step === 'content' && 'Create Post'}
              {step === 'details' && 'Add Details'}
              {step === 'review' && 'Review'}
            </h1>
            
            {/* AI Status Badge */}
            {aiProfileStatus === 'ready' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#e8a990]/10 border border-[#e8a990]/20">
                {Icons.sparkles}
                <span className="text-[10px] font-medium text-[#e8a990] uppercase tracking-wider">AI Ready</span>
              </div>
            )}
            {aiProfileStatus === 'none' && step === 'details' && (
              <button
                onClick={() => setShowAiSetup(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#302927] border border-[#302927] hover:border-[#e8a990]/35 transition-colors"
              >
                <span className="text-[10px] font-medium text-[#726d6c] uppercase tracking-wider">🔧 Setup AI</span>
              </button>
            )}
          </div>

          {step !== 'review' ? (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 active:scale-95 ${
                canProceed
                  ? 'bg-gradient-to-r from-[#e8a990] to-[#c97b63] text-black shadow-[0_0_20px_rgba(232,169,144,0.3)] hover:shadow-[0_0_30px_rgba(232,169,144,0.4)]'
                  : 'bg-[#302927] text-[#726d6c] border border-[#302927] cursor-not-allowed'
              }`}
            >
              Next
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {/* Step Progress Bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            {/* Step 1 */}
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step === 'content' 
                  ? 'bg-[#e8a990] text-black' 
                  : step === 'details' || step === 'review'
                  ? 'bg-[#e8a990]/20 text-[#e8a990] border border-[#e8a990]/30'
                  : 'bg-[#302927] text-[#726d6c]'
              }`}>
                {step === 'details' || step === 'review' ? '✓' : '1'}
              </div>
              <div className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                step === 'details' || step === 'review' ? 'bg-[#e8a990]/30' : 'bg-[#302927]'
              }`} />
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step === 'details' 
                  ? 'bg-[#e8a990] text-black' 
                  : step === 'review'
                  ? 'bg-[#e8a990]/20 text-[#e8a990] border border-[#e8a990]/30'
                  : 'bg-[#302927] text-[#726d6c]'
              }`}>
                {step === 'review' ? '✓' : '2'}
              </div>
              <div className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                step === 'review' ? 'bg-[#e8a990]/30' : 'bg-[#302927]'
              }`} />
            </div>

            {/* Step 3 */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              step === 'review' 
                ? 'bg-[#e8a990] text-black' 
                : 'bg-[#302927] text-[#726d6c]'
            }`}>
              3
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Step 1: Content Selection */}
        {step === 'content' && (
          <div className="py-5 space-y-6">
            {/* Media Selection */}
            <section>
              <h2 className="text-[10px] font-semibold text-[#e8a990] uppercase tracking-widest mb-3">
                Select Content
              </h2>

              {!draft.mediaUrl ? (
                <>
                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="video/*,image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Uploading Overlay */}
                  {uploading && (
                    <div className="mb-4 p-6 rounded-2xl bg-black border border-[#e8a990]/35 flex flex-col items-center justify-center">
                      <div className="w-10 h-10 border-2 border-[#e8a990]/25 border-t-[#843c2d] rounded-full animate-spin mb-3" />
                      <p className="text-sm text-[#e8a990]">Uploading...</p>
                    </div>
                  )}

                  {/* Source Options */}
                  {!uploading && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={() => setShowClipsPicker(true)}
                        className="group flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-black border border-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_25px_rgba(212,168,83,0.08)] transition-all duration-300 active:scale-95"
                      >
                        <span className="text-[#e8a990] group-hover:scale-110 transition-transform">{Icons.folder}</span>
                        <span className="text-sm text-white font-medium">From Clips</span>
                      </button>

                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="group flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-black border border-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_25px_rgba(212,168,83,0.08)] transition-all duration-300 active:scale-95"
                      >
                        <span className="text-[#e8a990] group-hover:scale-110 transition-transform">{Icons.camera}</span>
                        <span className="text-sm text-white font-medium">Camera Roll</span>
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-black border border-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_25px_rgba(212,168,83,0.08)] transition-all duration-300 active:scale-95"
                      >
                        <span className="text-[#e8a990] group-hover:scale-110 transition-transform">{Icons.upload}</span>
                        <span className="text-sm text-white font-medium">Upload</span>
                      </button>

                      <div className="flex flex-col p-5 rounded-2xl bg-black border border-[#302927]">
                        <span className="text-[#e8a990] mb-3">{Icons.link}</span>
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
                            className="mt-3 text-xs text-[#e8a990] font-medium hover:underline"
                          >
                            Use URL
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Media Preview */
                <div className="relative rounded-2xl overflow-hidden bg-[#0d0c0a] aspect-[9/16] max-h-[300px] border border-[#302927]">
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
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm text-white border border-white/10 hover:bg-black/90 transition-colors"
                  >
                    {Icons.close}
                  </button>
                </div>
              )}
            </section>

            {/* Platform Selection */}
            <section>
              <h2 className="text-[10px] font-semibold text-[#e8a990] uppercase tracking-widest mb-3">
                Platforms
              </h2>

              <div className="space-y-2">
                {Object.entries(accountsByPlatform).map(([platform, platformAccounts]) => (
                  <div key={platform} className="space-y-2">
                    {platformAccounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => toggleAccount(account.id)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-300 ${
                          draft.accountIds.includes(account.id)
                            ? 'bg-[#843c2d]/10 border-[#843c2d]/50 shadow-[0_0_20px_rgba(212,168,83,0.1)]'
                            : 'bg-black border-[#302927] hover:border-[#e8a990]/35'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${PLATFORM_COLORS[platform] || 'from-gray-600 to-gray-700'} flex items-center justify-center text-xl overflow-hidden`}
                        >
                          {account.profile_image_url ? (
                            <img
                              src={account.profile_image_url}
                              alt=""
                              className="w-full h-full object-cover"
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
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            draft.accountIds.includes(account.id)
                              ? 'border-[#843c2d] bg-[#843c2d] text-black'
                              : 'border-[#3a3534]'
                          }`}
                        >
                          {draft.accountIds.includes(account.id) && Icons.check}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}

                {Object.keys(accountsByPlatform).length === 0 && (
                  <div className="p-8 rounded-2xl bg-black border border-[#302927] text-center">
                    <p className="text-sm text-[#726d6c]">No connected accounts</p>
                    <p className="text-xs text-[#e8a990] mt-1">Connect accounts in Settings</p>
                  </div>
                )}
              </div>
            </section>

            {/* Schedule */}
            <section>
              <h2 className="text-[10px] font-semibold text-[#e8a990] uppercase tracking-widest mb-3">
                Schedule
              </h2>

              <div className="space-y-3">
                {/* Day-based scheduling */}
                <button
                  onClick={() => setDraft((d) => ({ ...d, scheduleMode: 'day' }))}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                    draft.scheduleMode === 'day'
                      ? 'bg-[#843c2d]/10 border-[#843c2d]/50 shadow-[0_0_20px_rgba(212,168,83,0.1)]'
                      : 'bg-black border-[#302927] hover:border-[#e8a990]/35'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      draft.scheduleMode === 'day'
                        ? 'border-[#843c2d] bg-[#843c2d]'
                        : 'border-[#3a3534]'
                    }`}
                  >
                    {draft.scheduleMode === 'day' && (
                      <div className="w-2 h-2 rounded-full bg-black" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm text-white font-medium">Schedule for a day</div>
                    <div className="text-xs text-[#726d6c]">Posts at midnight • {slotsPerDay} slots per day</div>
                  </div>
                </button>

                {draft.scheduleMode === 'day' && (
                  <div className="pl-8 space-y-3">
                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs text-[#726d6c] mb-2">Select Date</label>
                      <input
                        type="date"
                        value={draft.scheduledDate || ''}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setDraft((d) => ({ ...d, scheduledDate: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-black border border-[#302927] text-white text-sm focus:border-[#843c2d]/40 focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Slot Picker - Dynamic */}
                    <div>
                      <label className="block text-xs text-[#726d6c] mb-2">Slot Number</label>
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(slotsPerDay, 3)}, 1fr)` }}>
                        {Array.from({ length: slotsPerDay }, (_, i) => i + 1).map((slotNum) => (
                          <button
                            key={slotNum}
                            onClick={() => setDraft((d) => ({ ...d, slotNumber: slotNum }))}
                            className={`px-4 py-3 rounded-xl border transition-all ${
                              draft.slotNumber === slotNum
                                ? 'bg-[#843c2d]/20 border-[#843c2d] text-white'
                                : 'bg-black border-[#302927] text-[#726d6c] hover:border-[#e8a990]/35'
                            }`}
                          >
                            <div className="text-sm font-medium">Slot {slotNum}</div>
                            <div className="text-xs opacity-70">
                              {slotNum === 1 ? 'First' : slotNum === 2 ? 'Second' : slotNum === 3 ? 'Third' : `#${slotNum}`}
                            </div>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-[#726d6c] mt-2">
                        💡 All slots post at midnight. Use slot numbers to organize your daily posts.
                      </p>
                    </div>
                  </div>
                )}

                {/* Post Now Option */}
                <button
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      scheduleMode: 'now',
                      scheduledDate: undefined,
                      slotNumber: undefined,
                    }))
                  }
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                    draft.scheduleMode === 'now'
                      ? 'bg-[#843c2d]/10 border-[#843c2d]/50 shadow-[0_0_20px_rgba(212,168,83,0.1)]'
                      : 'bg-black border-[#302927] hover:border-[#e8a990]/35'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      draft.scheduleMode === 'now'
                        ? 'border-[#843c2d] bg-[#843c2d]'
                        : 'border-[#3a3534]'
                    }`}
                  >
                    {draft.scheduleMode === 'now' && (
                      <div className="w-2 h-2 rounded-full bg-black" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm text-white font-medium">Post immediately</div>
                    <div className="text-xs text-[#726d6c]">Publishes right now</div>
                  </div>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <div className="py-5 space-y-6">
            {/* Preview */}
            <section className="relative rounded-2xl overflow-hidden bg-[#0d0c0a] aspect-video border border-[#302927]">
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
              <div className="absolute bottom-3 left-3 flex gap-1.5">
                {selectedAccounts.map((acc) => (
                  <span
                    key={acc.id}
                    className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-xs border border-white/10"
                  >
                    {PLATFORM_ICONS[acc.platform]}
                  </span>
                ))}
              </div>
            </section>

            {/* Title (optional) */}
            <section>
              <label className="block text-[10px] font-semibold text-[#e8a990] uppercase tracking-widest mb-2">
                Title (Optional)
              </label>
              <input
                type="text"
                value={draft.title || ''}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Give your post a title..."
                className="w-full px-4 py-3.5 rounded-2xl bg-black border border-[#302927] text-white placeholder-[#726d6c] outline-none focus:border-[#843c2d]/40 focus:shadow-[0_0_20px_rgba(212,168,83,0.1)] transition-all duration-300 text-sm"
              />
            </section>

            {/* Caption */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-semibold text-[#e8a990] uppercase tracking-widest">
                  Caption
                </label>
                {aiProfileStatus === 'ready' && (
                  <button
                    onClick={handleAiHelp}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d0c0a] border border-[#302927] text-xs text-[#e8a990] font-medium hover:border-[#e8a990]/35 transition-all duration-300 disabled:opacity-60"
                  >
                    {Icons.sparkles}
                    {aiLoading ? 'Thinking…' : 'Refresh AI'}
                  </button>
                )}
              </div>
              
              {aiLoading && (
                <div className="mb-3 p-4 rounded-xl bg-[#0d0c0a] border border-[#e8a990]/25 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-[#e8a990]/25 border-t-[#843c2d] rounded-full animate-spin" />
                  <span className="text-sm text-[#e8a990]">AI is crafting suggestions...</span>
                </div>
              )}
              
              <textarea
                value={draft.caption}
                onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                placeholder={aiProfileStatus === 'none' ? "Write your caption... (AI suggestions available after setup)" : "Write your caption... (AI will suggest automatically)"}
                rows={4}
                className="w-full px-4 py-3.5 rounded-2xl bg-black border border-[#302927] text-white placeholder-[#726d6c] outline-none focus:border-[#843c2d]/40 focus:shadow-[0_0_20px_rgba(212,168,83,0.1)] transition-all duration-300 resize-none text-sm"
              />

              {aiError && (
                <div className="mt-2 text-xs text-red-400">
                  {aiError}
                </div>
              )}

              {aiSuggestions && aiSuggestions.captions && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[10px] uppercase tracking-widest text-[#726d6c]">AI Suggestions</div>
                    {uniquePlatforms.map((platform) => (
                      <button
                        key={platform}
                        onClick={() => setAiPlatform(platform)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-widest border transition-all ${
                          aiPlatform === platform
                            ? 'bg-[#843c2d]/15 border-[#843c2d]/50 text-[#e8a990]'
                            : 'bg-[#0d0c0a] border-[#302927] text-[#726d6c] hover:border-[#e8a990]/35'
                        }`}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>

                  {(aiSuggestions.captions[aiPlatform] || []).slice(0, 3).map((caption, index) => {
                    const hashtags = aiSuggestions.hashtags?.[aiPlatform] || [];
                    const key = `${aiPlatform}:${caption}`;
                    const feedback = aiFeedback[key];

                    return (
                      <div key={`${aiPlatform}-${index}`} className="p-3 rounded-xl bg-[#0d0c0a] border border-[#302927] space-y-2">
                        <p className="text-sm text-white whitespace-pre-wrap">{caption}</p>
                        {hashtags.length > 0 && (
                          <p className="text-xs text-[#e8a990]">
                            {hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ')}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleApplySuggestion(caption, hashtags)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-[#302927] border border-[#302927] text-white hover:border-[#e8a990]/35"
                          >
                            Use this
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => submitAiFeedback(aiPlatform, caption, 'up')}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border ${feedback === 'up' ? 'border-emerald-400 text-emerald-300' : 'border-[#302927] text-[#726d6c] hover:border-emerald-400/40'}`}
                            >
                              👍
                            </button>
                            <button
                              onClick={() => submitAiFeedback(aiPlatform, caption, 'down')}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border ${feedback === 'down' ? 'border-red-400 text-red-300' : 'border-[#302927] text-[#726d6c] hover:border-red-400/40'}`}
                            >
                              👎
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Hashtags */}
            <section>
              <label className="block text-[10px] font-semibold text-[#e8a990] uppercase tracking-widest mb-2">
                Hashtags
              </label>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                  placeholder="#hashtag"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-black border border-[#302927] text-white placeholder-[#726d6c] outline-none focus:border-[#843c2d]/40 transition-colors text-sm"
                />
                <button
                  onClick={addHashtag}
                  className="px-5 py-2.5 rounded-xl bg-[#302927] border border-[#302927] text-white text-sm font-medium hover:border-[#e8a990]/35 transition-colors"
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
                      className="px-3 py-1.5 rounded-xl bg-black border border-[#302927] text-sm text-white hover:border-red-500/30 hover:text-red-400 transition-colors"
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
                <label className="block text-[10px] font-semibold text-[#e8a990] uppercase tracking-widest mb-2">
                  Campaign (Optional)
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDraft((d) => ({ ...d, campaignId: undefined }))}
                    className={`px-4 py-2.5 rounded-xl border transition-all duration-300 text-sm font-medium ${
                      !draft.campaignId
                        ? 'bg-[#843c2d]/10 border-[#843c2d]/50 text-[#e8a990]'
                        : 'bg-black border-[#302927] text-white hover:border-[#e8a990]/35'
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
                        className={`px-4 py-2.5 rounded-xl border transition-all duration-300 text-sm font-medium flex items-center gap-2 ${
                          draft.campaignId === campaign.id
                            ? 'bg-[#843c2d]/10 border-[#843c2d]/50 text-[#e8a990]'
                            : 'bg-black border-[#302927] text-white hover:border-[#e8a990]/35'
                        }`}
                      >
                        {campaign.color && (
                          <span
                            className="w-2 h-2 rounded-full"
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
          <div className="py-5 space-y-5">
            {/* Preview */}
            <section className="relative rounded-2xl overflow-hidden bg-[#0d0c0a] aspect-video border border-[#302927]">
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
                  <div className="text-[10px] text-[#726d6c] uppercase tracking-widest mb-1">Title</div>
                  <div className="text-white font-medium">{draft.title}</div>
                </div>
              )}

              {/* Caption */}
              {draft.caption && (
                <div>
                  <div className="text-[10px] text-[#726d6c] uppercase tracking-widest mb-1">Caption</div>
                  <div className="text-[#b8b2b1] text-sm whitespace-pre-wrap leading-relaxed">{draft.caption}</div>
                </div>
              )}

              {/* Hashtags */}
              {draft.hashtags.length > 0 && (
                <div>
                  <div className="text-[10px] text-[#726d6c] uppercase tracking-widest mb-1">Hashtags</div>
                  <div className="text-[#e8a990] text-sm">
                    {draft.hashtags.map((t) => `#${t}`).join(' ')}
                  </div>
                </div>
              )}

              {/* Schedule */}
              <div className="p-4 rounded-2xl bg-black border border-[#302927]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#843c2d]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#e8a990]">{Icons.calendar}</span>
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">
                      {draft.scheduleMode === 'now'
                        ? 'Posting immediately'
                        : draft.scheduledDate
                        ? `${new Date(`${draft.scheduledDate}T00:00:00`).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })} at midnight`
                        : 'No schedule set'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Platforms */}
              <div className="p-4 rounded-2xl bg-black border border-[#302927]">
                <div className="text-[10px] text-[#726d6c] uppercase tracking-widest mb-3">Posting to</div>
                <div className="flex flex-wrap gap-2">
                  {selectedAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0d0c0a] border border-[#302927]"
                    >
                      <span>{PLATFORM_ICONS[acc.platform]}</span>
                      <span className="text-sm text-white">@{acc.account_handle}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campaign */}
              {draft.campaignId && (
                <div className="p-4 rounded-2xl bg-black border border-[#302927]">
                  <div className="text-[10px] text-[#726d6c] uppercase tracking-widest mb-1">Campaign</div>
                  <div className="text-white font-medium flex items-center gap-2">
                    {(() => {
                      const camp = campaigns.find((c) => c.id === draft.campaignId);
                      return (
                        <>
                          {camp?.color && (
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: camp.color }} />
                          )}
                          {camp?.name || 'Unknown'}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Footer (Review step only) */}
      {step === 'review' && (
        <div className="flex-shrink-0 p-4 border-t border-[#302927] bg-black safe-area-bottom">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#843c2d] to-[#6b3323] text-black font-semibold text-lg disabled:opacity-50 active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(212,168,83,0.3)] hover:shadow-[0_0_40px_rgba(212,168,83,0.4)]"
          >
            {submitting
              ? 'Creating...'
              : draft.scheduleMode === 'now'
              ? 'Post Now'
              : 'Schedule Post'}
          </button>
        </div>
      )}

      {/* Clips Picker Modal */}
      {showClipsPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowClipsPicker(false)}
          />

          {/* Sheet */}
          <div className="relative w-full max-w-lg max-h-[85vh] bg-black rounded-t-3xl overflow-hidden flex flex-col border-t border-[#302927] animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#3a3534]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-4 border-b border-[#302927]">
              <h2 className="text-lg font-semibold text-white">Select from Clips</h2>
              <button
                onClick={() => setShowClipsPicker(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#302927] text-[#726d6c] hover:text-white transition-colors"
              >
                {Icons.close}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-[#726d6c] uppercase tracking-widest">Clips</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setClipFilter('unposted')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border transition-all ${
                      clipFilter === 'unposted'
                        ? 'bg-[#843c2d]/15 border-[#843c2d]/50 text-[#e8a990]'
                        : 'bg-[#0d0c0a] border-[#302927] text-[#726d6c] hover:border-[#e8a990]/35'
                    }`}
                  >
                    Unposted
                  </button>
                  <button
                    onClick={() => setClipFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border transition-all ${
                      clipFilter === 'all'
                        ? 'bg-[#843c2d]/15 border-[#843c2d]/50 text-[#e8a990]'
                        : 'bg-[#0d0c0a] border-[#302927] text-[#726d6c] hover:border-[#e8a990]/35'
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>
              {loadingClips ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-10 h-10 border-2 border-[#e8a990]/25 border-t-[#843c2d] rounded-full animate-spin mb-3" />
                  <p className="text-sm text-[#726d6c]">Loading clips...</p>
                </div>
              ) : clips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-[#302927] flex items-center justify-center mb-4">
                    <span className="text-2xl text-[#726d6c]">{Icons.folder}</span>
                  </div>
                  <p className="text-sm text-[#726d6c]">No clips available</p>
                  <p className="text-xs text-[#726d6c] mt-1">Upload clips to use them here</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {clips.map((clip) => {
                    const thumbUrl = getClipThumbnail(clip);
                    return (
                      <button
                        key={clip.id}
                        onClick={() => handleSelectClip(clip)}
                        className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-[#302927] border border-[#302927] hover:border-[#843c2d]/50 transition-all active:scale-95"
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={clip.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#0d0c0a]">
                            <span className="text-3xl">🎬</span>
                          </div>
                        )}

                        {/* Title overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-white font-medium truncate flex-1">
                              {clip.title || 'Untitled'}
                            </p>
                            {clipFilter === 'unposted' && (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Unused
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-[#843c2d]/0 group-hover:bg-[#843c2d]/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-[#e8a990] scale-0 group-hover:scale-100 transition-transform">
                            {Icons.check}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Setup Modal */}
      {showAiSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-black border border-[#302927] rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#302927] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Icons.sparkles}
                <h3 className="text-lg font-semibold text-white">Quick AI Setup</h3>
              </div>
              <button
                onClick={() => setShowAiSetup(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#726d6c] hover:text-white hover:bg-[#302927] transition-colors"
              >
                {Icons.close}
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[#726d6c]">
                Set up your AI voice to get personalized caption suggestions that match your brand tone.
              </p>

              {/* Quick Presets */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Choose Your Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['professional', 'casual', 'playful', 'artistic'] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          let toneDescription = '';
                          
                          if (preset === 'professional') {
                            toneDescription = 'Professional, polished, and business-appropriate. Clear and concise messaging.';
                          } else if (preset === 'casual') {
                            toneDescription = 'Casual, friendly, and approachable. Conversational and relatable.';
                          } else if (preset === 'playful') {
                            toneDescription = 'Playful, energetic, and fun. Engaging with personality and humor.';
                          } else if (preset === 'artistic') {
                            toneDescription = 'Artistic, creative, and expressive. Poetic and thought-provoking.';
                          }

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
                              max_emojis: 1,
                              max_hashtags: 7,
                              is_active: true,
                            }),
                          });

                          if (response.ok) {
                            setAiProfileStatus('ready');
                            setShowAiSetup(false);
                            // Trigger AI suggestions immediately
                            setTimeout(() => handleAiHelp(), 300);
                          }
                        } catch (error) {
                          console.error('[CreateFlow] AI setup error:', error);
                        }
                      }}
                      className="py-3 px-4 rounded-xl text-sm font-medium bg-[#0d0c0a] border border-[#302927] text-white hover:border-[#e8a990]/35 hover:bg-[#843c2d]/5 transition-all duration-300"
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

              <div className="pt-3 border-t border-[#302927]">
                <a
                  href="/admin/ai-studio"
                  className="text-sm text-[#e8a990] hover:text-[#c97b63] transition-colors"
                >
                  Or customize in Advanced Settings →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
