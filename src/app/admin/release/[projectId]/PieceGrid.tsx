'use client';

import type { WarehouseFile, WarehousePiece } from '@/lib/release/types';
import { Chip, formatBytes, formatDuration } from '../components/ui';
import type { TrackRow } from './types';

const KIND_LABELS: Record<string, string> = {
  cover: 'Cover',
  vinyl: 'Vinyl',
  packaging: 'Packaging',
  'track-master': 'Song',
  promo: 'Promo',
  other: 'Other',
};

export default function PieceGrid({
  pieces,
  tracks,
  filesByPiece,
  shipped,
  selectedId,
  onSelect,
}: {
  pieces: WarehousePiece[];
  tracks: TrackRow[];
  filesByPiece: Map<string, WarehouseFile[]>;
  shipped: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const trackById = new Map(tracks.map((t) => [t.id, t]));

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {pieces.map((piece) => {
        const files = filesByPiece.get(piece.id) ?? [];
        const ready = files.filter((f) => f.status === 'ready');
        const uploading = files.filter((f) => f.status === 'uploading');
        const track = piece.track_id ? trackById.get(piece.track_id) : null;
        const shipKey = piece.track_id ? shipped[piece.track_id] : undefined;
        const isSelected = selectedId === piece.id;

        return (
          <button
            key={piece.id}
            onClick={() => onSelect(piece.id)}
            className={`text-left rounded-2xl border bg-[#1c1a19] p-4 transition-colors ${
              isSelected
                ? 'border-[#843c2d]'
                : 'border-[#502d26]/60 hover:border-[#843c2d]/70'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#ede8df] truncate">
                  {track ? `${track.track_number}. ${piece.title}` : piece.title}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-[#726d6c] mt-0.5">
                  {KIND_LABELS[piece.kind] ?? piece.kind}
                </p>
              </div>
              {shipKey ? (
                <Chip tone="good" title="A commercial master is flagged to ship for this song">
                  ships
                </Chip>
              ) : piece.kind === 'track-master' ? (
                <Chip tone="bad" title="No master flagged to ship for this song">
                  no master
                </Chip>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Chip tone={ready.length ? 'neutral' : 'warn'}>
                {ready.length} file{ready.length === 1 ? '' : 's'}
              </Chip>
              {uploading.length > 0 && <Chip tone="warn">{uploading.length} uploading</Chip>}
              {track && (
                <Chip tone={track.audio_url ? 'good' : 'bad'} title="Does the preview have audio">
                  {track.audio_url ? formatDuration(track.duration) : 'silent'}
                </Chip>
              )}
            </div>

            {ready.length > 0 && (
              <p className="text-[10px] text-[#726d6c] mt-2 truncate">
                newest: {ready[0].original_filename} · {formatBytes(ready[0].size_bytes)}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
