'use client';

/**
 * The Hub - Video Library
 * Video management with mobile-first design
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';
import { DataTable } from '@/components/hub/data-display';
import type { Column, TableAction, Video } from '@/lib/hub/types';

// =============================================================================
// TYPES
// =============================================================================

interface VideoRow {
  id: number;
  uid: string;
  title: string;
  artistName: string | null;
  type: string;
  status: string;
  duration: number | null;
  isPublic: boolean;
  posterUrl: string | null;
  createdAt: string;
}

// =============================================================================
// VIDEO CARD (for mobile grid view alternative)
// =============================================================================

function VideoCard({ video, onClick }: { video: VideoRow; onClick?: () => void }) {
  return (
    <div
      className="hub-card overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-[var(--hub-bg-tertiary)] relative">
        {video.posterUrl ? (
          <img
            src={video.posterUrl}
            alt={video.title}
            className="w-full h-full object-cover"
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
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          <StatusBadge status={video.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-[var(--hub-text-primary)] truncate group-hover:text-[var(--hub-accent-active)] transition-colors">
          {video.title}
        </h3>
        {video.artistName && (
          <p className="text-sm text-[var(--hub-text-muted)] truncate">
            {video.artistName}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <TypeBadge type={video.type} />
          {!video.isPublic && (
            <span className="text-xs text-[var(--hub-text-muted)]">Private</span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: 'hub-badge-success',
    ready: 'hub-badge-accent',
    processing: 'hub-badge-warning',
    draft: 'hub-badge-default',
    archived: 'hub-badge-default',
  };

  return (
    <span className={`hub-badge ${styles[status] || 'hub-badge-default'}`}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="text-xs text-[var(--hub-text-muted)] capitalize">
      {type?.replace('-', ' ') || 'Video'}
    </span>
  );
}

function formatDuration(seconds: number): string {
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

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function VideosPage() {
  const { canAccess } = useHubUser();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  const canWrite = canAccess('content', 'write');
  const canDelete = canAccess('content', 'delete');

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/videos', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        // API returns { success: true, videos: [...] }
        const videoList = data.videos || data.data || [];
        if (Array.isArray(videoList)) {
          setVideos(
            videoList.map((v: any) => ({
              id: v.id,
              uid: v.uid,
              title: v.title || 'Untitled',
              artistName: v.artist_name || v.artistName,
              type: v.type || 'video',
              status: v.status || 'draft',
              duration: v.duration_seconds || v.duration,
              isPublic: Boolean(v.is_public ?? v.isPublic),
              posterUrl: v.poster_url || v.posterUrl || v.thumbnail_url,
              createdAt: v.created_at || v.createdAt,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Filter videos
  const filteredVideos = videos.filter((v) => {
    if (filter === 'published') return v.status === 'published';
    if (filter === 'draft') return v.status === 'draft';
    return true;
  });

  // Table columns
  const columns: Column<VideoRow>[] = [
    {
      key: 'title',
      label: 'Title',
      mobilePrimary: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-16 h-9 bg-[var(--hub-bg-tertiary)] rounded overflow-hidden flex-shrink-0">
            {row.posterUrl ? (
              <img
                src={row.posterUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                  className="w-4 h-4 text-[var(--hub-text-muted)]"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[var(--hub-text-primary)] truncate">
              {row.title}
            </p>
            {row.artistName && (
              <p className="text-xs text-[var(--hub-text-muted)] truncate">
                {row.artistName}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      mobileHidden: true,
      render: (value) => <TypeBadge type={value as string} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value as string} />,
    },
    {
      key: 'duration',
      label: 'Duration',
      mobileHidden: true,
      render: (value) => (value ? formatDuration(value as number) : '—'),
    },
    {
      key: 'createdAt',
      label: 'Created',
      mobileHidden: true,
      render: (value) => formatDate(value as string),
    },
  ];

  // Table actions
  const actions: TableAction<VideoRow>[] = [
    {
      id: 'edit',
      label: 'Edit',
      onClick: (row) => {
        // For now, link to existing admin video editor
        window.location.href = `/admin/videos?edit=${row.id}`;
      },
    },
    {
      id: 'view',
      label: 'Preview',
      onClick: (row) => {
        window.open(`/watch/${row.uid}`, '_blank');
      },
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            label: 'Delete',
            variant: 'destructive' as const,
            requiresConfirm: true,
            confirmMessage: 'Are you sure you want to delete this video?',
            onClick: async (row: VideoRow) => {
              // Delete logic here
              console.log('Delete video:', row.id);
            },
          },
        ]
      : []),
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
            <span>Videos</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--hub-text-primary)]">
            Video Library
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
            </button>
          </div>

          {canWrite && (
            <Link href="/admin/videos" className="hub-btn hub-btn-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">Add Video</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 hub-scroll-hidden">
        {(['all', 'published', 'draft'] as const).map((f) => (
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
                ({videos.filter((v) => (f === 'published' ? v.status === 'published' : v.status === 'draft')).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="hub-card overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-[var(--hub-bg-tertiary)]" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-[var(--hub-bg-tertiary)] rounded w-3/4" />
                <div className="h-3 bg-[var(--hub-bg-tertiary)] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={() => window.location.href = `/admin/videos?edit=${video.id}`}
            />
          ))}
          {filteredVideos.length === 0 && (
            <div className="col-span-full hub-card p-8 text-center">
              <p className="text-[var(--hub-text-muted)]">No videos found</p>
            </div>
          )}
        </div>
      ) : (
        <DataTable
          data={filteredVideos}
          columns={columns}
          actions={actions}
          emptyMessage="No videos found"
          onRowClick={(row) => window.location.href = `/admin/videos?edit=${row.id}`}
        />
      )}
    </div>
  );
}
