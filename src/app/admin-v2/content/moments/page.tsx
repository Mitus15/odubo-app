'use client';

/**
 * The Hub - Moments/Galleries Manager
 * Event galleries with photo/video collection
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';

// =============================================================================
// TYPES
// =============================================================================

interface GalleryConfig {
  featured?: boolean;
  persistent?: boolean;
  capacity?: number;
  ticket_price?: number;
  is_public?: boolean;
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
  onCopyCode
}: {
  gallery: GalleryRow;
  onEdit: () => void;
  onToggleFeatured: () => void;
  onCopyCode: () => void;
}) {
  const totalMedia = (gallery.photo_count || 0) + (gallery.video_count || 0);

  return (
    <div className="hub-card overflow-hidden">
      {/* Header gradient */}
      <div className="h-20 bg-gradient-to-br from-[var(--hub-accent)] to-[var(--hub-accent-hover)] relative">
        <div className="absolute top-2 left-2">
          <StatusBadge gallery={gallery} />
        </div>
        {gallery.config?.featured && (
          <div className="absolute top-2 right-2">
            <span className="hub-badge hub-badge-warning">Featured</span>
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
      starts_at: toIso(startsAt),
      ends_at: persistent ? null : toIso(endsAt),
      config: {
        featured,
        persistent,
        is_public: isPublic,
      },
    };
    onSubmit(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-bg-secondary)] overflow-hidden max-h-[90vh] flex flex-col">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <label className="block">
            <span className="text-sm text-[var(--hub-text-secondary)]">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="hub-input mt-1"
              placeholder="Event name"
            />
          </label>

          <label className="block">
            <span className="text-sm text-[var(--hub-text-secondary)]">Event Code</span>
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
              placeholder="Event details..."
            />
          </label>

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

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistent}
                onChange={(e) => setPersistent(e.target.checked)}
                className="rounded border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)]"
              />
              <span className="text-sm text-[var(--hub-text-secondary)]">Persistent (no end date)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)]"
              />
              <span className="text-sm text-[var(--hub-text-secondary)]">Featured</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-[var(--hub-border)] bg-[var(--hub-bg-tertiary)]"
              />
              <span className="text-sm text-[var(--hub-text-secondary)]">Public</span>
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
// MAIN PAGE
// =============================================================================

export default function MomentsPage() {
  const { canAccess } = useHubUser();
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'featured'>('all');
  const [editingGallery, setEditingGallery] = useState<GalleryRow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    if (filter === 'featured') return g.config?.featured;
    if (filter === 'live') {
      const now = new Date();
      const startsAt = g.starts_at ? new Date(g.starts_at) : null;
      const endsAt = g.ends_at ? new Date(g.ends_at) : null;
      if (g.config?.persistent) return true;
      return startsAt && endsAt && now >= startsAt && now <= endsAt;
    }
    return true;
  });

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
            Event Galleries
          </h1>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="hub-btn hub-btn-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">Create Event</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 hub-scroll-hidden">
        {(['all', 'live', 'featured'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`hub-btn ${
              filter === f ? 'hub-btn-primary' : 'hub-btn-secondary'
            } whitespace-nowrap`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 opacity-70">
                ({galleries.filter((g) => {
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
    </div>
  );
}
