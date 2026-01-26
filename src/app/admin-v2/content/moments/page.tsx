'use client';

/**
 * The Hub - Moments/Galleries Manager
 * Multi-purpose galleries with photo/video collection
 * Supports: events, collections, lookbooks, showcases, bts, campaigns, archives
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';
import { ShareButton } from '@/components/admin/ShareButton';

// =============================================================================
// TYPES
// =============================================================================

type GalleryType = 'event' | 'collection' | 'lookbook' | 'showcase' | 'bts' | 'campaign' | 'archive';
type UploadMode = 'public' | 'admin';
type LinkType = 'product' | 'video' | 'clip' | 'track' | 'album' | 'event' | 'gallery';

interface GalleryConfig {
  featured?: boolean;
  persistent?: boolean;
  capacity?: number;
  ticket_price?: number;
  is_public?: boolean;
}

interface GalleryLink {
  id?: number;
  link_type: LinkType;
  link_id: string;
  link_handle?: string;
  is_primary?: boolean;
  display_label?: string;
  sort_order?: number;
}

interface GalleryRow {
  id: number;
  code: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  config: GalleryConfig;
  photo_count?: number;
  video_count?: number;
  gallery_type?: GalleryType;
  upload_mode?: UploadMode;
  cover_photo_key?: string | null;
  sort_order?: number;
  links?: GalleryLink[];
}

// Gallery type metadata
const GALLERY_TYPES: { type: GalleryType; label: string; description: string; icon: string }[] = [
  { type: 'event', label: 'Event', description: 'Concerts, meetups, live shows', icon: '🎪' },
  { type: 'collection', label: 'Collection', description: 'Curated photo sets', icon: '📸' },
  { type: 'lookbook', label: 'Lookbook', description: 'Product/fashion showcase', icon: '👗' },
  { type: 'showcase', label: 'Showcase', description: 'Best-of compilations', icon: '✨' },
  { type: 'bts', label: 'BTS', description: 'Behind-the-scenes content', icon: '🎬' },
  { type: 'campaign', label: 'Campaign', description: 'Album launches, product drops', icon: '🚀' },
  { type: 'archive', label: 'Archive', description: 'Historical photos', icon: '📦' },
];

const LINK_TYPES: { type: LinkType; label: string; icon: string }[] = [
  { type: 'product', label: 'Product', icon: '🛍️' },
  { type: 'album', label: 'Album', icon: '💿' },
  { type: 'track', label: 'Track', icon: '🎵' },
  { type: 'video', label: 'Video', icon: '🎥' },
  { type: 'clip', label: 'Clip', icon: '📱' },
  { type: 'event', label: 'Event', icon: '🎪' },
  { type: 'gallery', label: 'Gallery', icon: '🖼️' },
];

interface Photo {
  id: number;
  r2_url: string;
  thumbnail_url?: string;
  original_filename?: string;
  user_name?: string;
  created_at: string;
  media_type?: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatusBadge({ gallery }: { gallery: GalleryRow }) {
  const now = new Date();
  const startsAt = gallery.starts_at ? new Date(gallery.starts_at) : null;
  const endsAt = gallery.ends_at ? new Date(gallery.ends_at) : null;
  const isPersistent = gallery.config?.persistent;

  if (isPersistent) {
    return <span className="hub-badge hub-badge-accent">Persistent</span>;
  }
  if (startsAt && now < startsAt) {
    return <span className="hub-badge hub-badge-warning">Scheduled</span>;
  }
  if (endsAt && now > endsAt) {
    return <span className="hub-badge hub-badge-default">Ended</span>;
  }
  if (startsAt && endsAt && now >= startsAt && now <= endsAt) {
    return <span className="hub-badge hub-badge-success">Live</span>;
  }
  return <span className="hub-badge hub-badge-default">Draft</span>;
}

function GalleryTypeBadge({ type }: { type: GalleryType }) {
  const typeInfo = GALLERY_TYPES.find(t => t.type === type);
  if (!typeInfo) return null;

  const colorMap: Record<GalleryType, string> = {
    event: 'hub-badge-accent',
    collection: 'hub-badge-primary',
    lookbook: 'hub-badge-secondary',
    showcase: 'hub-badge-warning',
    bts: 'hub-badge-default',
    campaign: 'hub-badge-success',
    archive: 'hub-badge-default',
  };

  return (
    <span className={`hub-badge ${colorMap[type]} flex items-center gap-1`}>
      <span className="text-xs">{typeInfo.icon}</span>
      {typeInfo.label}
    </span>
  );
}

function UploadModeBadge({ mode }: { mode: UploadMode }) {
  return (
    <span className={`hub-badge ${mode === 'admin' ? 'hub-badge-warning' : 'hub-badge-success'} text-xs`}>
      {mode === 'admin' ? '🔒 Admin Only' : '🌐 Public'}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function parseConfig(config: any): GalleryConfig {
  if (!config) return {};
  if (typeof config === 'string') {
    try { return JSON.parse(config); } catch { return {}; }
  }
  return config;
}

// =============================================================================
// GALLERY CARD
// =============================================================================

function GalleryCard({
  gallery,
  onEdit,
  onToggleFeatured,
  onCopyCode,
  onViewPhotos,
}: {
  gallery: GalleryRow;
  onEdit: () => void;
  onToggleFeatured: () => void;
  onCopyCode: () => void;
  onViewPhotos: () => void;
}) {
  const totalMedia = (gallery.photo_count || 0) + (gallery.video_count || 0);
  const galleryType = gallery.gallery_type || 'event';
  const uploadMode = gallery.upload_mode || 'public';

  return (
    <div className="hub-card overflow-hidden">
      {/* Header gradient */}
      <div className="h-20 bg-gradient-to-br from-[var(--hub-accent)] to-[var(--hub-accent-hover)] relative">
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <GalleryTypeBadge type={galleryType} />
          <StatusBadge gallery={gallery} />
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {uploadMode === 'admin' && <UploadModeBadge mode={uploadMode} />}
          {gallery.config?.featured && (
            <span className="hub-badge hub-badge-warning">Featured</span>
          )}
        </div>
        {/* Links indicator */}
        {gallery.links && gallery.links.length > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white/80 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 6.364l4.5 4.5a4.5 4.5 0 007.244 1.242" />
            </svg>
            {gallery.links.length} linked
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Title and Code */}
        <div>
          <h3 className="font-medium text-[var(--hub-text-primary)] truncate">
            {gallery.title}
          </h3>
          <div className="text-xs text-[var(--hub-text-muted)] font-mono mt-0.5">
            Code: {gallery.code}
          </div>
        </div>

        {/* Description */}
        {gallery.description && (
          <p className="text-xs text-[var(--hub-text-secondary)] line-clamp-2">
            {gallery.description}
          </p>
        )}

        {/* Schedule */}
        <div className="text-xs text-[var(--hub-text-muted)]">
          {gallery.config?.persistent ? (
            <span>Started: {formatDate(gallery.starts_at)}</span>
          ) : (
            <span>
              {formatDate(gallery.starts_at)} → {formatDate(gallery.ends_at)}
            </span>
          )}
        </div>

        {/* Media Count */}
        {totalMedia > 0 && (
          <div className="flex items-center gap-3 text-xs text-[var(--hub-text-secondary)]">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
              </svg>
              {gallery.photo_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              {gallery.video_count || 0}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={onViewPhotos}
            className="hub-btn hub-btn-secondary text-xs py-2 col-span-2 flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 10.5V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v4.5M3 10.5h18" />
            </svg>
            Photos ({totalMedia})
          </button>
          <button
            onClick={onCopyCode}
            className="hub-btn hub-btn-secondary text-xs py-2"
          >
            Copy Code
          </button>
          <button
            onClick={onToggleFeatured}
            className={`hub-btn text-xs py-2 ${gallery.config?.featured ? 'hub-btn-primary' : 'hub-btn-secondary'}`}
          >
            {gallery.config?.featured ? 'Featured' : 'Feature'}
          </button>
          <Link
            href={`/moments?galleryId=${gallery.id}`}
            className="hub-btn hub-btn-secondary text-xs py-2 text-center"
          >
            Capture
          </Link>
          <button
            onClick={onEdit}
            className="hub-btn hub-btn-primary text-xs py-2"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CONTENT LINK MANAGER
// =============================================================================

function ContentLinkManager({
  links,
  onChange,
}: {
  links: GalleryLink[];
  onChange: (links: GalleryLink[]) => void;
}) {
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkType, setNewLinkType] = useState<LinkType>('product');
  const [newLinkId, setNewLinkId] = useState('');
  const [newLinkHandle, setNewLinkHandle] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkPrimary, setNewLinkPrimary] = useState(false);

  const addLink = () => {
    if (!newLinkId.trim()) return;

    const newLink: GalleryLink = {
      link_type: newLinkType,
      link_id: newLinkId.trim(),
      link_handle: newLinkHandle.trim() || undefined,
      display_label: newLinkLabel.trim() || undefined,
      is_primary: newLinkPrimary,
      sort_order: links.length,
    };

    // If this is primary, unset others
    const updatedLinks = newLinkPrimary
      ? links.map(l => ({ ...l, is_primary: false }))
      : [...links];

    onChange([...updatedLinks, newLink]);

    // Reset form
    setNewLinkId('');
    setNewLinkHandle('');
    setNewLinkLabel('');
    setNewLinkPrimary(false);
    setShowAddLink(false);
  };

  const removeLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  const togglePrimary = (index: number) => {
    onChange(links.map((l, i) => ({
      ...l,
      is_primary: i === index ? !l.is_primary : false,
    })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--hub-text-secondary)]">Content Links</span>
        <button
          type="button"
          onClick={() => setShowAddLink(!showAddLink)}
          className="hub-btn hub-btn-secondary text-xs py-1"
        >
          {showAddLink ? 'Cancel' : '+ Add Link'}
        </button>
      </div>

      {/* Add Link Form */}
      {showAddLink && (
        <div className="p-3 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)] space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-[var(--hub-text-muted)]">Type</span>
              <select
                value={newLinkType}
                onChange={(e) => setNewLinkType(e.target.value as LinkType)}
                className="hub-input mt-1 text-sm"
              >
                {LINK_TYPES.map(lt => (
                  <option key={lt.type} value={lt.type}>
                    {lt.icon} {lt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-xs text-[var(--hub-text-muted)]">ID</span>
              <input
                type="text"
                value={newLinkId}
                onChange={(e) => setNewLinkId(e.target.value)}
                className="hub-input mt-1 text-sm"
                placeholder="product-123"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-[var(--hub-text-muted)]">Handle (optional)</span>
              <input
                type="text"
                value={newLinkHandle}
                onChange={(e) => setNewLinkHandle(e.target.value)}
                className="hub-input mt-1 text-sm"
                placeholder="url-slug"
              />
            </div>
            <div>
              <span className="text-xs text-[var(--hub-text-muted)]">Label (optional)</span>
              <input
                type="text"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                className="hub-input mt-1 text-sm"
                placeholder="Featured Item"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newLinkPrimary}
                onChange={(e) => setNewLinkPrimary(e.target.checked)}
                className="rounded border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)]"
              />
              <span className="text-xs text-[var(--hub-text-secondary)]">Primary link</span>
            </label>
            <button
              type="button"
              onClick={addLink}
              disabled={!newLinkId.trim()}
              className="hub-btn hub-btn-primary text-xs py-1 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Links List */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link, index) => {
            const typeInfo = LINK_TYPES.find(t => t.type === link.link_type);
            return (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)]"
              >
                <span className="text-sm">{typeInfo?.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--hub-text-primary)] truncate">
                    {link.display_label || link.link_handle || link.link_id}
                  </div>
                  <div className="text-xs text-[var(--hub-text-muted)]">
                    {typeInfo?.label} • {link.link_id}
                  </div>
                </div>
                {link.is_primary && (
                  <span className="hub-badge hub-badge-accent text-xs">Primary</span>
                )}
                <button
                  type="button"
                  onClick={() => togglePrimary(index)}
                  className="p-1 text-[var(--hub-text-muted)] hover:text-[var(--hub-accent)]"
                  title="Set as primary"
                >
                  <svg className="w-4 h-4" fill={link.is_primary ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="p-1 text-[var(--hub-text-muted)] hover:text-red-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {links.length === 0 && !showAddLink && (
        <p className="text-xs text-[var(--hub-text-muted)] italic">
          No content linked. Link products, albums, videos, etc.
        </p>
      )}
    </div>
  );
}

// =============================================================================
// GALLERY TYPE SELECTOR
// =============================================================================

function GalleryTypeSelector({
  value,
  onChange,
}: {
  value: GalleryType;
  onChange: (type: GalleryType) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm text-[var(--hub-text-secondary)]">Gallery Type</span>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {GALLERY_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => onChange(t.type)}
            className={`p-2 rounded-lg border text-left transition-all ${
              value === t.type
                ? 'border-[var(--hub-accent)] bg-[var(--hub-accent)]/10'
                : 'border-[var(--hub-border)] hover:border-[var(--hub-text-muted)]'
            }`}
          >
            <div className="text-lg mb-0.5">{t.icon}</div>
            <div className="text-xs font-medium text-[var(--hub-text-primary)]">{t.label}</div>
            <div className="text-[10px] text-[var(--hub-text-muted)] line-clamp-1">{t.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// CREATE/EDIT MODAL
// =============================================================================

function GalleryModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: GalleryRow;
  onClose: () => void;
  onSubmit: (data: Partial<GalleryRow>) => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [code, setCode] = useState(initial?.code || generateCode());
  const [description, setDescription] = useState(initial?.description || '');
  const [startsAt, setStartsAt] = useState(formatForInput(initial?.starts_at));
  const [endsAt, setEndsAt] = useState(formatForInput(initial?.ends_at));
  const [persistent, setPersistent] = useState(!!initial?.config?.persistent);
  const [featured, setFeatured] = useState(!!initial?.config?.featured);
  const [isPublic, setIsPublic] = useState(initial?.config?.is_public !== false);

  // New fields
  const [galleryType, setGalleryType] = useState<GalleryType>(initial?.gallery_type || 'event');
  const [uploadMode, setUploadMode] = useState<UploadMode>(initial?.upload_mode || 'public');
  const [links, setLinks] = useState<GalleryLink[]>(initial?.links || []);

  // For non-event types, we often don't need time windows
  const needsTimeWindows = galleryType === 'event' || galleryType === 'bts' || galleryType === 'campaign';

  function generateCode(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function formatForInput(iso?: string | null): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  }

  function toIso(dt: string): string | null {
    if (!dt) return null;
    return new Date(dt).toISOString();
  }

  function handleSubmit() {
    const data: Partial<GalleryRow> = {
      id: initial?.id,
      title,
      code,
      description: description || null,
      starts_at: needsTimeWindows ? toIso(startsAt) : null,
      ends_at: needsTimeWindows && !persistent ? toIso(endsAt) : null,
      config: {
        featured,
        persistent: needsTimeWindows ? persistent : false,
        is_public: isPublic,
      },
      gallery_type: galleryType,
      upload_mode: uploadMode,
      links: links.length > 0 ? links : undefined,
    };
    onSubmit(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-bg-secondary)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hub-border)]">
          <h2 className="text-lg font-semibold text-[var(--hub-text-primary)]">
            {initial ? 'Edit Gallery' : 'Create Gallery'}
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-[var(--hub-text-muted)] hover:text-[var(--hub-text-primary)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Gallery Type Selector */}
          <GalleryTypeSelector value={galleryType} onChange={setGalleryType} />

          {/* Upload Mode */}
          <div className="space-y-2">
            <span className="text-sm text-[var(--hub-text-secondary)]">Who can upload photos?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadMode('public')}
                className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                  uploadMode === 'public'
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-[var(--hub-border)] hover:border-[var(--hub-text-muted)]'
                }`}
              >
                <div className="text-lg mb-1">🌐</div>
                <div className="text-xs font-medium text-[var(--hub-text-primary)]">Public</div>
                <div className="text-[10px] text-[var(--hub-text-muted)]">Anyone can contribute</div>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('admin')}
                className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                  uploadMode === 'admin'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-[var(--hub-border)] hover:border-[var(--hub-text-muted)]'
                }`}
              >
                <div className="text-lg mb-1">🔒</div>
                <div className="text-xs font-medium text-[var(--hub-text-primary)]">Admin Only</div>
                <div className="text-[10px] text-[var(--hub-text-muted)]">Curated content</div>
              </button>
            </div>
          </div>

          <hr className="border-[var(--hub-border)]" />

          <label className="block">
            <span className="text-sm text-[var(--hub-text-secondary)]">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="hub-input mt-1"
              placeholder="Gallery name"
            />
          </label>

          <label className="block">
            <span className="text-sm text-[var(--hub-text-secondary)]">Gallery Code</span>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="hub-input flex-1 font-mono"
                placeholder="ABC123"
              />
              <button
                type="button"
                onClick={() => setCode(generateCode())}
                className="hub-btn hub-btn-secondary"
              >
                Generate
              </button>
            </div>
          </label>

          <label className="block">
            <span className="text-sm text-[var(--hub-text-secondary)]">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="hub-input mt-1 h-20 resize-none"
              placeholder="Gallery details..."
            />
          </label>

          {/* Time Windows (only for event-like types) */}
          {needsTimeWindows && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm text-[var(--hub-text-secondary)]">Start Date/Time</span>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="hub-input mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-[var(--hub-text-secondary)]">End Date/Time</span>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    disabled={persistent}
                    className="hub-input mt-1 disabled:opacity-50"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={persistent}
                  onChange={(e) => setPersistent(e.target.checked)}
                  className="rounded border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)]"
                />
                <span className="text-sm text-[var(--hub-text-secondary)]">Persistent (no end date)</span>
              </label>
            </>
          )}

          <hr className="border-[var(--hub-border)]" />

          {/* Content Links */}
          <ContentLinkManager links={links} onChange={setLinks} />

          <hr className="border-[var(--hub-border)]" />

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)]"
              />
              <span className="text-sm text-[var(--hub-text-secondary)]">Featured on homepage</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)]"
              />
              <span className="text-sm text-[var(--hub-text-secondary)]">Publicly visible</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-[var(--hub-border)]">
          <button onClick={onClose} className="hub-btn hub-btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !code.trim()}
            className="hub-btn hub-btn-primary disabled:opacity-50"
          >
            {initial ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PHOTOS MODAL
// =============================================================================

function PhotosModal({
  gallery,
  onClose,
}: {
  gallery: GalleryRow;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setIsLoading(true);
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(`/api/moments/list?galleryId=${gallery.id}&limit=200`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.photos)) {
            setPhotos(data.photos);
          }
        }
      } catch (error) {
        console.error('Failed to fetch photos:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPhotos();
  }, [gallery.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-bg-secondary)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hub-border)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--hub-text-primary)]">
              {gallery.title}
            </h2>
            <p className="text-xs text-[var(--hub-text-muted)]">
              {photos.length} photos
            </p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-[var(--hub-text-muted)] hover:text-[var(--hub-text-primary)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Photos Grid */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="aspect-square bg-[var(--hub-bg-tertiary)] animate-pulse rounded" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--hub-text-muted)]">No photos in this gallery</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square group">
                  <img
                    src={photo.thumbnail_url || photo.r2_url}
                    alt=""
                    className="w-full h-full object-cover rounded"
                  />
                  {/* Share button overlay */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ShareButton
                      mediaUrl={photo.r2_url}
                      title={photo.original_filename || `Photo from ${gallery.title}`}
                      mediaType={photo.media_type === 'video' ? 'video' : 'image'}
                      filename={photo.original_filename || `${gallery.title}_${photo.id}`}
                      size="sm"
                    />
                  </div>
                  {/* Video indicator */}
                  {photo.media_type === 'video' && (
                    <div className="absolute bottom-1 left-1 w-5 h-5 rounded bg-black/60 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function MomentsPage() {
  const { canAccess } = useHubUser();
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'featured'>('all');
  const [typeFilter, setTypeFilter] = useState<GalleryType | 'all'>('all');
  const [editingGallery, setEditingGallery] = useState<GalleryRow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [photosGallery, setPhotosGallery] = useState<GalleryRow | null>(null);

  const canWrite = canAccess('content', 'write');
  const canDelete = canAccess('content', 'delete');

  // Fetch galleries
  const fetchGalleries = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/moments/galleries?limit=50', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.galleries)) {
          setGalleries(
            data.galleries.map((g: any) => ({
              ...g,
              config: parseConfig(g.config),
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch galleries:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGalleries();
  }, [fetchGalleries]);

  // Filter galleries
  const filteredGalleries = galleries.filter((g) => {
    // Type filter
    if (typeFilter !== 'all' && (g.gallery_type || 'event') !== typeFilter) return false;

    // Status filter
    if (statusFilter === 'featured') return g.config?.featured;
    if (statusFilter === 'live') {
      const now = new Date();
      const startsAt = g.starts_at ? new Date(g.starts_at) : null;
      const endsAt = g.ends_at ? new Date(g.ends_at) : null;
      if (g.config?.persistent) return true;
      return startsAt && endsAt && now >= startsAt && now <= endsAt;
    }
    return true;
  });

  // Count galleries by type
  const typeCounts = galleries.reduce((acc, g) => {
    const type = g.gallery_type || 'event';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Toggle featured
  const toggleFeatured = async (gallery: GalleryRow) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const newConfig = { ...gallery.config, featured: !gallery.config?.featured };

      const res = await fetch(`/api/moments/galleries/${gallery.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ config: newConfig }),
      });

      if (res.ok) {
        setGalleries((prev) =>
          prev.map((g) =>
            g.id === gallery.id ? { ...g, config: newConfig } : g
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle featured:', error);
    }
  };

  // Copy code
  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    alert(`Code copied: ${code}`);
  };

  // Create gallery
  const createGallery = async (data: Partial<GalleryRow>) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/moments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchGalleries();
      } else {
        alert('Failed to create gallery');
      }
    } catch (error) {
      console.error('Failed to create gallery:', error);
    }
  };

  // Update gallery
  const updateGallery = async (data: Partial<GalleryRow>) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/moments/galleries/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setEditingGallery(null);
        fetchGalleries();
      } else {
        alert('Failed to update gallery');
      }
    } catch (error) {
      console.error('Failed to update gallery:', error);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--hub-text-muted)] mb-1">
            <Link href="/admin-v2/content" className="hover:text-[var(--hub-text-secondary)]">
              Content
            </Link>
            <span>/</span>
            <span>Moments</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--hub-text-primary)]">
            Galleries
          </h1>
          <p className="text-sm text-[var(--hub-text-muted)] mt-1">
            Events, lookbooks, collections, and more
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="hub-btn hub-btn-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">Create Gallery</span>
          </button>
        )}
      </div>

      {/* Type Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 hub-scroll-hidden">
          <button
            onClick={() => setTypeFilter('all')}
            className={`hub-btn ${typeFilter === 'all' ? 'hub-btn-primary' : 'hub-btn-secondary'} whitespace-nowrap`}
          >
            All Types
            <span className="ml-1 opacity-70">({galleries.length})</span>
          </button>
          {GALLERY_TYPES.filter(t => typeCounts[t.type]).map((t) => (
            <button
              key={t.type}
              onClick={() => setTypeFilter(t.type)}
              className={`hub-btn ${typeFilter === t.type ? 'hub-btn-primary' : 'hub-btn-secondary'} whitespace-nowrap`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
              <span className="ml-1 opacity-70">({typeCounts[t.type] || 0})</span>
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 hub-scroll-hidden">
          {(['all', 'live', 'featured'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`hub-btn text-xs ${
                statusFilter === f ? 'hub-btn-accent' : 'hub-btn-secondary'
              } whitespace-nowrap`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({galleries.filter((g) => {
                    if (typeFilter !== 'all' && (g.gallery_type || 'event') !== typeFilter) return false;
                    if (f === 'featured') return g.config?.featured;
                    if (f === 'live') {
                      const now = new Date();
                      const startsAt = g.starts_at ? new Date(g.starts_at) : null;
                      const endsAt = g.ends_at ? new Date(g.ends_at) : null;
                      if (g.config?.persistent) return true;
                      return startsAt && endsAt && now >= startsAt && now <= endsAt;
                    }
                    return true;
                  }).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="hub-card overflow-hidden animate-pulse">
              <div className="h-20 bg-[var(--hub-bg-tertiary)]" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-[var(--hub-bg-tertiary)] rounded w-3/4" />
                <div className="h-3 bg-[var(--hub-bg-tertiary)] rounded w-1/2" />
                <div className="h-3 bg-[var(--hub-bg-tertiary)] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGalleries.map((gallery) => (
            <GalleryCard
              key={gallery.id}
              gallery={gallery}
              onEdit={() => setEditingGallery(gallery)}
              onToggleFeatured={() => toggleFeatured(gallery)}
              onCopyCode={() => copyCode(gallery.code)}
              onViewPhotos={() => setPhotosGallery(gallery)}
            />
          ))}
          {filteredGalleries.length === 0 && (
            <div className="col-span-full hub-card p-8 text-center">
              <p className="text-[var(--hub-text-muted)]">No galleries found</p>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <GalleryModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={createGallery}
        />
      )}

      {/* Edit Modal */}
      {editingGallery && (
        <GalleryModal
          initial={editingGallery}
          onClose={() => setEditingGallery(null)}
          onSubmit={updateGallery}
        />
      )}

      {/* Photos Modal */}
      {photosGallery && (
        <PhotosModal
          gallery={photosGallery}
          onClose={() => setPhotosGallery(null)}
        />
      )}
    </div>
  );
}
