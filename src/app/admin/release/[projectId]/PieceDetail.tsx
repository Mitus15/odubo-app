'use client';

import { useState } from 'react';

import type { WarehouseFile, WarehousePiece } from '@/lib/release/types';
import DocsPanel from '../components/DocsPanel';
import FileRow from '../components/FileRow';
import UploadDropzone from '../components/UploadDropzone';
import { Button, Chip, EmptyState, Panel, SectionTitle, formatDuration } from '../components/ui';
import PreviewLadder from '../components/PreviewLadder';
import type { TrackRow } from './types';

export default function PieceDetail({
  projectId,
  piece,
  track,
  files,
  shippedKey,
  onChanged,
  onClose,
}: {
  projectId: string;
  piece: WarehousePiece;
  track: TrackRow | null;
  files: WarehouseFile[];
  /** The r2_key currently flagged to ship for this song, if any. */
  shippedKey: string | null;
  onChanged: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Newest first is what the API returns; keep it. The owner re-uploads
  // freely and expects the most recent bounce at the top.
  const ready = files.filter((f) => f.status === 'ready');
  const working = ready.filter((f) => f.class === 'working');
  const masters = ready.filter((f) => f.class !== 'working');

  return (
    <Panel className="p-5 border-[#843c2d]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-medium">
            {track ? `${track.track_number}. ${piece.title}` : piece.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Chip tone="neutral">{piece.kind}</Chip>
            {track && (
              <>
                <Chip tone={track.audio_url ? 'good' : 'bad'}>
                  {track.audio_url ? `preview ${formatDuration(track.duration)}` : 'preview silent'}
                </Chip>
                {track.isrc ? (
                  <Chip tone="neutral">ISRC {track.isrc}</Chip>
                ) : (
                  <Chip tone="warn">no ISRC</Chip>
                )}
              </>
            )}
            {shippedKey && <Chip tone="good">master flagged</Chip>}
          </div>
        </div>
        <Button onClick={onClose}>Close</Button>
      </div>

      {error && <p className="text-red-300 text-xs mb-3">{error}</p>}
      {notice && <p className="text-amber-300 text-xs mb-3">{notice}</p>}

      {track && (
        <div className="mb-4">
          <PreviewLadder
            track={track}
            shippedFile={ready.find((f) => f.r2_key === shippedKey) ?? null}
          />
        </div>
      )}

      <UploadDropzone
        projectId={projectId}
        pieceId={piece.id}
        onUploaded={() => void onChanged()}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <SectionTitle hint="Mixes and masters. The commercial one is what goes to the distributor.">
            Masters
          </SectionTitle>
          {masters.length === 0 ? (
            <EmptyState title="No masters yet." />
          ) : (
            <ul className="space-y-2">
              {masters.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  isShipped={!!shippedKey && shippedKey === f.r2_key}
                  canShip={!!track}
                  onChanged={onChanged}
                  onError={setError}
                  onNotice={setNotice}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <SectionTitle hint="Sessions, stems, rough bounces. Re-upload freely — they pile up newest first.">
            Working files
          </SectionTitle>
          {working.length === 0 ? (
            <EmptyState title="Nothing here yet." />
          ) : (
            <ul className="space-y-2">
              {working.map((f) => (
                <FileRow key={f.id} file={f} onChanged={onChanged} onError={setError} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {track && (
        <div className="mt-6">
          <SectionTitle hint="What this song is about, who is in it, where it came from.">
            Notes on this song
          </SectionTitle>
          <DocsPanel projectId={projectId} trackId={track.id} />
        </div>
      )}
    </Panel>
  );
}
