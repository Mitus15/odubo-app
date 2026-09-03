'use client';

import { useCallback, useRef, useState } from 'react';

import { readAudioDuration, uploadMultipart } from '@/lib/uploads/multipartUpload';
import {
  CLASS_LABELS,
  FILE_CATEGORIES,
  FILE_CLASSES,
  type FileCategory,
  type FileClass,
} from '@/lib/release/types';
import { Button, Chip, formatBytes } from './ui';

interface Queued {
  file: File;
  progress: number;
  state: 'waiting' | 'uploading' | 'done' | 'error';
  error?: string;
}

/**
 * Guess the tier and category from the file itself, so the common case needs
 * no thinking. The owner can override before uploading — these are defaults,
 * not decisions.
 */
function guess(file: File): { fileClass: FileClass; category: FileCategory } {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() ?? '';

  if (['logicx', 'als', 'ptx', 'flp', 'cpr', 'band'].includes(ext) || /session|stems?/.test(name)) {
    return { fileClass: 'working', category: 'daw-project' };
  }
  if (ext === 'zip' && /logic|session|project|stems?/.test(name)) {
    return { fileClass: 'working', category: 'daw-project' };
  }
  if (['wav', 'aif', 'aiff', 'flac'].includes(ext)) {
    // Lossless usually means a master; "mix"/"rough" says otherwise.
    const isRough = /mix|rough|demo|draft|bounce/.test(name);
    return { fileClass: isRough ? 'working' : 'master', category: 'audio-master' };
  }
  if (['mp3', 'm4a', 'aac', 'ogg'].includes(ext)) {
    return { fileClass: 'working', category: 'audio-master' };
  }
  if (['psd', 'ai', 'sketch', 'fig', 'tif', 'tiff'].includes(ext)) {
    return { fileClass: 'working', category: 'artwork-source' };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return { fileClass: 'master', category: 'preview-image' };
  }
  if (['mp4', 'mov', 'm4v', 'webm'].includes(ext)) {
    return { fileClass: 'master', category: 'video' };
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) {
    return { fileClass: 'working', category: 'document' };
  }
  return { fileClass: 'working', category: 'other' };
}

export default function UploadDropzone({
  projectId,
  pieceId,
  onUploaded,
}: {
  projectId: string;
  pieceId: string | null;
  /** Fired once per finished file, with the duration if one could be read. */
  onUploaded: (info: { fileId: string; durationSeconds: number | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [overrideClass, setOverrideClass] = useState<FileClass | ''>('');
  const [overrideCategory, setOverrideCategory] = useState<FileCategory | ''>('');
  const [dragging, setDragging] = useState(false);

  const run = useCallback(
    async (files: File[]) => {
      setQueue(files.map((file) => ({ file, progress: 0, state: 'waiting' as const })));

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const guessed = guess(file);
        const fileClass = overrideClass || guessed.fileClass;
        const category = overrideCategory || guessed.category;

        setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, state: 'uploading' } : item)));

        try {
          // Read the duration locally before the bytes leave — no ffmpeg, and
          // it is the only chance to measure the original rather than a
          // transcode.
          const durationSeconds =
            category === 'audio-master' ? await readAudioDuration(file) : null;

          const result = await uploadMultipart<{
            file: { id: string } | null;
          }>({
            file,
            endpoint: '/api/admin/release/multipart',
            startPayload: { projectId, pieceId, class: fileClass, category },
            completePayload: { durationSeconds },
            onProgress: (p) =>
              setQueue((q) =>
                q.map((item, idx) => (idx === i ? { ...item, progress: p.percent } : item))
              ),
          });

          setQueue((q) =>
            q.map((item, idx) => (idx === i ? { ...item, state: 'done', progress: 100 } : item))
          );
          const fileId = result.complete?.file?.id;
          if (fileId) onUploaded({ fileId, durationSeconds });
        } catch (err) {
          setQueue((q) =>
            q.map((item, idx) =>
              idx === i ? { ...item, state: 'error', error: (err as Error).message } : item
            )
          );
        }
      }
    },
    [onUploaded, overrideCategory, overrideClass, pieceId, projectId]
  );

  const pick = (list: FileList | null) => {
    if (!list?.length) return;
    void run(Array.from(list));
  };

  const active = queue.some((q) => q.state === 'uploading' || q.state === 'waiting');

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={overrideClass}
          onChange={(e) => setOverrideClass(e.target.value as FileClass | '')}
          className="rounded-xl border border-[#502d26]/60 bg-[#0d0c0a] px-3 py-1.5 text-xs text-[#b2a491]"
        >
          <option value="">Tier: detect</option>
          {FILE_CLASSES.map((c) => (
            <option key={c} value={c}>
              {CLASS_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={overrideCategory}
          onChange={(e) => setOverrideCategory(e.target.value as FileCategory | '')}
          className="rounded-xl border border-[#502d26]/60 bg-[#0d0c0a] px-3 py-1.5 text-xs text-[#b2a491]"
        >
          <option value="">Kind: detect</option>
          {FILE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border border-dashed p-6 text-center transition-colors ${
          dragging ? 'border-[#843c2d] bg-[#843c2d]/10' : 'border-[#502d26]/60 hover:border-[#843c2d]/70'
        }`}
      >
        <p className="text-sm text-[#b2a491]">
          {active ? 'Uploading…' : 'Drop files here, or click to choose'}
        </p>
        <p className="text-[11px] text-[#726d6c] mt-1">
          Straight to storage in 50MB parts — size is not a problem. Logic projects are
          folders, so compress to .zip in Finder first.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      {queue.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {queue.map((item, i) => (
            <li
              key={`${item.file.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#502d26]/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#ede8df] truncate">{item.file.name}</p>
                <div className="mt-1 h-1 rounded-full bg-[#302927] overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      item.state === 'error' ? 'bg-red-700' : 'bg-[#843c2d]'
                    }`}
                    style={{ width: `${item.state === 'done' ? 100 : item.progress}%` }}
                  />
                </div>
                {item.error && <p className="text-[10px] text-red-300 mt-1">{item.error}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-[10px] text-[#726d6c]">{formatBytes(item.file.size)}</span>
                {item.state === 'done' && <Chip tone="good">done</Chip>}
                {item.state === 'error' && <Chip tone="bad">failed</Chip>}
                {item.state === 'uploading' && (
                  <span className="text-[10px] text-[#b2a491] tabular-nums">
                    {item.progress.toFixed(0)}%
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {queue.length > 0 && !active && (
        <div className="mt-2">
          <Button onClick={() => setQueue([])}>Clear</Button>
        </div>
      )}
    </div>
  );
}
