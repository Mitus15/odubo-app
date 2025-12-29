'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  type VideoRelease,
  type VideoType,
  type VideoReleaseStatus,
  type VideoPlatform,
  type ContentIdPolicy,
  VIDEO_TYPES,
  VIDEO_PLATFORMS,
  GENRES,
  YOUTUBE_CATEGORIES,
} from '@/lib/distributors/types';

type ViewMode = 'list' | 'create' | 'edit' | 'import';

// Hub video type for import
interface HubVideo {
  id: number;
  uid: string;
  title: string;
  artistName: string;
  description: string;
  thumbnailUrl: string;
  duration: string;
  category: string;
  type: string;
  status: string;
  createdAt: string;
}

// Status badge colors
const STATUS_COLORS: Record<VideoReleaseStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-zinc-800', text: 'text-zinc-400' },
  ready: { bg: 'bg-blue-900/30', text: 'text-blue-400' },
  scheduled: { bg: 'bg-purple-900/30', text: 'text-purple-400' },
  uploading: { bg: 'bg-yellow-900/30', text: 'text-yellow-400' },
  processing: { bg: 'bg-orange-900/30', text: 'text-orange-400' },
  live: { bg: 'bg-green-900/30', text: 'text-green-400' },
  unlisted: { bg: 'bg-gray-900/30', text: 'text-gray-400' },
  private: { bg: 'bg-zinc-900', text: 'text-zinc-500' },
  removed: { bg: 'bg-red-900/30', text: 'text-red-400' },
};

const STATUS_LABELS: Record<VideoReleaseStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  uploading: 'Uploading',
  processing: 'Processing',
  live: 'Live',
  unlisted: 'Unlisted',
  private: 'Private',
  removed: 'Removed',
};

export function VideoDistributionPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [releases, setReleases] = useState<VideoRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRelease, setSelectedRelease] = useState<VideoRelease | null>(null);
  const [statusFilter, setStatusFilter] = useState<VideoReleaseStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<VideoType | 'all'>('all');

  // Load releases
  const loadReleases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('videoType', typeFilter);

      const res = await fetch(`/api/command-center/video-releases?${params}`);
      if (res.ok) {
        const data = (await res.json()) as { releases?: VideoRelease[] };
        setReleases(data.releases || []);
      }
    } catch (e) {
      console.error('Failed to load video releases:', e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    loadReleases();
  }, [loadReleases]);

  const handleCreateNew = () => {
    setSelectedRelease(null);
    setViewMode('create');
  };

  const handleImportFromHub = () => {
    setViewMode('import');
  };

  const handleEditRelease = async (release: VideoRelease) => {
    // Fetch full release with assets and platforms
    try {
      const res = await fetch(`/api/command-center/video-releases/${release.id}`);
      if (res.ok) {
        const data = (await res.json()) as { release?: VideoRelease };
        setSelectedRelease(data.release || null);
        setViewMode('edit');
      }
    } catch (e) {
      console.error('Failed to load release details:', e);
    }
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedRelease(null);
  };

  const handleSaveRelease = async (data: Partial<VideoRelease>) => {
    try {
      const method = selectedRelease ? 'PATCH' : 'POST';
      const url = selectedRelease
        ? `/api/command-center/video-releases/${selectedRelease.id}`
        : '/api/command-center/video-releases';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await loadReleases();
        setViewMode('list');
        setSelectedRelease(null);
      }
    } catch (e) {
      console.error('Failed to save video release:', e);
    }
  };

  const handleDeleteRelease = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video release?')) return;

    try {
      const res = await fetch(`/api/command-center/video-releases/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadReleases();
      }
    } catch (e) {
      console.error('Failed to delete video release:', e);
    }
  };

  // List View
  if (viewMode === 'list') {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VideoReleaseStatus | 'all')}
              className="px-3 py-1.5 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-xs focus:outline-none"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as VideoType | 'all')}
              className="px-3 py-1.5 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-xs focus:outline-none"
            >
              <option value="all">All Types</option>
              {VIDEO_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-[#726d6c]">
              {releases.length} video{releases.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportFromHub}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#502d26]/40 text-sm font-medium hover:bg-[#302927] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Import from Hub
            </button>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Video
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : releases.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎬</div>
              <h3 className="font-semibold mb-2">No video releases yet</h3>
              <p className="text-sm text-[#726d6c] mb-4">
                Create your first music video for YouTube and Vevo distribution
              </p>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] transition-colors"
              >
                Create Video Release
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {releases.map((release) => (
                <VideoReleaseCard
                  key={release.id}
                  release={release}
                  onEdit={() => handleEditRelease(release)}
                  onDelete={() => handleDeleteRelease(release.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Import View
  if (viewMode === 'import') {
    return (
      <HubVideoImporter
        onImport={async (hubVideo, videoType) => {
          // Create a new video release from hub video
          try {
            const res = await fetch('/api/command-center/video-releases', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: hubVideo.title,
                artistName: hubVideo.artistName || 'Artist',
                videoType,
                description: hubVideo.description,
                internalVideoId: String(hubVideo.id),
              }),
            });

            if (res.ok) {
              const data = (await res.json()) as { id: string };

              // Create a video asset with the Cloudflare Stream UID
              await fetch(`/api/command-center/video-releases/${data.id}/assets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  label: 'Master',
                  versionType: 'master',
                  cloudflareUid: hubVideo.uid,
                  isPrimary: true,
                }),
              });

              await loadReleases();
              setViewMode('list');
            }
          } catch (e) {
            console.error('Failed to import video:', e);
          }
        }}
        onBack={handleBack}
      />
    );
  }

  // Create/Edit View
  return (
    <VideoReleaseEditor
      release={selectedRelease}
      onSave={handleSaveRelease}
      onBack={handleBack}
    />
  );
}

// =============================================================================
// Video Release Card
// =============================================================================

function VideoReleaseCard({
  release,
  onEdit,
  onDelete,
}: {
  release: VideoRelease;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusStyle = STATUS_COLORS[release.status] || STATUS_COLORS.draft;
  const videoType = VIDEO_TYPES.find((t) => t.id === release.videoType);

  return (
    <div
      className="group bg-[#171616] rounded-xl border border-[#502d26]/20 overflow-hidden hover:border-[#502d26]/40 transition-colors cursor-pointer"
      onClick={onEdit}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-[#0d0c0a] relative">
        {release.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={release.thumbnailUrl}
            alt={release.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-[#502d26]">
            🎬
          </div>
        )}
        {/* Video type badge */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/70 text-[10px] font-medium">
          {videoType?.name || release.videoType}
        </div>
        {/* Status badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          {STATUS_LABELS[release.status]}
        </div>
        {/* Premiere badge */}
        {release.premiereEnabled && release.premiereDate && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-purple-900/80 text-purple-200 text-[10px] font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Premiere
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{release.title}</h3>
        <p className="text-xs text-[#726d6c] truncate">{release.artistName}</p>

        {/* Platform indicators */}
        {release.platforms && release.platforms.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {release.platforms
              .filter((p) => p.enabled)
              .slice(0, 4)
              .map((p) => {
                const platform = VIDEO_PLATFORMS.find((vp) => vp.id === p.platform);
                return (
                  <span
                    key={p.id}
                    className="text-xs"
                    title={platform?.name}
                  >
                    {platform?.icon}
                  </span>
                );
              })}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#502d26]/20">
          <span className="text-[10px] text-[#502d26]">
            {new Date(release.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 rounded-lg hover:bg-[#302927] transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
            {release.status === 'draft' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-lg hover:bg-red-900/30 text-red-400 transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Video Release Editor
// =============================================================================

function VideoReleaseEditor({
  release,
  onSave,
  onBack,
}: {
  release: VideoRelease | null;
  onSave: (data: Partial<VideoRelease>) => void;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'platforms' | 'premiere'>('details');
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState(release?.title || '');
  const [artistName, setArtistName] = useState(release?.artistName || '');
  const [videoType, setVideoType] = useState<VideoType>(release?.videoType || 'music_video');
  const [description, setDescription] = useState(release?.description || '');
  const [genre, setGenre] = useState(release?.genre || '');
  const [tags, setTags] = useState<string[]>(release?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [language, setLanguage] = useState(release?.language || 'en');
  const [madeForKids, setMadeForKids] = useState(release?.madeForKids || false);
  const [ageRestricted, setAgeRestricted] = useState(release?.ageRestricted || false);

  // Credits
  const [director, setDirector] = useState(release?.director || '');
  const [producer, setProducer] = useState(release?.producer || '');

  // Premiere
  const [premiereEnabled, setPremiereEnabled] = useState(release?.premiereEnabled || false);
  const [premiereDate, setPremiereDate] = useState(release?.premiereDate || '');

  // Content ID
  const [contentIdEnabled, setContentIdEnabled] = useState(release?.contentIdEnabled ?? true);
  const [contentIdPolicy, setContentIdPolicy] = useState<ContentIdPolicy>(
    release?.contentIdPolicy || 'monetize'
  );

  // Platform selection
  const [enabledPlatforms, setEnabledPlatforms] = useState<VideoPlatform[]>(
    release?.platforms?.filter((p) => p.enabled).map((p) => p.platform) || ['youtube']
  );

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const togglePlatform = (platform: VideoPlatform) => {
    setEnabledPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSave = async () => {
    if (!title.trim() || !artistName.trim()) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        artistName: artistName.trim(),
        videoType,
        description: description.trim() || undefined,
        genre: genre || undefined,
        tags,
        language,
        madeForKids,
        ageRestricted,
        director: director.trim() || undefined,
        producer: producer.trim() || undefined,
        premiereEnabled,
        premiereDate: premiereEnabled ? premiereDate : undefined,
        contentIdEnabled,
        contentIdPolicy,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-[#302927] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-semibold">
            {release ? 'Edit Video Release' : 'New Video Release'}
          </h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim() || !artistName.trim()}
          className="px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4">
        <div className="flex gap-4">
          {(['details', 'platforms', 'premiere'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-[#843c2d] text-[#ede8df]'
                  : 'border-transparent text-[#726d6c] hover:text-[#ede8df]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <div className="max-w-2xl space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">
                Basic Information
              </h3>

              <div>
                <label className="block text-xs text-[#726d6c] mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                  placeholder="Video title"
                />
              </div>

              <div>
                <label className="block text-xs text-[#726d6c] mb-1">Artist *</label>
                <input
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                  placeholder="Artist name"
                />
              </div>

              <div>
                <label className="block text-xs text-[#726d6c] mb-1">Video Type</label>
                <select
                  value={videoType}
                  onChange={(e) => setVideoType(e.target.value as VideoType)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                >
                  {VIDEO_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#726d6c] mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d] resize-none"
                  placeholder="Video description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#726d6c] mb-1">Genre</label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                  >
                    <option value="">Select genre</option>
                    {GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#726d6c] mb-1">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="pt">Portuguese</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs text-[#726d6c] mb-1">Tags</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-lg bg-[#302927] text-xs flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-[#726d6c] hover:text-[#ede8df]"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                    placeholder="Add tag..."
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-2 rounded-lg bg-[#302927] text-sm hover:bg-[#3a3533] transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Credits */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">
                Credits
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#726d6c] mb-1">Director</label>
                  <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                    placeholder="Director name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#726d6c] mb-1">Producer</label>
                  <input
                    type="text"
                    value={producer}
                    onChange={(e) => setProducer(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                    placeholder="Producer name"
                  />
                </div>
              </div>
            </div>

            {/* Audience */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">
                Audience
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={madeForKids}
                    onChange={(e) => setMadeForKids(e.target.checked)}
                    className="w-4 h-4 rounded border-[#502d26]/40 bg-[#0d0c0a] text-[#843c2d] focus:ring-[#843c2d]"
                  />
                  <span className="text-sm">Made for kids</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ageRestricted}
                    onChange={(e) => setAgeRestricted(e.target.checked)}
                    className="w-4 h-4 rounded border-[#502d26]/40 bg-[#0d0c0a] text-[#843c2d] focus:ring-[#843c2d]"
                  />
                  <span className="text-sm">Age-restricted (18+)</span>
                </label>
              </div>
            </div>

            {/* Content ID */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">
                Content ID
              </h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contentIdEnabled}
                  onChange={(e) => setContentIdEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-[#502d26]/40 bg-[#0d0c0a] text-[#843c2d] focus:ring-[#843c2d]"
                />
                <span className="text-sm">Enable Content ID</span>
              </label>
              {contentIdEnabled && (
                <div>
                  <label className="block text-xs text-[#726d6c] mb-1">Policy</label>
                  <select
                    value={contentIdPolicy}
                    onChange={(e) => setContentIdPolicy(e.target.value as ContentIdPolicy)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                  >
                    <option value="monetize">Monetize - Run ads on matching videos</option>
                    <option value="track">Track - Monitor usage only</option>
                    <option value="block">Block - Remove matching videos</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'platforms' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">
              Distribution Platforms
            </h3>
            <p className="text-sm text-[#726d6c]">
              Select which platforms to distribute your video to
            </p>

            <div className="grid grid-cols-2 gap-3">
              {VIDEO_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                    enabledPlatforms.includes(platform.id)
                      ? 'border-[#843c2d] bg-[#843c2d]/10'
                      : 'border-[#502d26]/40 hover:border-[#502d26]/60'
                  }`}
                >
                  <span className="text-2xl">{platform.icon}</span>
                  <div className="text-left">
                    <div className="font-medium text-sm">{platform.name}</div>
                    <div className="text-[10px] text-[#726d6c]">
                      {enabledPlatforms.includes(platform.id) ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  {enabledPlatforms.includes(platform.id) && (
                    <svg className="w-5 h-5 ml-auto text-[#843c2d]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {enabledPlatforms.includes('youtube') && (
              <div className="p-4 rounded-xl bg-[#171616] border border-[#502d26]/20 space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span>▶️</span> YouTube Settings
                </h4>
                <div>
                  <label className="block text-xs text-[#726d6c] mb-1">Category</label>
                  <select className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]">
                    {YOUTUBE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'premiere' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">
              Premiere Settings
            </h3>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={premiereEnabled}
                onChange={(e) => setPremiereEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-[#502d26]/40 bg-[#0d0c0a] text-[#843c2d] focus:ring-[#843c2d]"
              />
              <div>
                <span className="text-sm font-medium">Enable Premiere</span>
                <p className="text-xs text-[#726d6c]">
                  Schedule a premiere with countdown and live chat
                </p>
              </div>
            </label>

            {premiereEnabled && (
              <div className="space-y-4 pl-7">
                <div>
                  <label className="block text-xs text-[#726d6c] mb-1">Premiere Date & Time</label>
                  <input
                    type="datetime-local"
                    value={premiereDate}
                    onChange={(e) => setPremiereDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#171616] border border-[#502d26]/20">
                  <h4 className="font-medium text-sm mb-2">Premiere Features</h4>
                  <ul className="text-xs text-[#726d6c] space-y-1">
                    <li>• Countdown timer before video starts</li>
                    <li>• Live chat during premiere</li>
                    <li>• Viewers can set reminders</li>
                    <li>• Watch together experience</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Hub Video Importer
// =============================================================================

function HubVideoImporter({
  onImport,
  onBack,
}: {
  onImport: (video: HubVideo, videoType: VideoType) => void;
  onBack: () => void;
}) {
  const [hubVideos, setHubVideos] = useState<HubVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<HubVideo | null>(null);
  const [selectedType, setSelectedType] = useState<VideoType>('music_video');
  const [importing, setImporting] = useState(false);

  // Load hub videos
  useEffect(() => {
    const loadHubVideos = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          excludeImported: 'true',
        });
        if (search) params.set('search', search);

        const res = await fetch(`/api/command-center/hub-videos?${params}`);
        if (res.ok) {
          const data = (await res.json()) as { videos?: HubVideo[] };
          setHubVideos(data.videos || []);
        }
      } catch (e) {
        console.error('Failed to load hub videos:', e);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(loadHubVideos, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleImport = async () => {
    if (!selectedVideo) return;
    setImporting(true);
    try {
      await onImport(selectedVideo, selectedType);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-[#302927] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-semibold">Import from Cloudflare Stream</h2>
        </div>
        {selectedVideo && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] disabled:opacity-50 transition-colors"
          >
            {importing ? 'Importing...' : 'Import Selected'}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search videos..."
          className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
        />
      </div>

      {/* Video Type Selection (shows when video selected) */}
      {selectedVideo && (
        <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-3">
          <label className="block text-xs text-[#726d6c] mb-2">Video Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as VideoType)}
            className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
          >
            {VIDEO_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} - {type.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hubVideos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📹</div>
            <h3 className="font-semibold mb-2">No videos available</h3>
            <p className="text-sm text-[#726d6c]">
              {search
                ? 'No videos match your search'
                : 'All your Cloudflare Stream videos have been imported'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {hubVideos.map((video) => (
              <button
                key={video.id}
                onClick={() =>
                  setSelectedVideo(selectedVideo?.id === video.id ? null : video)
                }
                className={`group relative rounded-xl overflow-hidden border-2 transition-all ${
                  selectedVideo?.id === video.id
                    ? 'border-[#843c2d] ring-2 ring-[#843c2d]/30'
                    : 'border-transparent hover:border-[#502d26]/40'
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-[#0d0c0a] relative">
                  {video.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-[#502d26]">
                      🎬
                    </div>
                  )}

                  {/* Selected overlay */}
                  {selectedVideo?.id === video.id && (
                    <div className="absolute inset-0 bg-[#843c2d]/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-[#843c2d] flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Duration badge */}
                  {video.duration && (
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px]">
                      {video.duration}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2 bg-[#171616]">
                  <h4 className="font-medium text-xs truncate">{video.title}</h4>
                  {video.artistName && (
                    <p className="text-[10px] text-[#726d6c] truncate">
                      {video.artistName}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
