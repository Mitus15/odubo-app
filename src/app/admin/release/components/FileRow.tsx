'use client';

import { useState } from 'react';

import type { WarehouseFile, WarehousePiece } from '@/lib/release/types';
import { CLASS_LABELS, FILE_CATEGORIES, FILE_CLASSES, type FileCategory, type FileClass } from '@/lib/release/types';
import { apiFetch, apiSend } from './api';
import { Button, Chip, formatBytes } from './ui';

/**
 * One file, with the three things the owner ever wants to do to it: hear or
 * see it, re-file it, or get rid of it.
 */
export default function FileRow({
  file,
  pieces,
  isShipped,
  canShip,
  onChanged,
  onError,
  onNotice,
}: {
  file: WarehouseFile;
  /** When present, the file can be moved to another piece. */
  pieces?: WarehousePiece[];
  isShipped?: boolean;
  /** Set on a song piece: this file can be flagged as the one that ships. */
  canShip?: boolean;
  onChanged: () => void | Promise<void>;
  onError: (message: string) => void;
  onNotice?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const ship = async () => {
    setBusy(true);
    try {
      const out = await apiSend<{ warning: string | null; previewUpdated: boolean }>(
        `/api/admin/release/pieces/${file.piece_id}/ship`,
        'POST',
        { fileId: file.id }
      );
      if (out.warning) onNotice?.(out.warning);
      await onChanged();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unship = async () => {
    setBusy(true);
    try {
      await apiSend(`/api/admin/release/pieces/${file.piece_id}/ship`, 'DELETE');
      await onChanged();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await apiSend(`/api/admin/release/files/${file.id}`, 'PATCH', body);
      await onChanged();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    setBusy(true);
    try {
      const body = await apiFetch<{ url: string }>(`/api/admin/release/files/${file.id}/url`);
      window.open(body.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${file.original_filename}? This removes the stored file too.`)) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/release/files/${file.id}`, 'DELETE');
      await onChanged();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-[#502d26]/40 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#ede8df] truncate" title={file.original_filename}>
            {file.original_filename}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip tone={file.class === 'commercial' ? 'accent' : 'neutral'}>
              {CLASS_LABELS[file.class]}
            </Chip>
            <Chip tone="neutral">{file.category}</Chip>
            {isShipped && <Chip tone="good">shipping</Chip>}
            {file.status !== 'ready' && <Chip tone="warn">{file.status}</Chip>}
            <span className="text-[10px] text-[#726d6c]">{formatBytes(file.size_bytes)}</span>
            <span className="text-[10px] text-[#726d6c]">
              {file.uploaded_at?.slice(0, 10)}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {canShip &&
            (isShipped ? (
              <Button onClick={unship} disabled={busy} title="Stop delivering this file">
                Unship
              </Button>
            ) : (
              <Button
                onClick={ship}
                disabled={busy || file.status !== 'ready'}
                variant="primary"
                title="Deliver this file, and let the preview play it"
              >
                Ship this
              </Button>
            ))}
          <Button onClick={open} disabled={busy || file.status !== 'ready'}>
            Open
          </Button>
          <Button onClick={remove} disabled={busy} variant="danger">
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <select
          value={file.class}
          disabled={busy}
          onChange={(e) => patch({ class: e.target.value as FileClass })}
          className="rounded-lg border border-[#502d26]/60 bg-[#0d0c0a] px-2 py-1 text-[11px] text-[#b2a491]"
        >
          {FILE_CLASSES.map((c) => (
            <option key={c} value={c}>
              {CLASS_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={file.category}
          disabled={busy}
          onChange={(e) => patch({ category: e.target.value as FileCategory })}
          className="rounded-lg border border-[#502d26]/60 bg-[#0d0c0a] px-2 py-1 text-[11px] text-[#b2a491]"
        >
          {FILE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {pieces && (
          <select
            value={file.piece_id ?? ''}
            disabled={busy}
            onChange={(e) => patch({ pieceId: e.target.value || null })}
            className="rounded-lg border border-[#502d26]/60 bg-[#0d0c0a] px-2 py-1 text-[11px] text-[#b2a491]"
          >
            <option value="">Inbox (no piece)</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </div>
    </li>
  );
}
