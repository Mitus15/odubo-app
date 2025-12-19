'use client';

/**
 * The Hub - Music Library
 * Albums and tracks management
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';
import { DataTable } from '@/components/hub/data-display';
import type { Column, TableAction } from '@/lib/hub/types';

// =============================================================================
// TYPES
// =============================================================================

interface AlbumRow {
  id: string;
  title: string;
  artist_name: string;
  release_type: 'album' | 'ep' | 'single' | 'compilation';
  release_date: string | null;
  genre: string | null;
  status: string;
  cover_art_url: string | null;
  total_tracks: number;
  featured: boolean;
  created_at: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: 'hub-badge-success',
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
  const colors: Record<string, string> = {
    album: 'hub-badge-accent',
    ep: 'hub-badge-warning',
    single: 'hub-badge-success',
    compilation: 'hub-badge-default',
  };

  return (
    <span className={`hub-badge ${colors[type] || 'hub-badge-default'}`}>
      {type.toUpperCase()}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// =============================================================================
// ALBUM CARD (for grid view)
// =============================================================================

function AlbumCard({ album, onClick }: { album: AlbumRow; onClick?: () => void }) {
  return (
    <div
      className="hub-card overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {/* Cover Art */}
      <div className="aspect-square bg-[var(--hub-bg-tertiary)] relative">
        {album.cover_art_url ? (
          <img
            src={album.cover_art_url}
            alt={album.title}
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
                d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
              />
            </svg>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <TypeBadge type={album.release_type} />
        </div>

        {/* Featured badge */}
        {album.featured && (
          <div className="absolute top-2 right-2">
            <span className="hub-badge hub-badge-warning">Featured</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-[var(--hub-text-primary)] truncate group-hover:text-[var(--hub-accent-active)] transition-colors">
          {album.title}
        </h3>
        <p className="text-sm text-[var(--hub-text-muted)] truncate">
          {album.artist_name}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-[var(--hub-text-muted)]">
          <StatusBadge status={album.status} />
          <span>{album.total_tracks} tracks</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function MusicPage() {
  const { canAccess } = useHubUser();
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'album' | 'ep' | 'single'>('all');

  const canWrite = canAccess('content', 'write');
  const canDelete = canAccess('content', 'delete');

  // Fetch albums
  const fetchAlbums = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/albums', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.albums)) {
          setAlbums(
            data.albums.map((a: any) => ({
              id: a.id,
              title: a.title || 'Untitled',
              artist_name: a.artist_name,
              release_type: a.release_type || 'album',
              release_date: a.release_date,
              genre: a.genre,
              status: a.status || 'draft',
              cover_art_url: a.cover_art_url,
              total_tracks: a.total_tracks || 0,
              featured: Boolean(a.featured),
              created_at: a.created_at,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch albums:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  // Filter albums
  const filteredAlbums = albums.filter((a) => {
    if (filter === 'all') return true;
    return a.release_type === filter;
  });

  // Table columns
  const columns: Column<AlbumRow>[] = [
    {
      key: 'title',
      label: 'Album',
      mobilePrimary: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[var(--hub-bg-tertiary)] rounded overflow-hidden flex-shrink-0">
            {row.cover_art_url ? (
              <img
                src={row.cover_art_url}
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
                  className="w-5 h-5 text-[var(--hub-text-muted)]"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[var(--hub-text-primary)] truncate">
              {row.title}
            </p>
            <p className="text-xs text-[var(--hub-text-muted)] truncate">
              {row.artist_name}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'release_type',
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
      key: 'total_tracks',
      label: 'Tracks',
      mobileHidden: true,
      render: (value) => `${value} tracks`,
    },
    {
      key: 'release_date',
      label: 'Released',
      mobileHidden: true,
      render: (value) => formatDate(value as string | null),
    },
  ];

  // Table actions
  const actions: TableAction<AlbumRow>[] = [
    {
      id: 'edit',
      label: 'Edit',
      onClick: (row) => {
        window.location.href = `/admin?tab=music&edit=${row.id}`;
      },
    },
    {
      id: 'view',
      label: 'Preview',
      onClick: (row) => {
        window.open(`/music/${row.id}`, '_blank');
      },
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            label: 'Delete',
            variant: 'destructive' as const,
            requiresConfirm: true,
            confirmMessage: 'Are you sure you want to delete this album and all its tracks?',
            onClick: async (row: AlbumRow) => {
              try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                const res = await fetch('/api/albums', {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ id: row.id }),
                });
                if (res.ok) {
                  fetchAlbums();
                }
              } catch (error) {
                console.error('Failed to delete album:', error);
              }
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
            <span>Music</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--hub-text-primary)]">
            Music Library
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
            <Link href="/admin?tab=music" className="hub-btn hub-btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">Add Album</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 hub-scroll-hidden">
        {(['all', 'album', 'ep', 'single'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`hub-btn ${
              filter === f ? 'hub-btn-primary' : 'hub-btn-secondary'
            } whitespace-nowrap`}
          >
            {f === 'all' ? 'All' : f.toUpperCase()}
            {f !== 'all' && (
              <span className="ml-1 opacity-70">
                ({albums.filter((a) => a.release_type === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="hub-card overflow-hidden animate-pulse">
              <div className="aspect-square bg-[var(--hub-bg-tertiary)]" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-[var(--hub-bg-tertiary)] rounded w-3/4" />
                <div className="h-3 bg-[var(--hub-bg-tertiary)] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAlbums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => window.location.href = `/admin?tab=music&edit=${album.id}`}
            />
          ))}
          {filteredAlbums.length === 0 && (
            <div className="col-span-full hub-card p-8 text-center">
              <p className="text-[var(--hub-text-muted)]">No albums found</p>
            </div>
          )}
        </div>
      ) : (
        <DataTable
          data={filteredAlbums}
          columns={columns}
          actions={actions}
          emptyMessage="No albums found"
          onRowClick={(row) => window.location.href = `/admin?tab=music&edit=${row.id}`}
        />
      )}
    </div>
  );
}
