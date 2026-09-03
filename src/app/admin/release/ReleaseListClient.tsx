'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { apiFetch } from './components/api';
import { BackLink, Chip, EmptyState, Panel, Spinner } from './components/ui';

interface ProjectRow {
  id: string;
  type: string;
  title: string;
  status: string;
  album_id: string | null;
  album_title: string | null;
  album_status: string | null;
  album_release_date: string | null;
  album_cover_art_url: string | null;
  piece_count: number;
  file_count: number;
}

/** Days until a date, or null if there isn't one. */
function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const then = new Date(`${date}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((then.getTime() - today.getTime()) / 86_400_000);
}

export default function ReleaseListClient() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ projects: ProjectRow[] }>('/api/admin/release/projects');
      setProjects(data.projects ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <BackLink href="/admin">Admin</BackLink>

        <header className="mt-4 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Release</h1>
          <p className="text-[#726d6c] text-sm mt-1">
            The working files, the delivery sheet and the rollout — one project at a time.
          </p>
        </header>

        {error && (
          <Panel className="p-4 mb-6 border-red-900/60">
            <p className="text-red-300 text-sm">{error}</p>
          </Panel>
        )}

        {projects === null && !error && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {projects?.length === 0 && (
          <EmptyState
            title="No projects yet."
            body="A project is an album, a film, or a fashion line — the IP, and every file under it."
          />
        )}

        <div className="grid gap-3">
          {projects?.map((p) => {
            const days = daysUntil(p.album_release_date);
            return (
              <Link key={p.id} href={`/admin/release/${p.id}`}>
                <Panel className="p-5 hover:border-[#843c2d] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-medium truncate">{p.title}</h2>
                        <Chip tone="neutral">{p.type}</Chip>
                        {p.album_status && (
                          <Chip tone={p.album_status === 'published' ? 'good' : 'warn'}>
                            {p.album_status}
                          </Chip>
                        )}
                      </div>
                      <p className="text-[#726d6c] text-xs mt-2">
                        {p.piece_count} piece{p.piece_count === 1 ? '' : 's'} ·{' '}
                        {p.file_count} file{p.file_count === 1 ? '' : 's'}
                        {p.album_release_date && ` · out ${p.album_release_date}`}
                      </p>
                    </div>

                    {days !== null && (
                      <div className="text-right shrink-0">
                        <div
                          className={`text-xl font-semibold tabular-nums ${
                            days < 0
                              ? 'text-[#726d6c]'
                              : days <= 14
                                ? 'text-amber-300'
                                : 'text-[#b2a491]'
                          }`}
                        >
                          {days < 0 ? 'out' : `T-${days}`}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-[#726d6c]">
                          {days < 0 ? 'released' : 'days'}
                        </div>
                      </div>
                    )}
                  </div>
                </Panel>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
