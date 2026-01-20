'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Hls from 'hls.js';

// =============================================================================
// TYPES
// =============================================================================

type WizardStep = 'content' | 'accounts' | 'caption' | 'schedule' | 'review';

type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'threads';

interface MediaItem {
  id: string;
  type: 'video' | 'image';
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  duration?: number;
  width?: number;
  height?: number;
  uid?: string; // Cloudflare Stream UID
}

interface SocialAccount {
  id: string;
  entity_id?: string;
  platform: string;
  account_handle?: string;
  account_name?: string;
  profile_image_url?: string;
  postforme_account_id?: string;
  follower_count?: number;
}

interface PlatformSettings {
  enabled: boolean;
  postType?: string;
  captionOverride?: string;
}

interface WizardState {
  // Step 1: Content
  media: MediaItem | null;
  sourceType: 'library' | 'upload' | 'clip' | null;
  sourceId?: string;
  trimStart?: number;
  trimEnd?: number;

  // Step 2: Accounts (replaces platforms)
  selectedAccountIds: string[];
  platforms: Record<Platform, PlatformSettings>; // Legacy, kept for compatibility

  // Step 3: Caption
  caption: string;
  hashtags: string[];
  mentions: string[];
  firstComment: string;

  // Step 4: Schedule
  scheduleMode: 'now' | 'scheduled';
  scheduledAt: string;
  timezone: string;
  requiresApproval: boolean;

  // Metadata
  title: string;
  notes: string;
}

const STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: 'content', label: 'Content', number: 1 },
  { id: 'accounts', label: 'Accounts', number: 2 },
  { id: 'caption', label: 'Caption', number: 3 },
  { id: 'schedule', label: 'Schedule', number: 4 },
  { id: 'review', label: 'Review', number: 5 },
];

const PLATFORMS_CONFIG: { id: Platform; name: string; icon: string; color: string; postTypes: string[] }[] = [
  { id: 'tiktok', name: 'TikTok', icon: '📱', color: '#00f2ea', postTypes: ['video'] },
  { id: 'instagram', name: 'Instagram', icon: '📷', color: '#E4405F', postTypes: ['reel', 'post', 'story'] },
  { id: 'youtube', name: 'YouTube', icon: '▶️', color: '#FF0000', postTypes: ['short', 'video'] },
  { id: 'facebook', name: 'Facebook', icon: '👤', color: '#1877F2', postTypes: ['reel', 'post'] },
  { id: 'threads', name: 'Threads', icon: '🧵', color: '#000000', postTypes: ['post'] },
];

const DEFAULT_STATE: WizardState = {
  media: null,
  sourceType: null,
  selectedAccountIds: [],
  platforms: {
    tiktok: { enabled: false },
    instagram: { enabled: false },
    youtube: { enabled: false },
    facebook: { enabled: false },
    threads: { enabled: false },
  },
  caption: '',
  hashtags: [],
  mentions: [],
  firstComment: '',
  scheduleMode: 'scheduled',
  scheduledAt: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  requiresApproval: false,
  title: '',
  notes: '',
};

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  upload: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  library: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  x: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  sparkles: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
};

// =============================================================================
// VIDEO PREVIEW COMPONENT (handles HLS streams)
// =============================================================================

const STREAM_CUSTOMER = 'customer-tpkm273r1u0s40no';

function VideoPreview({
  url,
  uid,
  poster,
}: {
  url?: string;
  uid?: string;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Derive HLS URL from uid if not provided
  const hlsUrl = url || (uid ? `https://${STREAM_CUSTOMER}.cloudflarestream.com/${uid}/manifest/video.m3u8` : null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if it's an HLS stream
    const isHls = hlsUrl.includes('.m3u8') || hlsUrl.includes('cloudflarestream.com');

    if (isHls && Hls.isSupported()) {
      // Use HLS.js for non-Safari browsers
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1,
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = hlsUrl;
      video.play().catch(() => {});
    } else {
      // Direct video URL (MP4, etc.)
      video.src = hlsUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl]);

  if (!hlsUrl) {
    return poster ? (
      <img src={poster} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
    ) : (
      <div className="text-4xl">🎬</div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      poster={poster}
      className="max-h-full max-w-full rounded-lg"
      style={{ maxHeight: 'calc(100vh - 200px)' }}
    />
  );
}

// =============================================================================
// POST WIZARD COMPONENT
// =============================================================================

interface PostWizardProps {
  entityId?: string;
  entityName?: string;
  accounts: SocialAccount[];
  onClose: () => void;
  onComplete: () => void;
}

export function PostWizard({ entityId, entityName, accounts, onClose, onComplete }: PostWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('content');
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [libraryItems, setLibraryItems] = useState<MediaItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // Fetch library items
  useEffect(() => {
    async function fetchLibrary() {
      setLoadingLibrary(true);
      try {
        // Fetch from clips and media library
        // Fetch all clips (paginate if needed)
        const items: MediaItem[] = [];
        let offset = 0;
        const batchSize = 50;
        let hasMore = true;

        while (hasMore) {
          const clipsRes = await fetch(`/api/clips?limit=${batchSize}&offset=${offset}`);
          if (clipsRes.ok) {
            const clipsData = (await clipsRes.json()) as { clips?: Record<string, unknown>[]; hasMore?: boolean };
            const clips = clipsData.clips || [];
            clips.forEach((clip: any) => {
              // Generate thumbnail from UID if not provided
              let thumbnailUrl = clip.poster_url || clip.thumbnail;
              if (!thumbnailUrl && clip.uid) {
                thumbnailUrl = `https://${STREAM_CUSTOMER}.cloudflarestream.com/${clip.uid}/thumbnails/thumbnail.jpg`;
              }
              // Also try to extract UID from URL if still no thumbnail
              if (!thumbnailUrl && clip.url) {
                const uidMatch = clip.url.match(/cloudflarestream\.com\/([a-f0-9]{32})/i);
                if (uidMatch) {
                  thumbnailUrl = `https://${STREAM_CUSTOMER}.cloudflarestream.com/${uidMatch[1]}/thumbnails/thumbnail.jpg`;
                }
              }

              // Parse duration - handle string "0.0" and null
              let duration: number | undefined;
              if (clip.duration_seconds && clip.duration_seconds > 0) {
                duration = clip.duration_seconds;
              } else if (clip.duration && parseFloat(clip.duration) > 0) {
                duration = parseFloat(clip.duration);
              }

              items.push({
                id: `clip-${clip.id}`,
                type: 'video',
                url: clip.url, // Stream URL
                thumbnailUrl,
                filename: clip.title,
                duration,
                uid: clip.uid, // Store UID for fetching duration later if needed
              });
            });
            hasMore = Boolean(clipsData.hasMore) && clips.length === batchSize;
            offset += clips.length;
          } else {
            hasMore = false;
          }
        }

        // Also fetch from media library if available
        try {
          const libraryRes = await fetch('/api/social/library?limit=50');
          if (libraryRes.ok) {
            const libraryData = (await libraryRes.json()) as { items?: Record<string, unknown>[] };
            (libraryData.items || []).forEach((item) => {
              items.push({
                id: `lib-${item.id as string}`,
                type: (item.media_type as 'video' | 'image') || 'video',
                url: item.media_url as string,
                thumbnailUrl: item.thumbnail_url as string | undefined,
                filename: (item.filename as string) || (item.title as string),
                duration: item.duration_ms ? (item.duration_ms as number) / 1000 : undefined,
              });
            });
          }
        } catch (libErr) {
          // Library may not exist yet, ignore
        }

        setLibraryItems(items);
      } catch (err) {
        console.error('[PostWizard] Failed to fetch library:', err);
      } finally {
        setLoadingLibrary(false);
      }
    }
    fetchLibrary();
  }, []);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const togglePlatform = useCallback((platform: Platform) => {
    setState((prev) => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [platform]: {
          ...prev.platforms[platform],
          enabled: !prev.platforms[platform].enabled,
        },
      },
    }));
  }, []);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 'content':
        return !!state.media;
      case 'accounts':
        return state.selectedAccountIds.length > 0;
      case 'caption':
        return true; // Caption is optional
      case 'schedule':
        return state.scheduleMode === 'now' || !!state.scheduledAt;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [currentStep, state]);

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
  };

  const goNext = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const goBack = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Get platforms from selected accounts for backwards compatibility
      const selectedAccounts = accounts.filter((acc) => state.selectedAccountIds.includes(acc.id));
      const platforms = [...new Set(selectedAccounts.map((acc) => acc.platform))];

      const publishNow = state.scheduleMode === 'now';

      const postData = {
        status: 'draft', // Start as draft, publish will update
        entity_id: entityId || null, // Optional - no entity filtering
        account_ids: state.selectedAccountIds,
        media_type: state.media?.type || 'video',
        media_url: state.media?.url,
        thumbnail_url: state.media?.thumbnailUrl,
        source_type: state.sourceType,
        source_id: state.sourceId,
        caption: state.caption,
        hashtags: state.hashtags,
        mentions: state.mentions,
        first_comment: state.firstComment,
        scheduled_at: publishNow
          ? new Date().toISOString()
          : state.scheduledAt,
        timezone: state.timezone,
        platforms, // Keep for backwards compatibility
        title: state.title,
        requires_approval: state.requiresApproval,
        notes: state.notes,
      };

      // Step 1: Create the post in our database
      const res = await fetch('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      if (!res.ok) {
        throw new Error('Failed to create post');
      }

      const createResult = (await res.json()) as { id?: string };
      const postId = createResult.id;

      if (!postId) {
        throw new Error('No post ID returned');
      }

      // Step 2: Publish via Post for Me API (unless requires approval)
      if (!state.requiresApproval) {
        const publishRes = await fetch('/api/social/posts/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: postId,
            publish_now: publishNow,
          }),
        });

        if (!publishRes.ok) {
          const errorData = (await publishRes.json()) as { error?: string };
          console.error('[PostWizard] Publish error:', errorData);
          // Don't throw - post was created, just show warning
          alert(`Post created but publishing failed: ${errorData.error || 'Unknown error'}. You can retry from the dashboard.`);
        }
      }

      onComplete();
    } catch (err) {
      console.error('[PostWizard] Submit error:', err);
      alert('Failed to create post. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="h-full flex flex-col bg-[#0d0c0a]">
      {/* Header with Step Indicator */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold">Create Post</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927] transition-colors"
          >
            {Icons.x}
          </button>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = step.id === currentStep;
            const isClickable = index <= currentStepIndex || (index === currentStepIndex + 1 && canProceed());

            return (
              <button
                key={step.id}
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isCurrent
                    ? 'bg-[#843c2d] text-white'
                    : isCompleted
                    ? 'bg-[#302927] text-[#ede8df]'
                    : 'text-[#726d6c] hover:text-[#ede8df]'
                } ${!isClickable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  isCompleted ? 'bg-green-600' : isCurrent ? 'bg-white/20' : 'bg-[#502d26]/40'
                }`}>
                  {isCompleted ? '✓' : step.number}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === 'content' && (
          <ContentStep
            state={state}
            updateState={updateState}
            libraryItems={libraryItems}
            loadingLibrary={loadingLibrary}
            entityId={entityId}
          />
        )}
        {currentStep === 'accounts' && (
          <AccountsStep
            accounts={accounts}
            entityName={entityName}
            selectedAccountIds={state.selectedAccountIds}
            onToggleAccount={(accountId) => {
              const newSelected = state.selectedAccountIds.includes(accountId)
                ? state.selectedAccountIds.filter((id) => id !== accountId)
                : [...state.selectedAccountIds, accountId];
              setState((prev) => ({ ...prev, selectedAccountIds: newSelected }));
            }}
          />
        )}
        {currentStep === 'caption' && (
          <CaptionStep
            state={state}
            updateState={updateState}
            selectedAccounts={accounts.filter((acc) => state.selectedAccountIds.includes(acc.id))}
          />
        )}
        {currentStep === 'schedule' && (
          <ScheduleStep
            state={state}
            updateState={updateState}
          />
        )}
        {currentStep === 'review' && (
          <ReviewStep
            state={state}
            selectedAccounts={accounts.filter((acc) => state.selectedAccountIds.includes(acc.id))}
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex-shrink-0 border-t border-[#502d26]/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={currentStepIndex === 0 ? onClose : goBack}
            className="px-4 py-2 rounded-lg text-sm text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927] transition-colors"
          >
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={saving || !canProceed()}
              className="px-6 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creating...' : state.scheduleMode === 'now' ? 'Post Now' : 'Schedule Post'}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="px-6 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] disabled:opacity-50 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STEP COMPONENTS
// =============================================================================

function ContentStep({
  state,
  updateState,
  libraryItems,
  loadingLibrary,
  entityId,
}: {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  libraryItems: MediaItem[];
  loadingLibrary: boolean;
  entityId?: string;
}) {
  const [view, setView] = useState<'choose' | 'library' | 'upload'>('choose');
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectMedia = (item: MediaItem) => {
    updateState({
      media: item,
      sourceType: item.id.startsWith('clip-') ? 'clip' : 'library',
      sourceId: item.id.replace(/^(clip-|lib-)/, ''),
    });
    setPreviewItem(null);
    setView('choose');
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (entityId) {
        formData.append('entity_id', entityId);
      }

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise<{ url: string; type: string; filename: string }>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.success) {
                resolve(response);
              } else {
                reject(new Error(response.error || 'Upload failed'));
              }
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));
      });

      xhr.open('POST', '/api/social/library/upload');
      xhr.send(formData);

      const result = await uploadPromise;

      // Create media item from upload result
      const mediaItem: MediaItem = {
        id: `upload-${Date.now()}`,
        type: result.type === 'video' ? 'video' : 'image',
        url: result.url,
        filename: result.filename,
      };

      // Select the uploaded media
      updateState({
        media: mediaItem,
        sourceType: 'upload',
      });
      setView('choose');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Video Preview Modal
  if (previewItem) {
    return (
      <div className="h-full flex flex-col bg-black">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-black/80">
          <button
            onClick={() => setPreviewItem(null)}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <p className="text-sm text-white/90 truncate flex-1 px-3">{previewItem.filename || 'Preview'}</p>
          <button
            onClick={() => selectMedia(previewItem)}
            className="px-4 py-1.5 rounded-lg bg-[#843c2d] text-white text-sm font-medium"
          >
            Select
          </button>
        </div>

        {/* Video */}
        <div className="flex-1 flex items-center justify-center p-4">
          {previewItem.type === 'video' && (previewItem.url || previewItem.uid) ? (
            <VideoPreview
              url={previewItem.url}
              uid={previewItem.uid}
              poster={previewItem.thumbnailUrl}
            />
          ) : previewItem.thumbnailUrl ? (
            <img
              src={previewItem.thumbnailUrl}
              alt=""
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          ) : (
            <div className="text-4xl">📷</div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 bg-black/80">
          {previewItem.duration && (
            <p className="text-xs text-white/60">
              Duration: {Math.floor(previewItem.duration / 60)}:{String(Math.floor(previewItem.duration % 60)).padStart(2, '0')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (state.media) {
    return (
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-medium">Selected Content</h3>

        <div className="relative aspect-[9/16] max-w-xs mx-auto rounded-xl overflow-hidden bg-[#171616]">
          {state.media.thumbnailUrl ? (
            <img
              src={state.media.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {state.media.type === 'video' ? '🎬' : '📷'}
            </div>
          )}

          {state.media.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-center text-[#726d6c]">
          {state.media.filename || 'Selected media'}
        </p>

        <button
          onClick={() => updateState({ media: null, sourceType: null, sourceId: undefined })}
          className="w-full py-2 rounded-lg border border-[#502d26]/40 text-sm text-[#726d6c] hover:text-[#ede8df] hover:border-[#502d26] transition-colors"
        >
          Change Content
        </button>
      </div>
    );
  }

  if (view === 'library') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Content Library</h3>
            <p className="text-xs text-[#726d6c]">{libraryItems.length} items</p>
          </div>
          <button
            onClick={() => setView('choose')}
            className="text-sm text-[#843c2d] hover:text-[#9a4a3a]"
          >
            Back
          </button>
        </div>

        {loadingLibrary ? (
          <div className="py-12 text-center text-[#726d6c]">
            <div className="animate-spin w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full mx-auto mb-2" />
            Loading content...
          </div>
        ) : libraryItems.length === 0 ? (
          <div className="py-12 text-center text-[#726d6c]">
            <p>No content found</p>
            <p className="text-sm mt-1">Upload content or add clips first</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {libraryItems.map((item) => (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => setPreviewItem(item)}
                  className="w-full aspect-[9/16] rounded-lg overflow-hidden bg-[#171616] border border-transparent hover:border-[#843c2d] transition-colors relative"
                >
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {item.type === 'video' ? '🎬' : '📷'}
                    </div>
                  )}

                  {/* Play icon overlay */}
                  {item.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Title label */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-[10px] text-white truncate">{item.filename || 'Untitled'}</p>
                  </div>
                </button>

                {/* Quick select button */}
                <button
                  onClick={() => selectMedia(item)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#843c2d] text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Select"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-[#726d6c] text-center mt-4">
          Tap to preview, use checkmark to select
        </p>
      </div>
    );
  }

  if (view === 'upload') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Upload Content</h3>
          {!uploading && (
            <button
              onClick={() => setView('choose')}
              className="text-sm text-[#843c2d] hover:text-[#9a4a3a]"
            >
              Back
            </button>
          )}
        </div>

        {uploading ? (
          <div className="rounded-xl bg-[#171616] border border-[#502d26]/40 p-8 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-[#843c2d] border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-sm text-[#ede8df] mb-2">Uploading...</p>
            <div className="w-full h-2 bg-[#302927] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#843c2d] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-[#726d6c] mt-2">{uploadProgress}%</p>
          </div>
        ) : (
          <>
            {uploadError && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/40 text-sm text-red-400">
                {uploadError}
              </div>
            )}

            <div className="relative border-2 border-dashed border-[#502d26]/40 rounded-xl p-8 text-center cursor-pointer hover:border-[#843c2d] transition-colors">
              <div className="text-[#726d6c] mb-4">{Icons.upload}</div>
              <p className="text-sm text-[#726d6c] mb-2">Drag and drop or click to upload</p>
              <p className="text-xs text-[#726d6c]/70">MP4, MOV, JPG, PNG up to 500MB</p>
              <input
                type="file"
                accept="video/*,image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUpload(file);
                  }
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // Choose view
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-medium">Choose Content</h3>
      <p className="text-sm text-[#726d6c]">Select content from your library or upload new media.</p>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <button
          onClick={() => setView('library')}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border border-[#502d26]/40 hover:border-[#843c2d] hover:bg-[#302927]/30 transition-colors"
        >
          <div className="text-[#843c2d]">{Icons.library}</div>
          <span className="text-sm font-medium">From Library</span>
          <span className="text-xs text-[#726d6c]">{libraryItems.length} items</span>
        </button>

        <button
          onClick={() => setView('upload')}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border border-[#502d26]/40 hover:border-[#843c2d] hover:bg-[#302927]/30 transition-colors"
        >
          <div className="text-[#843c2d]">{Icons.upload}</div>
          <span className="text-sm font-medium">Upload New</span>
          <span className="text-xs text-[#726d6c]">Video or image</span>
        </button>
      </div>
    </div>
  );
}

function PlatformsStep({
  state,
  togglePlatform,
}: {
  state: WizardState;
  togglePlatform: (platform: Platform) => void;
}) {
  const enabledCount = Object.values(state.platforms).filter((p) => p.enabled).length;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium">Select Platforms</h3>
        <p className="text-sm text-[#726d6c] mt-1">
          Choose where to publish this content. {enabledCount > 0 && `${enabledCount} selected`}
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS_CONFIG.map((platform) => {
          const isEnabled = state.platforms[platform.id].enabled;

          return (
            <button
              key={platform.id}
              onClick={() => togglePlatform(platform.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                isEnabled
                  ? 'border-[#843c2d] bg-[#843c2d]/10'
                  : 'border-[#502d26]/40 hover:border-[#502d26]'
              }`}
            >
              <span className="text-2xl">{platform.icon}</span>
              <div className="flex-1 text-left">
                <p className="font-medium">{platform.name}</p>
                <p className="text-xs text-[#726d6c]">
                  {platform.postTypes.join(', ')}
                </p>
              </div>
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isEnabled
                    ? 'bg-[#843c2d] border-[#843c2d]'
                    : 'border-[#502d26]/60'
                }`}
              >
                {isEnabled && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Platform Preview Mockup */}
      {enabledCount > 0 && state.media && (
        <div className="mt-8">
          <h4 className="text-sm font-medium text-[#726d6c] mb-3">Preview</h4>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {PLATFORMS_CONFIG.filter((p) => state.platforms[p.id].enabled).map((platform) => (
              <div key={platform.id} className="flex-shrink-0 w-32">
                <div className="aspect-[9/16] rounded-xl overflow-hidden bg-[#171616] border border-[#502d26]/30">
                  {state.media?.thumbnailUrl ? (
                    <img src={state.media.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                  )}
                </div>
                <p className="text-xs text-center text-[#726d6c] mt-2">{platform.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountsStep({
  accounts,
  entityName,
  selectedAccountIds,
  onToggleAccount,
}: {
  accounts: SocialAccount[];
  entityName?: string;
  selectedAccountIds: string[];
  onToggleAccount: (accountId: string) => void;
}) {
  // Group accounts by platform
  const groupedAccounts = accounts.reduce((acc, account) => {
    const platform = account.platform || 'other';
    if (!acc[platform]) acc[platform] = [];
    acc[platform].push(account);
    return acc;
  }, {} as Record<string, SocialAccount[]>);

  const platformOrder = ['instagram', 'tiktok', 'youtube', 'facebook', 'threads', 'other'];
  const sortedPlatforms = Object.keys(groupedAccounts).sort(
    (a, b) => platformOrder.indexOf(a) - platformOrder.indexOf(b)
  );

  const platformIcons: Record<string, string> = {
    instagram: '📷',
    tiktok: '📱',
    youtube: '▶️',
    facebook: '👤',
    threads: '🧵',
    other: '🔗',
  };

  const platformColors: Record<string, string> = {
    instagram: '#E4405F',
    tiktok: '#00f2ea',
    youtube: '#FF0000',
    facebook: '#1877F2',
    threads: '#000000',
    other: '#726d6c',
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium">Select Accounts{entityName ? ` for ${entityName}` : ''}</h3>
        <p className="text-sm text-[#726d6c] mt-1">
          Choose which accounts to publish to.{' '}
          {selectedAccountIds.length > 0 && `${selectedAccountIds.length} selected`}
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[#726d6c]">No accounts connected for this entity.</p>
          <p className="text-sm text-[#726d6c]/70 mt-1">Connect accounts in the Accounts panel.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPlatforms.map((platform) => (
            <div key={platform}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#726d6c] mb-2 flex items-center gap-2">
                <span>{platformIcons[platform] || '🔗'}</span>
                {platform}
              </h4>
              <div className="space-y-2">
                {groupedAccounts[platform].map((account) => {
                  const isSelected = selectedAccountIds.includes(account.id);
                  return (
                    <button
                      key={account.id}
                      onClick={() => onToggleAccount(account.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-[#843c2d] bg-[#843c2d]/10'
                          : 'border-[#502d26]/40 hover:border-[#502d26]'
                      }`}
                    >
                      {/* Profile Image */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                        style={{
                          backgroundColor: `${platformColors[platform]}20`,
                        }}
                      >
                        {account.profile_image_url ? (
                          <img
                            src={account.profile_image_url}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          platformIcons[platform] || '🔗'
                        )}
                      </div>

                      {/* Account Info */}
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate">
                          {account.account_handle
                            ? `@${account.account_handle.replace(/^@/, '')}`
                            : account.account_name || 'Unnamed Account'}
                        </p>
                        <p className="text-xs text-[#726d6c] truncate">
                          {account.account_name || platform}
                          {account.follower_count ? ` • ${formatFollowers(account.follower_count)}` : ''}
                        </p>
                      </div>

                      {/* Checkbox */}
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          isSelected ? 'bg-[#843c2d] border-[#843c2d]' : 'border-[#502d26]/60'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to format follower counts
function formatFollowers(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M followers`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K followers`;
  return `${count} followers`;
}

function CaptionStep({
  state,
  updateState,
  selectedAccounts,
}: {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  selectedAccounts: SocialAccount[];
}) {
  const [hashtagInput, setHashtagInput] = useState('');

  const hasInstagram = selectedAccounts.some((acc) => acc.platform === 'instagram');

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !state.hashtags.includes(tag)) {
      updateState({ hashtags: [...state.hashtags, tag] });
    }
    setHashtagInput('');
  };

  const removeHashtag = (tag: string) => {
    updateState({ hashtags: state.hashtags.filter((t) => t !== tag) });
  };

  const captionLength = state.caption.length;
  const maxLength = 2200; // Instagram max

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium">Write Caption</h3>
        <p className="text-sm text-[#726d6c] mt-1">
          Craft your message. This will be used across all selected platforms.
        </p>
      </div>

      {/* Main Caption */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Caption</label>
          <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[#843c2d] hover:bg-[#302927] transition-colors">
            {Icons.sparkles}
            <span>Enhance with AI</span>
          </button>
        </div>
        <textarea
          value={state.caption}
          onChange={(e) => updateState({ caption: e.target.value })}
          placeholder="Write your caption here..."
          rows={5}
          className="w-full px-4 py-3 rounded-xl bg-[#171616] border border-[#502d26]/40 text-sm resize-none focus:outline-none focus:border-[#843c2d] transition-colors"
        />
        <div className="flex justify-between text-xs text-[#726d6c]">
          <span>{captionLength} characters</span>
          <span className={captionLength > maxLength ? 'text-red-400' : ''}>
            {maxLength - captionLength} remaining
          </span>
        </div>
      </div>

      {/* Hashtags */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Hashtags</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
            placeholder="Add hashtag..."
            className="flex-1 px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
          />
          <button
            onClick={addHashtag}
            className="px-4 py-2 rounded-lg bg-[#302927] text-sm hover:bg-[#3a3533] transition-colors"
          >
            Add
          </button>
        </div>
        {state.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {state.hashtags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#302927] text-xs"
              >
                #{tag}
                <button
                  onClick={() => removeHashtag(tag)}
                  className="text-[#726d6c] hover:text-[#ede8df]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* First Comment (for Instagram) */}
      {hasInstagram && (
        <div className="space-y-2">
          <label className="text-sm font-medium">First Comment (Instagram)</label>
          <input
            type="text"
            value={state.firstComment}
            onChange={(e) => updateState({ firstComment: e.target.value })}
            placeholder="Optional first comment with extra hashtags..."
            className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
          />
          <p className="text-xs text-[#726d6c]">
            Moves hashtags out of caption for cleaner appearance
          </p>
        </div>
      )}

      {/* Title (internal) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Internal Title (optional)</label>
        <input
          type="text"
          value={state.title}
          onChange={(e) => updateState({ title: e.target.value })}
          placeholder="For organization only, not published..."
          className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
        />
      </div>
    </div>
  );
}

function ScheduleStep({
  state,
  updateState,
}: {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}) {
  // Generate suggested times (next few hours)
  const suggestedTimes: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 4; i++) {
    const time = new Date(now.getTime() + i * 3600000);
    time.setMinutes(0, 0, 0);
    suggestedTimes.push(time.toISOString().slice(0, 16));
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium">Schedule Post</h3>
        <p className="text-sm text-[#726d6c] mt-1">
          Choose when to publish this content.
        </p>
      </div>

      {/* Post Now vs Schedule Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => updateState({ scheduleMode: 'now' })}
          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
            state.scheduleMode === 'now'
              ? 'border-[#843c2d] bg-[#843c2d]/10 text-[#ede8df]'
              : 'border-[#502d26]/40 text-[#726d6c] hover:border-[#502d26]'
          }`}
        >
          Post Now
        </button>
        <button
          onClick={() => updateState({ scheduleMode: 'scheduled' })}
          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
            state.scheduleMode === 'scheduled'
              ? 'border-[#843c2d] bg-[#843c2d]/10 text-[#ede8df]'
              : 'border-[#502d26]/40 text-[#726d6c] hover:border-[#502d26]'
          }`}
        >
          Schedule
        </button>
      </div>

      {state.scheduleMode === 'scheduled' && (
        <>
          {/* Date/Time Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date & Time</label>
            <input
              type="datetime-local"
              value={state.scheduledAt}
              onChange={(e) => updateState({ scheduledAt: e.target.value })}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
            />
          </div>

          {/* Suggested Times */}
          <div className="space-y-2">
            <label className="text-xs text-[#726d6c]">Suggested times</label>
            <div className="flex flex-wrap gap-2">
              {suggestedTimes.map((time) => {
                const date = new Date(time);
                const label = date.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                });
                const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });

                return (
                  <button
                    key={time}
                    onClick={() => updateState({ scheduledAt: time })}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      state.scheduledAt === time
                        ? 'bg-[#843c2d] text-white'
                        : 'bg-[#302927] text-[#726d6c] hover:text-[#ede8df]'
                    }`}
                  >
                    {dayLabel} {label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Approval Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-[#171616] border border-[#502d26]/30">
        <div>
          <p className="text-sm font-medium">Require Approval</p>
          <p className="text-xs text-[#726d6c] mt-0.5">Post will need review before publishing</p>
        </div>
        <button
          onClick={() => updateState({ requiresApproval: !state.requiresApproval })}
          className={`w-11 h-6 rounded-full transition-colors ${
            state.requiresApproval ? 'bg-[#843c2d]' : 'bg-[#302927]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
              state.requiresApproval ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Team Notes (optional)</label>
        <textarea
          value={state.notes}
          onChange={(e) => updateState({ notes: e.target.value })}
          placeholder="Internal notes for the team..."
          rows={2}
          className="w-full px-3 py-2 rounded-xl bg-[#171616] border border-[#502d26]/40 text-sm resize-none focus:outline-none focus:border-[#843c2d]"
        />
      </div>
    </div>
  );
}

function ReviewStep({
  state,
  selectedAccounts,
}: {
  state: WizardState;
  selectedAccounts: SocialAccount[];
}) {
  const platformIcons: Record<string, string> = {
    instagram: '📷',
    tiktok: '📱',
    youtube: '▶️',
    facebook: '👤',
    threads: '🧵',
    other: '🔗',
  };

  const checks = [
    { label: 'Content selected', passed: !!state.media },
    { label: 'Accounts selected', passed: selectedAccounts.length > 0 },
    { label: 'Caption added', passed: state.caption.length > 0 || true }, // Optional
    { label: 'Schedule set', passed: state.scheduleMode === 'now' || !!state.scheduledAt },
  ];

  const allPassed = checks.every((c) => c.passed);

  // Get unique platforms from selected accounts
  const uniquePlatforms = [...new Set(selectedAccounts.map((acc) => acc.platform))];

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium">Review & Confirm</h3>
        <p className="text-sm text-[#726d6c] mt-1">
          Double-check everything before {state.scheduleMode === 'now' ? 'posting' : 'scheduling'}.
        </p>
      </div>

      {/* Preview */}
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="w-24 h-32 rounded-lg overflow-hidden bg-[#171616] flex-shrink-0">
          {state.media?.thumbnailUrl ? (
            <img src={state.media.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              {state.media?.type === 'video' ? '🎬' : '📷'}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {state.title || state.caption?.slice(0, 40) || 'Untitled Post'}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {uniquePlatforms.map((platform) => (
              <span key={platform} title={platform} className="text-base">
                {platformIcons[platform] || '🔗'}
              </span>
            ))}
            <span className="text-xs text-[#726d6c]">
              {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-[#726d6c] mt-2">
            {state.scheduleMode === 'now' ? (
              'Posting immediately'
            ) : state.scheduledAt ? (
              `Scheduled for ${new Date(state.scheduledAt).toLocaleString()}`
            ) : (
              'Schedule not set'
            )}
          </p>
          {state.requiresApproval && (
            <p className="text-xs text-amber-400 mt-1">Requires approval</p>
          )}
        </div>
      </div>

      {/* Selected Accounts List */}
      {selectedAccounts.length > 0 && (
        <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/30">
          <p className="text-xs text-[#726d6c] mb-2">Publishing to</p>
          <div className="space-y-1.5">
            {selectedAccounts.map((acc) => (
              <div key={acc.id} className="flex items-center gap-2 text-sm">
                <span>{platformIcons[acc.platform] || '🔗'}</span>
                <span className="truncate">
                  {acc.account_handle
                    ? `@${acc.account_handle.replace(/^@/, '')}`
                    : acc.account_name || 'Account'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Caption Preview */}
      {state.caption && (
        <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/30">
          <p className="text-xs text-[#726d6c] mb-1">Caption</p>
          <p className="text-sm whitespace-pre-wrap">{state.caption}</p>
          {state.hashtags.length > 0 && (
            <p className="text-sm text-[#843c2d] mt-2">
              {state.hashtags.map((t) => `#${t}`).join(' ')}
            </p>
          )}
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Pre-flight Check</p>
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-sm">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                check.passed ? 'bg-green-600' : 'bg-[#502d26]/40'
              }`}
            >
              {check.passed ? (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <span className="text-[10px] text-[#726d6c]">—</span>
              )}
            </div>
            <span className={check.passed ? 'text-[#ede8df]' : 'text-[#726d6c]'}>
              {check.label}
            </span>
          </div>
        ))}
      </div>

      {!allPassed && (
        <p className="text-xs text-amber-400">Please complete all required fields before continuing.</p>
      )}
    </div>
  );
}

export default PostWizard;
