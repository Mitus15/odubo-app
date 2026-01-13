'use client';

/**
 * The Hub - Clips Manager
 * Short-form video content management
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';
import { DataTable } from '@/components/hub/data-display';
import ShareClipButton from '@/components/admin/ShareClipButton';
import ShareClipModal from '@/components/admin/ShareClipModal';
import type { Column, TableAction } from '@/lib/hub/types';

// =============================================================================
// TYPES
// =============================================================================

interface ClipRow {
  id: number;
  uid: string;
  title: string;
  artist_name: string | null;
  description: string | null;
  poster_url: string | null;
  thumbnail: string | null;
  duration: number | null;
  duration_seconds: number | null;
  is_public: boolean | number | null;
  status: string;
  publication_status: string;
  shopify_product_handle: string | null;
  created_at: string;
  // Engagement metrics (when loaded)
  view_count?: number;
  completion_count?: number;
  share_count?: number;
  shop_click_count?: number;
  engagement_score?: number;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatNumber(num: number | undefined): string {
  if (num === undefined) return '—';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// =============================================================================
// CLIP CARD (for grid view)
// =============================================================================

function ClipCard({ clip, onClick }: { clip: ClipRow; onClick?: () => void }) {
  const thumbnailUrl = clip.thumbnail || clip.poster_url;
  const duration = clip.duration_seconds || clip.duration;

  return (
    <div
      className="hub-card overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-[9/16] bg-[var(--hub-bg-tertiary)] relative">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={clip.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="w-12 h-12 text-[var(--hub-text-muted)]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
              />
            </svg>
          </div>
        )}

        {/* Duration badge */}
        {duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white font-medium">
            {formatDuration(duration)}
          </div>
        )}

        {/* Status badges - top left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {clip.publication_status !== 'live' && (
            <span className="px-1.5 py-0.5 bg-amber-500/90 rounded text-[10px] text-white font-medium">
              {clip.publication_status || 'archived'}
            </span>
          )}
          {!clip.is_public && (
            <span className="px-1.5 py-0.5 bg-gray-600/90 rounded text-[10px] text-white font-medium">
              Private
            </span>
          )}
        </div>

        {/* Top right: Share + Product badge */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
          {/* Share button */}
          <div onClick={(e) => e.stopPropagation()}>
            <ShareClipButton clipId={clip.id} clipTitle={clip.title} />
          </div>
          {/* Product linked badge */}
          {clip.shopify_product_handle && (
            <div className="p-1.5 bg-black/70 rounded">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </div>
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-[var(--hub-text-primary)] truncate group-hover:text-[var(--hub-accent-active)] transition-colors">
          {clip.title}
        </h3>
        {clip.artist_name && (
          <p className="text-sm text-[var(--hub-text-muted)] truncate">
            {clip.artist_name}
          </p>
        )}

        {/* Engagement stats */}
        {clip.view_count !== undefined && (
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--hub-text-muted)]">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              {formatNumber(clip.view_count)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
              </svg>
              {formatNumber(clip.share_count)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ClipsPage() {
  const { canAccess } = useHubUser();
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'engagement'>('recent');

  const canWrite = canAccess('content', 'write');

  // Fetch clips - uses admin endpoint that returns ALL clips
  const fetchClips = useCallback(async () => {
    try {
      setIsLoading(true);
      const withEngagement = sortBy === 'engagement';
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      // Use admin endpoint that returns all clips (not just public/live)
      const res = await fetch(`/api/v2/content/clips?limit=100&withEngagement=${withEngagement}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const clipList = data.clips || [];
        if (Array.isArray(clipList)) {
          setClips(
            clipList.map((c: any) => ({
              id: c.id,
              uid: c.uid,
              title: c.title || 'Untitled',
              artist_name: c.artist_name,
              description: c.description,
              poster_url: c.poster_url,
              thumbnail: c.thumbnail,
              duration: c.duration,
              duration_seconds: c.duration_seconds,
              is_public: c.is_public,
              status: c.status,
              publication_status: c.publication_status,
              shopify_product_handle: c.shopify_product_handle,
              created_at: c.created_at,
              view_count: c.view_count,
              completion_count: c.completion_count,
              share_count: c.share_count,
              shop_click_count: c.shop_click_count,
              engagement_score: c.engagement_score,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch clips:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // Table columns
  const columns: Column<ClipRow>[] = [
    {
      key: 'title',
      label: 'Clip',
      mobilePrimary: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-16 bg-[var(--hub-bg-tertiary)] rounded overflow-hidden flex-shrink-0">
            {(row.thumbnail || row.poster_url) ? (
              <img
                src={row.thumbnail || row.poster_url || ''}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--hub-text-muted)]" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[var(--hub-text-primary)] truncate">
              {row.title}
            </p>
            {row.artist_name && (
              <p className="text-xs text-[var(--hub-text-muted)] truncate">
                {row.artist_name}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'publication_status',
      label: 'Status',
      render: (_, row) => (
        <div className="flex flex-col gap-0.5">
          <span className={`hub-badge ${row.publication_status === 'live' ? 'hub-badge-success' : 'hub-badge-warning'}`}>
            {row.publication_status || 'archived'}
          </span>
          {!row.is_public && (
            <span className="hub-badge hub-badge-default text-[10px]">Private</span>
          )}
        </div>
      ),
    },
    {
      key: 'duration_seconds',
      label: 'Duration',
      mobileHidden: true,
      render: (_, row) => formatDuration(row.duration_seconds || row.duration),
    },
    {
      key: 'view_count',
      label: 'Views',
      mobileHidden: true,
      render: (value) => formatNumber(value as number | undefined),
    },
    {
      key: 'engagement_score',
      label: 'Engagement',
      mobileHidden: true,
      render: (value) => value ? formatNumber(value as number) : '—',
    },
    {
      key: 'shopify_product_handle',
      label: 'Product',
      mobileHidden: true,
      render: (value) => value ? (
        <span className="hub-badge hub-badge-success">Linked</span>
      ) : (
        <span className="text-[var(--hub-text-muted)]">—</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      mobileHidden: true,
      render: (value) => formatDate(value as string),
    },
  ];

  // Share modal state for list view
  const [shareModalClip, setShareModalClip] = useState<ClipRow | null>(null);

  // Table actions
  const actions: TableAction<ClipRow>[] = [
    {
      id: 'share',
      label: 'Share',
      onClick: (row) => setShareModalClip(row),
    },
    {
      id: 'edit',
      label: 'Edit',
      onClick: (row) => {
        window.location.href = `/admin/videos?edit=${row.id}`;
      },
    },
    {
      id: 'view',
      label: 'Preview',
      onClick: (row) => {
        window.open(`/?clip=${row.uid}`, '_blank');
      },
    },
  ];

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
            <span>Clips</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--hub-text-primary)]">
            Clips Feed
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-[var(--hub-bg-tertiary)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${
                viewMode === 'grid'
                  ? 'bg-[var(--hub-bg-secondary)] text-[var(--hub-text-primary)]'
                  : 'text-[var(--hub-text-muted)]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${
                viewMode === 'list'
                  ? 'bg-[var(--hub-bg-secondary)] text-[var(--hub-text-primary)]'
                  : 'text-[var(--hub-text-muted)]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </button>
          </div>

          {canWrite && (
            <Link href="/admin/videos?type=clip" className="hub-btn hub-btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">Add Clip</span>
            </Link>
          )}
        </div>
      </div>

      {/* Sort/Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 hub-scroll-hidden">
        <button
          onClick={() => setSortBy('recent')}
          className={`hub-btn ${
            sortBy === 'recent' ? 'hub-btn-primary' : 'hub-btn-secondary'
          } whitespace-nowrap`}
        >
          Most Recent
        </button>
        <button
          onClick={() => setSortBy('engagement')}
          className={`hub-btn ${
            sortBy === 'engagement' ? 'hub-btn-primary' : 'hub-btn-secondary'
          } whitespace-nowrap`}
        >
          Top Performing
        </button>
      </div>

      {/* Stats Summary */}
      {!isLoading && clips.length > 0 && sortBy === 'engagement' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="hub-card p-4">
            <p className="text-xs text-[var(--hub-text-muted)] uppercase tracking-wide">Total Clips</p>
            <p className="text-2xl font-semibold text-[var(--hub-text-primary)] mt-1">{clips.length}</p>
          </div>
          <div className="hub-card p-4">
            <p className="text-xs text-[var(--hub-text-muted)] uppercase tracking-wide">Total Views</p>
            <p className="text-2xl font-semibold text-[var(--hub-text-primary)] mt-1">
              {formatNumber(clips.reduce((sum, c) => sum + (c.view_count || 0), 0))}
            </p>
          </div>
          <div className="hub-card p-4">
            <p className="text-xs text-[var(--hub-text-muted)] uppercase tracking-wide">Total Shares</p>
            <p className="text-2xl font-semibold text-[var(--hub-text-primary)] mt-1">
              {formatNumber(clips.reduce((sum, c) => sum + (c.share_count || 0), 0))}
            </p>
          </div>
          <div className="hub-card p-4">
            <p className="text-xs text-[var(--hub-text-muted)] uppercase tracking-wide">Shop Clicks</p>
            <p className="text-2xl font-semibold text-[var(--hub-text-primary)] mt-1">
              {formatNumber(clips.reduce((sum, c) => sum + (c.shop_click_count || 0), 0))}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="hub-card overflow-hidden animate-pulse">
              <div className="aspect-[9/16] bg-[var(--hub-bg-tertiary)]" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-[var(--hub-bg-tertiary)] rounded w-3/4" />
                <div className="h-3 bg-[var(--hub-bg-tertiary)] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onClick={() => window.location.href = `/admin/videos?edit=${clip.id}`}
            />
          ))}
          {clips.length === 0 && (
            <div className="col-span-full hub-card p-8 text-center">
              <p className="text-[var(--hub-text-muted)]">No clips found</p>
            </div>
          )}
        </div>
      ) : (
        <DataTable
          data={clips}
          columns={columns}
          actions={actions}
          emptyMessage="No clips found"
          onRowClick={(row) => window.location.href = `/admin/videos?edit=${row.id}`}
        />
      )}

      {/* Share Modal for list view */}
      {shareModalClip && (
        <ShareClipModal
          isOpen={true}
          onClose={() => setShareModalClip(null)}
          clipId={shareModalClip.id}
          clipTitle={shareModalClip.title}
        />
      )}
    </div>
  );
}
