'use client';

import { useCallback, useEffect, useState } from 'react';

import { DOC_KINDS, type DocKind, type WarehouseDoc } from '@/lib/release/types';
import { apiFetch, apiSend } from './api';
import { Button, Chip, EmptyState, Spinner } from './ui';

/**
 * Self-contained notes panel: it owns its own fetching and writing so it can
 * be dropped in album-level (trackId null) or pinned to one song without the
 * parent knowing anything about docs.
 */
export default function DocsPanel({
  projectId,
  trackId,
}: {
  projectId: string;
  trackId: string | null;
}) {
  const [docs, setDocs] = useState<WarehouseDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<DocKind>('note');

  const query = trackId ? `trackId=${encodeURIComponent(trackId)}` : 'trackId=__album__';

  const load = useCallback(async () => {
    try {
      const body = await apiFetch<{ docs: WarehouseDoc[] }>(
        `/api/admin/release/docs?projectId=${projectId}&${query}`
      );
      setDocs(body.docs ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setSaving(true);
    try {
      const body = await apiSend<{ doc: WarehouseDoc | null }>(
        '/api/admin/release/docs',
        'POST',
        { projectId, trackId, kind: newKind, title, body: '' }
      );
      setNewTitle('');
      setComposing(false);
      await load();
      setOpenId(body.doc?.id ?? null);
      setDraft('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const save = async (id: string) => {
    setSaving(true);
    try {
      await apiSend(`/api/admin/release/docs/${id}`, 'PATCH', { body: draft });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await apiSend(`/api/admin/release/docs/${id}`, 'DELETE');
      if (openId === id) setOpenId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (docs === null) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#502d26]/60 bg-[#1c1a19] p-4">
      {error && <p className="text-red-300 text-xs mb-3">{error}</p>}

      {docs.length === 0 && !composing && (
        <EmptyState title="Nothing written down yet." />
      )}

      <ul className="space-y-2">
        {docs.map((doc) => {
          const isOpen = openId === doc.id;
          return (
            <li key={doc.id} className="rounded-xl border border-[#502d26]/40">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <button
                  className="flex items-center gap-2 min-w-0 text-left"
                  onClick={() => {
                    setOpenId(isOpen ? null : doc.id);
                    setDraft(doc.body ?? '');
                  }}
                >
                  <Chip tone="neutral">{doc.kind}</Chip>
                  <span className="text-xs text-[#ede8df] truncate">{doc.title}</span>
                </button>
                <Button variant="danger" onClick={() => remove(doc.id, doc.title)}>
                  Delete
                </Button>
              </div>

              {isOpen && (
                <div className="px-3 pb-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-[#502d26]/60 bg-[#0d0c0a] px-3 py-2 text-xs text-[#ede8df] leading-relaxed focus:outline-none focus:border-[#843c2d]"
                    placeholder="Write."
                  />
                  <div className="flex justify-end mt-2">
                    <Button variant="primary" onClick={() => save(doc.id)} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        {composing ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as DocKind)}
              className="rounded-lg border border-[#502d26]/60 bg-[#0d0c0a] px-2 py-1.5 text-[11px] text-[#b2a491]"
            >
              {DOC_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="Title"
              autoFocus
              className="flex-1 min-w-[12rem] rounded-lg border border-[#502d26]/60 bg-[#0d0c0a] px-3 py-1.5 text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
            />
            <Button variant="primary" onClick={create} disabled={saving || !newTitle.trim()}>
              Add
            </Button>
            <Button onClick={() => setComposing(false)}>Cancel</Button>
          </div>
        ) : (
          <Button onClick={() => setComposing(true)}>+ Write something</Button>
        )}
      </div>
    </div>
  );
}
