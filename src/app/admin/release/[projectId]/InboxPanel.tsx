'use client';

import { useState } from 'react';

import type { WarehouseFile, WarehousePiece } from '@/lib/release/types';
import FileRow from '../components/FileRow';
import UploadDropzone from '../components/UploadDropzone';
import { EmptyState, Panel } from '../components/ui';

export default function InboxPanel({
  projectId,
  files,
  pieces,
  onChanged,
}: {
  projectId: string;
  files: WarehouseFile[];
  pieces: WarehousePiece[];
  onChanged: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel className="p-4">
      <UploadDropzone projectId={projectId} pieceId={null} onUploaded={() => void onChanged()} />

      {error && <p className="text-red-300 text-xs mt-3">{error}</p>}

      <div className="mt-4">
        {files.length === 0 ? (
          <EmptyState title="Nothing loose." body="Anything uploaded without a piece lands here." />
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                pieces={pieces}
                onChanged={onChanged}
                onError={setError}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
