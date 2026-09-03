'use client';

/**
 * Ingest a finished album folder.
 *
 * The owner's albums live on disk as `<Song>/{logic files,mixes,masters}` with
 * generic filenames inside — thirty-nine files called `master.wav`,
 * `rough.wav`, `session.logicx`. Filing them by hand is an afternoon and a
 * mistake; the matcher reads the folder structure instead.
 *
 * Nothing is uploaded until the plan has been reviewed. The plan table is
 * editable because the matcher is deliberately conservative: where two masters
 * compete for one song it refuses to guess and asks here, rather than writing
 * a wrong pointer into the distributor's delivery record.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { planFolder, type IngestTrack, type PlannedFile } from '@/lib/release/ingest';
import { CLASS_LABELS, type FileClass } from '@/lib/release/types';
import { readAudioDuration, uploadMultipart } from '@/lib/uploads/multipartUpload';
import { apiFetch, apiSend } from '../components/api';
import { Button, Chip, EmptyState, Panel, SectionTitle, formatBytes } from '../components/ui';
import type { TrackRow } from './types';

interface Row extends PlannedFile {
  file: File;
  state: 'ready' | 'uploading' | 'done' | 'error' | 'skipped';
  progress: number;
  error?: string;
}

interface PieceRow {
  id: string;
  kind: string;
  track_id: string | null;
  title: string;
}

/** Drop the album-root segment so it is never tried as a song title. */
function relativePaths(files: File[]): string[] {
  const raw = files.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
  const roots = new Set(raw.map((p) => p.split('/')[0]));
  if (roots.size !== 1) return raw;
  return raw.map((p) => p.split('/').slice(1).join('/') || p);
}

export default function FolderIngest({
  projectId,
  tracks,
  onDone,
}: {
  projectId: string;
  tracks: TrackRow[];
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState<Array<{ path: string; reason: string }>>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const ingestTracks: IngestTrack[] = useMemo(
    () => tracks.map((t) => ({ id: t.id, title: t.title, track_number: t.track_number })),
    [tracks]
  );

  const pick = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const paths = relativePaths(files);
      const plan = planFolder(paths, ingestTracks);

      const byPath = new Map(paths.map((p, i) => [p, files[i]]));
      setRows(
        plan.files.map((planned) => ({
          ...planned,
          file: byPath.get(planned.path) as File,
          state: 'ready',
          progress: 0,
        }))
      );
      setSkipped(plan.skipped);
      setSummary(null);
      setError(null);
    },
    [ingestTracks]
  );

  const update = (path: string, patch: Partial<Row>) =>
    setRows((r) => r?.map((row) => (row.path === path ? { ...row, ...patch } : row)) ?? r);

  /**
   * One ship per song. Checking a box has to clear the others, or the last
   * write wins silently and the delivery record disagrees with the table.
   */
  const setShip = (path: string, ship: boolean) =>
    setRows((r) => {
      if (!r) return r;
      const target = r.find((row) => row.path === path);
      if (!target) return r;
      return r.map((row) =>
        row.path === path
          ? { ...row, ship }
          : ship && row.trackId && row.trackId === target.trackId
            ? { ...row, ship: false }
            : row
      );
    });

  const run = async () => {
    if (!rows) return;
    setRunning(true);
    setError(null);

    try {
      // Pieces are looked up once. Creating one per file would race and leave
      // duplicate track-master pieces behind.
      const { pieces } = await apiFetch<{ pieces: PieceRow[] }>(
        `/api/admin/release/pieces?projectId=${encodeURIComponent(projectId)}`
      );
      const byTrack = new Map(
        pieces.filter((p) => p.track_id).map((p) => [p.track_id as string, p.id])
      );
      const byKind = new Map(pieces.filter((p) => !p.track_id).map((p) => [p.kind, p.id]));

      const ensurePiece = async (row: Row): Promise<string | null> => {
        if (row.trackId) {
          const existing = byTrack.get(row.trackId);
          if (existing) return existing;
          const track = tracks.find((t) => t.id === row.trackId);
          const { piece } = await apiSend<{ piece: { id: string } }>(
            '/api/admin/release/pieces',
            'POST',
            {
              projectId,
              kind: 'track-master',
              title: track?.title ?? row.trackTitle ?? 'Song',
              trackId: row.trackId,
              sortOrder: track?.track_number ?? 0,
            }
          );
          byTrack.set(row.trackId, piece.id);
          return piece.id;
        }

        if (row.pieceKind === 'cover' || row.pieceKind === 'packaging' || row.pieceKind === 'promo') {
          const existing = byKind.get(row.pieceKind);
          if (existing) return existing;
          const { piece } = await apiSend<{ piece: { id: string } }>(
            '/api/admin/release/pieces',
            'POST',
            {
              projectId,
              kind: row.pieceKind,
              title: row.pieceKind === 'cover' ? 'Cover' : row.pieceKind === 'packaging' ? 'Packaging' : 'Promo',
            }
          );
          byKind.set(row.pieceKind, piece.id);
          return piece.id;
        }

        // No song, no obvious piece — the inbox is the honest place for it.
        return null;
      };

      let uploaded = 0;
      let shipped = 0;
      let failed = 0;

      for (const row of rows) {
        if (row.state === 'skipped') continue;
        update(row.path, { state: 'uploading', progress: 0 });
        try {
          const pieceId = await ensurePiece(row);

          // Read the length before upload — this is how `duration = 0` on all
          // 13 tracks gets fixed without anyone installing ffmpeg.
          const durationSeconds =
            row.fileCategory === 'audio-master' ? await readAudioDuration(row.file) : null;

          const result = await uploadMultipart<{ file: { id: string } | null }>({
            file: row.file,
            endpoint: '/api/admin/release/multipart',
            startPayload: {
              projectId,
              pieceId,
              class: row.fileClass,
              category: row.fileCategory,
            },
            completePayload: { durationSeconds },
            onProgress: (p) => update(row.path, { progress: p.percent }),
          });

          const fileId = result.complete?.file?.id;
          if (row.ship && fileId && pieceId) {
            await apiSend(`/api/admin/release/pieces/${pieceId}/ship`, 'POST', {
              fileId,
              durationSeconds,
            });
            shipped++;
          }

          uploaded++;
          update(row.path, { state: 'done', progress: 100 });
        } catch (err) {
          failed++;
          update(row.path, { state: 'error', error: (err as Error).message });
        }
      }

      setSummary(
        `${uploaded} file${uploaded === 1 ? '' : 's'} filed · ${shipped} master${shipped === 1 ? '' : 's'} flagged to ship${failed > 0 ? ` · ${failed} failed` : ''}`
      );
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const shipCount = rows?.filter((r) => r.ship).length ?? 0;
  const unmatched = rows?.filter((r) => !r.trackId && r.pieceKind === 'track-master').length ?? 0;

  return (
    <div className="space-y-3">
      <SectionTitle
        hint="Point at the finished album folder. The folder structure decides what each file is — nothing uploads until you have read the plan."
        action={
          <div className="flex gap-2">
            <Button onClick={() => inputRef.current?.click()} disabled={running}>
              {rows ? 'Pick another folder' : 'Choose folder…'}
            </Button>
            {rows && rows.length > 0 && (
              <Button variant="primary" onClick={run} disabled={running}>
                {running ? 'Filing…' : `File ${rows.length} file${rows.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
        }
      >
        Ingest a folder
      </SectionTitle>

      <input
        ref={inputRef}
        type="file"
        multiple
        // Non-standard but the only way to pick a directory in a browser.
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />

      {error && (
        <Panel className="p-3 border-red-900/60">
          <p className="text-red-300 text-xs">{error}</p>
        </Panel>
      )}

      {summary && (
        <Panel className="p-3 border-emerald-900/50">
          <p className="text-emerald-300 text-xs">{summary}</p>
        </Panel>
      )}

      {rows === null && (
        <EmptyState
          title="No folder chosen."
          body="Expected shape: one folder per song, with masters / mixes / logic files inside."
        />
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <Chip tone="neutral">{rows.length} files</Chip>
            <Chip tone={shipCount === tracks.length ? 'good' : 'warn'}>
              {shipCount}/{tracks.length} masters to ship
            </Chip>
            {unmatched > 0 && <Chip tone="warn">{unmatched} to the inbox</Chip>}
            {skipped.length > 0 && <Chip tone="neutral">{skipped.length} skipped</Chip>}
          </div>

          <Panel className="p-0 overflow-hidden">
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full min-w-[860px] text-xs">
                <thead className="sticky top-0 bg-[#1c1a19]">
                  <tr className="border-b border-[#502d26]/60 text-[10px] uppercase tracking-wide text-[#726d6c]">
                    <th className="px-3 py-2 text-left">File</th>
                    <th className="px-3 py-2 text-left w-44">Song</th>
                    <th className="px-3 py-2 text-left w-40">Tier</th>
                    <th className="px-3 py-2 text-center w-16">Ship</th>
                    <th className="px-3 py-2 text-right w-24">Size</th>
                    <th className="px-3 py-2 text-left w-24">State</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.path} className="border-b border-[#502d26]/25 last:border-0">
                      <td className="px-3 py-1.5">
                        <div className="text-[#ede8df] truncate max-w-[22rem]" title={row.path}>
                          {row.filename}
                        </div>
                        <div className="text-[#726d6c] text-[10px] truncate max-w-[22rem]" title={row.reason}>
                          {row.reason}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={row.trackId ?? ''}
                          onChange={(e) => update(row.path, { trackId: e.target.value || null })}
                          disabled={running}
                          className="w-full rounded-lg border border-[#502d26]/60 bg-[#0d0c0a] px-2 py-1 text-xs text-[#ede8df]"
                        >
                          <option value="">— inbox —</option>
                          {tracks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.track_number}. {t.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={row.fileClass}
                          onChange={(e) => update(row.path, { fileClass: e.target.value as FileClass })}
                          disabled={running}
                          className="w-full rounded-lg border border-[#502d26]/60 bg-[#0d0c0a] px-2 py-1 text-xs text-[#ede8df]"
                        >
                          {(Object.keys(CLASS_LABELS) as FileClass[]).map((c) => (
                            <option key={c} value={c}>
                              {CLASS_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={row.ship}
                          disabled={running || !row.trackId || row.fileCategory !== 'audio-master'}
                          onChange={(e) => setShip(row.path, e.target.checked)}
                          className="accent-[#843c2d]"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-[#726d6c] tabular-nums">
                        {formatBytes(row.file.size)}
                      </td>
                      <td className="px-3 py-1.5">
                        {row.state === 'uploading' ? (
                          <span className="text-[#b2a491] tabular-nums">{row.progress.toFixed(0)}%</span>
                        ) : row.state === 'done' ? (
                          <Chip tone="good">filed</Chip>
                        ) : row.state === 'error' ? (
                          <Chip tone="bad" title={row.error}>failed</Chip>
                        ) : (
                          <span className="text-[#726d6c]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
