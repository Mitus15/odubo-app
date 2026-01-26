'use client';

/**
 * Arsenal Tab - Content Orchestration Hub
 * "Magazine & Bullets" - Upload → Deploy → Backfeed
 */

import { useState, useEffect, useCallback } from 'react';

// Types
interface Video {
  id: number;
  uid: string;
  title: string;
  description: string | null;
  original_filename: string | null;
  poster_url: string | null;
  duration: string | null;
  parent_video_id: number | null;
  clip_index: number | null;
  total_siblings: number | null;
  category: string | null;
  mood: string | null;
  type: string | null;
  artist_name: string | null;
  youtube_url: string | null;
  youtube_shorts_url: string | null;
  tiktok_url: string | null;
  instagram_reels_url: string | null;
  postforme_post_id: string | null;
  postforme_status: string | null;
  // Social metadata
  social_description: string | null;
  social_hashtags: string | null; // JSON array
  social_first_comment: string | null;
  social_visibility: string | null;
  created_at: string;
}

interface DeployMetadata {
  title: string;
  description: string;
  firstComment: string;
  hashtags: string[];
  visibility: 'public' | 'unlisted' | 'private';
}

type ViewMode = 'library' | 'deploy' | 'sync';
type FilterMode = 'all' | 'videos' | 'clips' | 'deployed' | 'not-deployed';

// Icons
const Icons = {
  library: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  deploy: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  sync: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  youtube: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  tiktok: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
    </svg>
  ),
  instagram: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  pending: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  minus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  ),
  expand: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
  collapse: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  drag: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h.01M8 15h.01M16 9h.01M16 15h.01" />
    </svg>
  ),
};

// Platform status indicator
function PlatformStatus({
  url,
  status,
  icon,
  platform
}: {
  url: string | null;
  status: string | null;
  icon: React.ReactNode;
  platform: string;
}) {
  const isLive = !!url;
  const isPending = status === 'scheduled';

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
        isLive
          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          : isPending
          ? 'bg-yellow-500/20 text-yellow-400'
          : 'bg-white/5 text-[#726d6c]'
      }`}
      title={`${platform}: ${isLive ? 'Live' : isPending ? 'Scheduled' : 'Not posted'}`}
      onClick={(e) => !url && e.preventDefault()}
    >
      {icon}
    </a>
  );
}

// Video card component
function VideoCard({
  video,
  children,
  isExpanded,
  onToggleExpand,
  onSelect,
  isSelected,
  editingId,
  editTitle,
  onStartEdit,
  onEditChange,
  onSaveTitle,
}: {
  video: Video;
  children?: Video[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSelect?: (id: number) => void;
  isSelected?: boolean;
  editingId?: number | null;
  editTitle?: string;
  onStartEdit?: (id: number, title: string) => void;
  onEditChange?: (value: string) => void;
  onSaveTitle?: (id: number) => void;
}) {
  const hasChildren = children && children.length > 0;
  const isClip = video.parent_video_id !== null;

  return (
    <div className={`rounded-xl overflow-hidden ${isClip ? 'ml-8' : ''}`}>
      <div className={`p-4 flex items-center gap-4 ${
        isSelected ? 'bg-[#843c2d]/20' : 'bg-[#1a1816] hover:bg-[#1f1c1a]'
      } transition-colors`}>
        {/* Selection checkbox */}
        {onSelect && (
          <button
            onClick={() => onSelect(video.id)}
            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-[#843c2d] border-[#843c2d] text-white'
                : 'border-[#502d26]/50 hover:border-[#843c2d]'
            }`}
          >
            {isSelected && Icons.check}
          </button>
        )}

        {/* Expand/collapse for parents */}
        {hasChildren ? (
          <button
            onClick={onToggleExpand}
            className="w-6 h-6 flex items-center justify-center text-[#726d6c] hover:text-[#ede8df] transition-colors"
          >
            {isExpanded ? Icons.expand : Icons.collapse}
          </button>
        ) : (
          <div className="w-6" />
        )}

        {/* Thumbnail */}
        <div className="w-16 h-10 rounded-lg overflow-hidden bg-[#0d0c0a] flex-shrink-0">
          {video.poster_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.poster_url}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#502d26]/50">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {editingId === video.id ? (
              <input
                type="text"
                value={editTitle || ''}
                onChange={(e) => onEditChange?.(e.target.value)}
                onBlur={() => onSaveTitle?.(video.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveTitle?.(video.id);
                  if (e.key === 'Escape') onSaveTitle?.(video.id);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent border-b border-[#843c2d] text-sm text-[#ede8df] outline-none w-full max-w-[200px]"
              />
            ) : (
              <h3
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit?.(video.id, video.title || '');
                }}
                className="text-sm font-medium text-[#ede8df] truncate cursor-pointer hover:text-[#b2a491] transition-colors"
                title="Click to edit title"
              >
                {video.title || 'Untitled'}
              </h3>
            )}
            {isClip && video.clip_index && video.total_siblings && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#502d26]/30 text-[#b2a491]">
                Clip {video.clip_index} of {video.total_siblings}
              </span>
            )}
          </div>
          {video.original_filename && (
            <p className="text-xs text-[#726d6c] truncate mt-0.5">
              {video.original_filename}
            </p>
          )}
        </div>

        {/* Platform statuses */}
        <div className="flex items-center gap-1">
          <PlatformStatus
            url={isClip ? video.youtube_shorts_url : video.youtube_url}
            status={video.postforme_status}
            icon={Icons.youtube}
            platform="YouTube"
          />
          <PlatformStatus
            url={video.tiktok_url}
            status={video.postforme_status}
            icon={Icons.tiktok}
            platform="TikTok"
          />
          <PlatformStatus
            url={video.instagram_reels_url}
            status={video.postforme_status}
            icon={Icons.instagram}
            platform="Instagram"
          />
        </div>
      </div>
    </div>
  );
}

// Library View
function LibraryView({
  videos,
  loading,
  onRefresh,
  selectedIds,
  onSelect,
}: {
  videos: Video[];
  loading: boolean;
  onRefresh: () => void;
  selectedIds: number[];
  onSelect: (id: number) => void;
}) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Inline title editing handlers
  const handleStartEdit = (id: number, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveTitle = async (videoId: number) => {
    if (editingId === null) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditingId(null);
      return;
    }

    try {
      await fetch('/api/arsenal/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, title: trimmedTitle }),
      });
      onRefresh(); // Refresh list to show updated title
    } catch (error) {
      console.error('Failed to update title:', error);
    }
    setEditingId(null);
  };

  // Organize videos into hierarchy
  const parentVideos = videos.filter(v => !v.parent_video_id);
  const childrenByParent = videos.reduce((acc, v) => {
    if (v.parent_video_id) {
      if (!acc[v.parent_video_id]) acc[v.parent_video_id] = [];
      acc[v.parent_video_id].push(v);
    }
    return acc;
  }, {} as Record<number, Video[]>);

  // Sort children by clip_index
  Object.values(childrenByParent).forEach(children => {
    children.sort((a, b) => (a.clip_index || 0) - (b.clip_index || 0));
  });

  // Apply filter
  const filteredVideos = parentVideos.filter(v => {
    if (filter === 'videos') return true;
    if (filter === 'deployed') return v.youtube_url || v.tiktok_url || v.instagram_reels_url;
    if (filter === 'not-deployed') return !v.youtube_url && !v.tiktok_url && !v.instagram_reels_url;
    return true;
  });

  const toggleExpand = (id: number) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['all', 'videos', 'clips', 'deployed', 'not-deployed'] as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                filter === f
                  ? 'bg-[#843c2d]/30 text-[#ede8df]'
                  : 'bg-white/5 text-[#726d6c] hover:bg-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-[#726d6c] hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Video list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-12 text-[#726d6c]">
            No videos found. Upload content to get started.
          </div>
        ) : (
          filteredVideos.map(video => (
            <div key={video.id}>
              <VideoCard
                video={video}
                children={childrenByParent[video.id]}
                isExpanded={expandedIds.includes(video.id)}
                onToggleExpand={() => toggleExpand(video.id)}
                onSelect={onSelect}
                isSelected={selectedIds.includes(video.id)}
                editingId={editingId}
                editTitle={editTitle}
                onStartEdit={handleStartEdit}
                onEditChange={setEditTitle}
                onSaveTitle={handleSaveTitle}
              />
              {/* Child clips */}
              {expandedIds.includes(video.id) && childrenByParent[video.id]?.map(child => (
                <VideoCard
                  key={child.id}
                  video={child}
                  onSelect={onSelect}
                  isSelected={selectedIds.includes(child.id)}
                  editingId={editingId}
                  editTitle={editTitle}
                  onStartEdit={handleStartEdit}
                  onEditChange={setEditTitle}
                  onSaveTitle={handleSaveTitle}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Generate hashtags from video metadata
function generateHashtags(video: Video): string[] {
  const tags: string[] = [];

  if (video.category) {
    tags.push(video.category.toLowerCase().replace(/\s+/g, ''));
  }
  if (video.mood) {
    tags.push(video.mood.toLowerCase().replace(/\s+/g, ''));
  }
  if (video.type) {
    tags.push(video.type.toLowerCase().replace(/\s+/g, ''));
  }
  if (video.artist_name) {
    tags.push(video.artist_name.toLowerCase().replace(/\s+/g, ''));
  }

  // Common music tags
  tags.push('music', 'newmusic');

  return [...new Set(tags)]; // Dedupe
}

// Deploy View
function DeployView({
  videos,
  selectedIds,
  onDeploy,
  deploying,
}: {
  videos: Video[];
  selectedIds: number[];
  onDeploy: (platforms: string[], scheduleAt?: string, metadata?: DeployMetadata, wodaGenerationId?: number | null) => void;
  deploying: boolean;
}) {
  const [platforms, setPlatforms] = useState<string[]>(['youtube', 'tiktok', 'instagram']);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Metadata state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');

  // Woda AI state
  const [wodaLoading, setWodaLoading] = useState(false);
  const [wodaGenerationId, setWodaGenerationId] = useState<number | null>(null);

  const selectedVideos = videos.filter(v => selectedIds.includes(v.id));
  const isClip = selectedVideos.some(v => v.parent_video_id !== null);

  // Ask Woda to generate metadata
  const askWoda = async () => {
    if (selectedVideos.length === 0) return;

    setWodaLoading(true);
    try {
      const firstVideo = selectedVideos[0];
      const videoIsClip = firstVideo.parent_video_id !== null;

      const res = await fetch('/api/arsenal/woda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: firstVideo.id,
          platforms,
          contentType: videoIsClip ? 'clip' : 'video',
        }),
      });

      if (res.ok) {
        const data = await res.json() as {
          title?: string;
          description?: string;
          hashtags?: string[];
          firstComment?: string;
          generationId?: number;
        };
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.hashtags) setHashtags(data.hashtags);
        if (data.firstComment) setFirstComment(data.firstComment);
        if (data.generationId) setWodaGenerationId(data.generationId);
      }
    } catch (error) {
      console.error('Woda generation failed:', error);
    } finally {
      setWodaLoading(false);
    }
  };

  // Pre-populate metadata when selection changes
  useEffect(() => {
    if (selectedVideos.length > 0) {
      const firstVideo = selectedVideos[0];

      // Use saved social metadata or fall back to video metadata
      setTitle(firstVideo.title || '');
      setDescription(firstVideo.social_description || firstVideo.description || '');
      setFirstComment(firstVideo.social_first_comment || '');
      setVisibility((firstVideo.social_visibility as 'public' | 'unlisted' | 'private') || 'public');

      // Parse saved hashtags or generate new ones
      if (firstVideo.social_hashtags) {
        try {
          setHashtags(JSON.parse(firstVideo.social_hashtags));
        } catch {
          setHashtags(generateHashtags(firstVideo));
        }
      } else {
        setHashtags(generateHashtags(firstVideo));
      }
    }
  }, [selectedIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlatform = (platform: string) => {
    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags(prev => [...prev, tag]);
      setHashtagInput('');
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(prev => prev.filter(t => t !== tag));
  };

  const handleDeploy = () => {
    const scheduleAt = scheduleDate && scheduleTime
      ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
      : undefined;

    const metadata: DeployMetadata = {
      title,
      description,
      firstComment,
      hashtags,
      visibility,
    };

    onDeploy(platforms, scheduleAt, metadata, wodaGenerationId);
  };

  return (
    <div className="space-y-6">
      {/* Selected content */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">
          Selected Content ({selectedVideos.length})
          {isClip && <span className="text-[#726d6c] ml-2">(Clips)</span>}
        </h3>
        {selectedVideos.length === 0 ? (
          <div className="p-4 rounded-xl bg-white/5 text-center text-[#726d6c] text-sm">
            Select content from the Library to deploy
          </div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {selectedVideos.map(v => (
              <div key={v.id} className="p-3 rounded-lg bg-white/5 flex items-center gap-3">
                <div className="w-10 h-6 rounded bg-[#0d0c0a] overflow-hidden">
                  {v.poster_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.poster_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="text-sm text-[#ede8df] truncate flex-1">{v.title}</span>
                {v.clip_index && (
                  <span className="text-xs text-[#726d6c]">Clip {v.clip_index}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Platform selection */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Deploy to Platforms</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { id: 'youtube', name: 'YouTube', icon: Icons.youtube },
            { id: 'tiktok', name: 'TikTok', icon: Icons.tiktok },
            { id: 'instagram', name: 'Instagram', icon: Icons.instagram },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                platforms.includes(p.id)
                  ? 'bg-[#843c2d]/30 text-[#ede8df] border border-[#843c2d]/50'
                  : 'bg-white/5 text-[#726d6c] border border-transparent hover:bg-white/10'
              }`}
            >
              {p.icon}
              <span className="text-sm">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Metadata Section */}
      {selectedVideos.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#ede8df]">Post Details</h3>
            <button
              onClick={askWoda}
              disabled={wodaLoading || selectedVideos.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-[#502d26] to-[#843c2d] text-[#ede8df] hover:opacity-90 transition-all disabled:opacity-50"
            >
              {wodaLoading ? (
                <>
                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-4 9a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"/>
                  </svg>
                  Ask Woda
                </>
              )}
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-[#726d6c] mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-[#726d6c] mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers about your video..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 resize-none"
            />
          </div>

          {/* First Comment */}
          <div>
            <label className="text-xs text-[#726d6c] mb-1 block">First Comment (links, credits)</label>
            <textarea
              value={firstComment}
              onChange={(e) => setFirstComment(e.target.value)}
              placeholder="🛒 Shop: https://odubo.studio/store&#10;🎵 Stream: https://..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 resize-none"
            />
          </div>

          {/* Hashtags (for clips/shorts) */}
          {isClip && (
            <div>
              <label className="text-xs text-[#726d6c] mb-1 block">Hashtags (Shorts/Reels/TikTok)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {hashtags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs rounded-lg bg-[#843c2d]/20 text-[#ede8df] flex items-center gap-1"
                  >
                    #{tag}
                    <button
                      onClick={() => removeHashtag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
                  placeholder="Add hashtag..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
                />
                <button
                  onClick={addHashtag}
                  className="px-3 py-2 rounded-xl bg-white/5 text-[#726d6c] hover:bg-white/10 transition-colors text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Visibility (YouTube) */}
          {!isClip && platforms.includes('youtube') && (
            <div>
              <label className="text-xs text-[#726d6c] mb-2 block">Visibility (YouTube)</label>
              <div className="flex gap-3">
                {(['public', 'unlisted', 'private'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      visibility === v
                        ? 'bg-[#843c2d]/30 text-[#ede8df]'
                        : 'bg-white/5 text-[#726d6c] hover:bg-white/10'
                    }`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Schedule (Optional)</h3>
        <div className="flex gap-3">
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
          />
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
          />
        </div>
        <p className="text-xs text-[#726d6c] mt-2">
          Leave empty to queue for immediate posting via Post for Me
        </p>
      </div>

      {/* Deploy button */}
      <button
        onClick={handleDeploy}
        disabled={selectedVideos.length === 0 || platforms.length === 0 || deploying}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      >
        {deploying ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Deploying...
          </span>
        ) : (
          `Load Magazine (${selectedVideos.length} items)`
        )}
      </button>
    </div>
  );
}

// Sync View
function SyncView({
  onSync,
  syncing,
  lastSyncTime,
  syncLog,
}: {
  onSync: () => void;
  syncing: boolean;
  lastSyncTime: string | null;
  syncLog: string[];
}) {
  return (
    <div className="space-y-6">
      {/* Sync status */}
      <div className="p-4 rounded-xl bg-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#ede8df]">Auto-Backfeed URLs</h3>
          <button
            onClick={onSync}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium transition-all disabled:opacity-50 hover:bg-[#6d3224]"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
        <p className="text-xs text-[#726d6c]">
          Fetches platform URLs from Post for Me for published content.
          {lastSyncTime && (
            <span className="block mt-1">
              Last sync: {new Date(lastSyncTime).toLocaleString()}
            </span>
          )}
        </p>
      </div>

      {/* Sync log */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Sync Log</h3>
        <div className="p-4 rounded-xl bg-[#0d0c0a] font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
          {syncLog.length === 0 ? (
            <span className="text-[#726d6c]">No sync activity yet</span>
          ) : (
            syncLog.map((log, i) => (
              <div key={i} className={`${
                log.includes('ERROR') ? 'text-red-400' :
                log.includes('SUCCESS') ? 'text-green-400' :
                'text-[#b2a491]'
              }`}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual URL entry */}
      <div className="p-4 rounded-xl bg-white/5">
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Manual URL Entry</h3>
        <p className="text-xs text-[#726d6c] mb-3">
          For edge cases where auto-sync doesn&apos;t capture the URL
        </p>
        <div className="text-center text-sm text-[#726d6c] py-4">
          Coming soon - edit URLs directly from Library view
        </div>
      </div>
    </div>
  );
}

// Main Arsenal Tab
export default function ArsenalTab() {
  const [view, setView] = useState<ViewMode>('library');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<string[]>([]);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/arsenal/videos');
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json() as { videos: Video[] };
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Toggle selection
  const handleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Deploy
  const handleDeploy = async (platforms: string[], scheduleAt?: string, metadata?: DeployMetadata, wodaGenerationId?: number | null) => {
    setDeploying(true);
    try {
      const res = await fetch('/api/arsenal/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIds: selectedIds,
          platforms,
          scheduleAt,
          metadata,
          wodaGenerationId,
        }),
      });

      if (!res.ok) throw new Error('Deploy failed');

      // Clear selection and refresh
      setSelectedIds([]);
      fetchVideos();
      setView('library');
    } catch (error) {
      console.error('Deploy error:', error);
    } finally {
      setDeploying(false);
    }
  };

  // Sync
  const handleSync = async () => {
    setSyncing(true);
    setSyncLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Starting sync...`]);

    try {
      const res = await fetch('/api/arsenal/sync', {
        method: 'POST',
      });

      const data = await res.json() as { updated: number; errors: string[] };

      setSyncLog(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Updated ${data.updated} videos`,
        ...(data.errors || []).map((e: string) => `[${new Date().toLocaleTimeString()}] ERROR: ${e}`),
      ]);
      setLastSyncTime(new Date().toISOString());
      fetchVideos();
    } catch (error) {
      setSyncLog(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ]);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#ede8df]">Content Arsenal</h1>
        <p className="text-sm text-[#726d6c] mt-1">
          Magazine & Bullets - Your digital kingdom command center
        </p>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { id: 'library' as ViewMode, label: 'Library', icon: Icons.library },
          { id: 'deploy' as ViewMode, label: 'Deploy', icon: Icons.deploy },
          { id: 'sync' as ViewMode, label: 'Sync', icon: Icons.sync },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              view === tab.id
                ? 'bg-[#843c2d]/20 text-[#ede8df]'
                : 'bg-white/5 text-[#726d6c] hover:bg-white/10'
            }`}
          >
            {tab.icon}
            <span className="text-sm font-medium">{tab.label}</span>
            {tab.id === 'deploy' && selectedIds.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#843c2d] text-white">
                {selectedIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-[#1a1816] rounded-2xl p-6 border border-white/5">
        {view === 'library' && (
          <LibraryView
            videos={videos}
            loading={loading}
            onRefresh={fetchVideos}
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        )}
        {view === 'deploy' && (
          <DeployView
            videos={videos}
            selectedIds={selectedIds}
            onDeploy={handleDeploy}
            deploying={deploying}
          />
        )}
        {view === 'sync' && (
          <SyncView
            onSync={handleSync}
            syncing={syncing}
            lastSyncTime={lastSyncTime}
            syncLog={syncLog}
          />
        )}
      </div>
    </div>
  );
}
