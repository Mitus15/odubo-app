'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WarehouseFile, WarehousePiece } from '@/lib/release/types';
import { apiFetch, apiSend } from '../components/api';
import { BackLink, Button, Chip, EmptyState, Panel, SectionTitle, Spinner } from '../components/ui';
import PieceGrid from './PieceGrid';
import PieceDetail from './PieceDetail';
import InboxPanel from './InboxPanel';
import DocsPanel from '../components/DocsPanel';
import DeliveryGrid from './DeliveryGrid';
import FolderIngest from './FolderIngest';
import ReconcilePanel from './ReconcilePanel';
import type { ProjectFloorData } from './types';

export default function ProjectFloorClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectFloorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<ProjectFloorData>(`/api/admin/release/projects/${projectId}`));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filesByPiece = useMemo(() => {
    const map = new Map<string, WarehouseFile[]>();
    for (const f of data?.files ?? []) {
      const key = f.piece_id ?? '__inbox__';
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    return map;
  }, [data?.files]);

  const selectedPiece: WarehousePiece | null = useMemo(
    () => data?.pieces.find((p) => p.id === selectedPieceId) ?? null,
    [data?.pieces, selectedPieceId]
  );

  const createTrackPieces = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await apiSend('/api/admin/release/pieces', 'PUT', { projectId });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df] p-8">
        <BackLink href="/admin/release">Release</BackLink>
        <Panel className="p-4 mt-4 border-red-900/60">
          <p className="text-red-300 text-sm">{error}</p>
        </Panel>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const { project, album, tracks, release, pieces, shipped } = data;
  const inboxFiles = filesByPiece.get('__inbox__') ?? [];
  const playable = tracks.filter((t) => t.audio_url).length;
  const shippedCount = Object.keys(shipped).length;
  const trackPiecesMissing =
    !!album && tracks.length > 0 && pieces.filter((p) => p.kind === 'track-master').length < tracks.length;

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <BackLink href="/admin/release">Release</BackLink>

        {/* ---- header ---- */}
        <header className="mt-4 mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
            <Chip tone="neutral">{project.type}</Chip>
            {album && (
              <Chip tone={album.status === 'published' ? 'good' : 'warn'}>{album.status}</Chip>
            )}
            {release && <Chip tone="neutral">delivery: {release.status}</Chip>}
          </div>

          {album && (
            <p className="text-[#726d6c] text-sm mt-2">
              {album.artist_name ?? 'Unknown artist'}
              {album.release_date && ` · out ${album.release_date}`}
              {` · ${tracks.length} songs`}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {album && (
              <a href={`/music/albums/${album.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="primary">Preview on the platform ↗</Button>
              </a>
            )}
            {trackPiecesMissing && (
              <Button onClick={createTrackPieces} disabled={busy}>
                {busy ? 'Working…' : 'Create a piece per song'}
              </Button>
            )}
          </div>

          {/* Two counts that matter before anything else: can it be heard,
              and is there a master flagged for every song. */}
          {album && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Chip
                tone={playable === tracks.length && tracks.length > 0 ? 'good' : 'bad'}
                title="Tracks whose audio_url resolves to something the browser can fetch"
              >
                Playable {playable}/{tracks.length}
              </Chip>
              <Chip
                tone={
                  shippedCount === tracks.length && tracks.length > 0
                    ? 'good'
                    : shippedCount > 0
                      ? 'warn'
                      : 'bad'
                }
                title="Songs with a commercial master flagged to ship"
              >
                Masters {shippedCount}/{tracks.length}
              </Chip>
            </div>
          )}

          {playable === 0 && tracks.length > 0 && (
            <p className="text-amber-300/80 text-xs mt-3 max-w-2xl">
              Nothing plays yet. Upload a master to a song below and flag it to ship — that
              is what gives the preview something to play.
            </p>
          )}
        </header>

        {error && (
          <Panel className="p-3 mb-4 border-red-900/60">
            <p className="text-red-300 text-xs">{error}</p>
          </Panel>
        )}

        {/* ---- pieces ---- */}
        <section className="mb-8">
          <SectionTitle hint="Every deliverable under this project, and the files that make it.">
            The floor
          </SectionTitle>

          {pieces.length === 0 ? (
            <EmptyState
              title="No pieces yet."
              body="A piece is a deliverable — the cover, the sleeve, or one song's masters."
            />
          ) : (
            <PieceGrid
              pieces={pieces}
              tracks={tracks}
              filesByPiece={filesByPiece}
              shipped={shipped}
              selectedId={selectedPieceId}
              onSelect={(id) => setSelectedPieceId(id === selectedPieceId ? null : id)}
            />
          )}
        </section>

        {/* ---- the selected piece ---- */}
        {selectedPiece && (
          <section className="mb-8">
            <PieceDetail
              projectId={projectId}
              piece={selectedPiece}
              track={tracks.find((t) => t.id === selectedPiece.track_id) ?? null}
              files={filesByPiece.get(selectedPiece.id) ?? []}
              shippedKey={
                selectedPiece.track_id ? (shipped[selectedPiece.track_id] ?? null) : null
              }
              onChanged={load}
              onClose={() => setSelectedPieceId(null)}
            />
          </section>
        )}

        {/* ---- inbox ---- */}
        <section className="mb-8">
          <SectionTitle hint="Files that arrived without a piece. Uploading is the expensive part; filing is cheap.">
            Inbox
          </SectionTitle>
          <InboxPanel
            projectId={projectId}
            files={inboxFiles}
            pieces={pieces}
            onChanged={load}
          />
        </section>

        {/* ---- name sync ---- */}
        <section className="mb-8">
          <ReconcilePanel projectId={projectId} tracks={tracks} onChanged={load} />
        </section>

        {/* ---- folder ingest ---- */}
        <section className="mb-8">
          <FolderIngest projectId={projectId} tracks={tracks} onDone={load} />
        </section>

        {/* ---- the delivery sheet ---- */}
        <section className="mb-8">
          <DeliveryGrid projectId={projectId} />
        </section>

        {/* ---- the writing ---- */}
        <section className="mb-16">
          <SectionTitle hint="Notes, lore, characters — whatever the record is about.">
            The world around it
          </SectionTitle>
          <DocsPanel projectId={projectId} trackId={null} />
        </section>
      </div>
    </div>
  );
}
