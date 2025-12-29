'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  type Release,
  type ReleaseType,
  type ReleaseStatus,
  GENRES,
  DSPS,
} from '@/lib/distributors/types';

type ViewMode = 'list' | 'create' | 'edit';

// Status badge colors
const STATUS_COLORS: Record<ReleaseStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-zinc-800', text: 'text-zinc-400' },
  pending_review: { bg: 'bg-yellow-900/30', text: 'text-yellow-400' },
  ready: { bg: 'bg-blue-900/30', text: 'text-blue-400' },
  submitted: { bg: 'bg-purple-900/30', text: 'text-purple-400' },
  processing: { bg: 'bg-orange-900/30', text: 'text-orange-400' },
  live: { bg: 'bg-green-900/30', text: 'text-green-400' },
  takedown: { bg: 'bg-red-900/30', text: 'text-red-400' },
  removed: { bg: 'bg-zinc-900', text: 'text-zinc-500' },
};

const STATUS_LABELS: Record<ReleaseStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  ready: 'Ready',
  submitted: 'Submitted',
  processing: 'Processing',
  live: 'Live',
  takedown: 'Takedown Requested',
  removed: 'Removed',
};

export function MusicDistributionPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus | 'all'>('all');

  // Load releases
  const loadReleases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/command-center/releases');
      if (res.ok) {
        const data = await res.json();
        setReleases(data.releases || []);
      }
    } catch (e) {
      console.error('Failed to load releases:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReleases();
  }, [loadReleases]);

  const filteredReleases = releases.filter(
    (r) => statusFilter === 'all' || r.status === statusFilter
  );

  const handleCreateNew = () => {
    setSelectedRelease(null);
    setViewMode('create');
  };

  const handleEditRelease = (release: Release) => {
    setSelectedRelease(release);
    setViewMode('edit');
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedRelease(null);
  };

  const handleSaveRelease = async (data: Partial<Release>) => {
    try {
      const method = selectedRelease ? 'PATCH' : 'POST';
      const url = selectedRelease
        ? `/api/command-center/releases/${selectedRelease.id}`
        : '/api/command-center/releases';

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
      console.error('Failed to save release:', e);
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
              onChange={(e) => setStatusFilter(e.target.value as ReleaseStatus | 'all')}
              className="px-3 py-1.5 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-xs focus:outline-none"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[#726d6c]">
              {filteredReleases.length} release{filteredReleases.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Release
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredReleases.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎵</div>
              <h3 className="font-semibold mb-2">
                {statusFilter === 'all' ? 'No releases yet' : `No ${STATUS_LABELS[statusFilter]} releases`}
              </h3>
              <p className="text-sm text-[#726d6c] mb-4">
                Create your first release to distribute to streaming platforms
              </p>
              {statusFilter === 'all' && (
                <button
                  onClick={handleCreateNew}
                  className="px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] transition-colors"
                >
                  Create Release
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReleases.map((release) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  onClick={() => handleEditRelease(release)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Create/Edit View
  return (
    <ReleaseEditor
      release={selectedRelease}
      onBack={handleBack}
      onSave={handleSaveRelease}
    />
  );
}

// ============================================================================
// RELEASE CARD
// ============================================================================

function ReleaseCard({ release, onClick }: { release: Release; onClick: () => void }) {
  const statusColor = STATUS_COLORS[release.status];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20 hover:border-[#502d26]/40 transition-colors text-left"
    >
      {/* Cover Art */}
      <div className="w-14 h-14 rounded-lg bg-[#302927] overflow-hidden flex-shrink-0">
        {release.coverArtUrl ? (
          <img src={release.coverArtUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">💿</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium truncate">{release.title}</h4>
          <span className="text-xs text-[#726d6c] capitalize px-1.5 py-0.5 rounded bg-[#302927]">
            {release.releaseType}
          </span>
        </div>
        <p className="text-sm text-[#726d6c] truncate">{release.artistName}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
            {STATUS_LABELS[release.status]}
          </span>
          {release.distributionReleaseDate && (
            <span className="text-[10px] text-[#726d6c]">
              {new Date(release.distributionReleaseDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <svg className="w-5 h-5 text-[#726d6c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ============================================================================
// RELEASE EDITOR
// ============================================================================

function ReleaseEditor({
  release,
  onBack,
  onSave,
}: {
  release: Release | null;
  onBack: () => void;
  onSave: (data: Partial<Release>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'tracks' | 'distribution'>('details');

  // Form state
  const [title, setTitle] = useState(release?.title || '');
  const [releaseType, setReleaseType] = useState<ReleaseType>(release?.releaseType || 'single');
  const [artistName, setArtistName] = useState(release?.artistName || '');
  const [labelName, setLabelName] = useState(release?.labelName || '');
  const [genre, setGenre] = useState(release?.genre || '');
  const [releaseDate, setReleaseDate] = useState(release?.distributionReleaseDate || '');
  const [coverArtUrl, setCoverArtUrl] = useState(release?.coverArtUrl || '');
  const [explicit, setExplicit] = useState(release?.explicitContent || false);
  const [upc, setUpc] = useState(release?.upc || '');
  const [copyrightLine, setCopyrightLine] = useState(release?.copyrightLine || '');
  const [phonographicLine, setPhonographicLine] = useState(release?.phonographicLine || '');

  const handleSubmit = async () => {
    if (!title || !artistName) return;

    setSaving(true);
    try {
      await onSave({
        title,
        releaseType,
        artistName,
        labelName: labelName || undefined,
        genre: genre || undefined,
        distributionReleaseDate: releaseDate || undefined,
        coverArtUrl: coverArtUrl || undefined,
        explicitContent: explicit,
        upc: upc || undefined,
        copyrightLine: copyrightLine || undefined,
        phonographicLine: phonographicLine || undefined,
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
            className="p-1.5 rounded-lg hover:bg-[#302927] text-[#726d6c] hover:text-[#ede8df] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h3 className="font-semibold">{release ? 'Edit Release' : 'New Release'}</h3>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || !title || !artistName}
          className="px-4 py-2 rounded-xl bg-[#ede8df] text-[#171616] text-sm font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4">
        <div className="flex gap-4">
          {(['details', 'tracks', 'distribution'] as const).map((tab) => (
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
            {/* Cover Art */}
            <div className="flex items-start gap-4">
              <div className="w-32 h-32 rounded-xl bg-[#302927] overflow-hidden flex-shrink-0">
                {coverArtUrl ? (
                  <img src={coverArtUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#726d6c]">
                    <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span className="text-[10px]">Cover Art</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[#726d6c] mb-1.5">Cover Art URL</label>
                <input
                  type="url"
                  value={coverArtUrl}
                  onChange={(e) => setCoverArtUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                />
                <p className="text-[10px] text-[#726d6c] mt-1">
                  3000x3000px recommended, JPEG or PNG
                </p>
              </div>
            </div>

            {/* Title & Type */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-[#726d6c] mb-1.5">Release Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My New Album"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#726d6c] mb-1.5">Type *</label>
                <select
                  value={releaseType}
                  onChange={(e) => setReleaseType(e.target.value as ReleaseType)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                >
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                  <option value="compilation">Compilation</option>
                </select>
              </div>
            </div>

            {/* Artist & Label */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#726d6c] mb-1.5">Artist Name *</label>
                <input
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Artist Name"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#726d6c] mb-1.5">Label Name</label>
                <input
                  type="text"
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  placeholder="Label Name (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                />
              </div>
            </div>

            {/* Genre & Release Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#726d6c] mb-1.5">Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                >
                  <option value="">Select genre...</option>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#726d6c] mb-1.5">Release Date</label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                />
              </div>
            </div>

            {/* UPC */}
            <div>
              <label className="block text-xs text-[#726d6c] mb-1.5">UPC / Barcode</label>
              <input
                type="text"
                value={upc}
                onChange={(e) => setUpc(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
              />
            </div>

            {/* Copyright */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#726d6c] mb-1.5">Copyright Line (C)</label>
                <input
                  type="text"
                  value={copyrightLine}
                  onChange={(e) => setCopyrightLine(e.target.value)}
                  placeholder="2024 Artist Name"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#726d6c] mb-1.5">Phonographic Line (P)</label>
                <input
                  type="text"
                  value={phonographicLine}
                  onChange={(e) => setPhonographicLine(e.target.value)}
                  placeholder="2024 Label Name"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                />
              </div>
            </div>

            {/* Explicit */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExplicit(!explicit)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  explicit ? 'bg-[#843c2d]' : 'bg-[#302927]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                    explicit ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm">Contains explicit content</span>
            </div>
          </div>
        )}

        {activeTab === 'tracks' && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🎵</div>
            <h3 className="font-semibold mb-2">Track Management</h3>
            <p className="text-sm text-[#726d6c]">
              Save the release details first, then add tracks
            </p>
            {release && (
              <p className="text-xs text-[#502d26] mt-4">
                Track editor will be implemented in the next iteration
              </p>
            )}
          </div>
        )}

        {activeTab === 'distribution' && (
          <div className="max-w-2xl">
            <h4 className="font-medium mb-4">Target Platforms</h4>
            <div className="grid grid-cols-2 gap-2">
              {DSPS.map((dsp) => (
                <div
                  key={dsp.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0c0a] border border-[#502d26]/20"
                >
                  <span className="text-lg">{dsp.icon}</span>
                  <span className="text-sm flex-1">{dsp.name}</span>
                  <div className="w-4 h-4 rounded border border-[#843c2d] bg-[#843c2d]/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-[#843c2d]" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#726d6c] mt-4">
              All platforms are enabled by default. Customize after saving.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
