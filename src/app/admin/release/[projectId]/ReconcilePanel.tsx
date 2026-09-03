'use client';

/**
 * Match a folder of audio against the tracklist — or propose the tracklist
 * from it when the album is empty.
 *
 * Nothing is uploaded to do this. The matching is pure and runs here, so a
 * whole album folder can be scanned instantly and re-scanned freely while the
 * owner decides what is actually right.
 *
 * The panel's whole job is to make "safe" and "a guess" impossible to
 * confuse. Agreements are collapsed away. Every proposed title is EDITABLE and
 * every row is UNCHECKED by default, because a filename is not evidence of a
 * song's name — on this record `newspeak.wav` is "News Peak", and `rap.wav`
 * spent a while being called "Please". Nothing is written until a person ticks
 * it.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { reconcile, type ReconcileAction, type ReconcileTrack } from '@/lib/release/reconcile';
import { apiSend } from '../components/api';
import { Button, Chip, EmptyState, Panel, SectionTitle } from '../components/ui';
import type { TrackRow } from './types';

interface ApplyResult {
  renamed: string[];
  created: string[];
  refused: Array<{ title: string; reason: string }>;
}

/** Strip the album-root folder so it is never read as a song title. */
function relativePaths(files: File[]): string[] {
  const raw = files.map(
    (f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
  );
  const roots = new Set(raw.map((p) => p.split('/')[0]));
  if (roots.size !== 1) return raw;
  return raw.map((p) => p.split('/').slice(1).join('/') || p);
}

export default function ReconcilePanel({
  projectId,
  tracks,
  onChanged,
}: {
  projectId: string;
  tracks: TrackRow[];
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState<string[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);

  const reconcileTracks: ReconcileTrack[] = useMemo(
    () => tracks.map((t) => ({ id: t.id, title: t.title, track_number: t.track_number })),
    [tracks]
  );

  const plan = useMemo(
    () => (paths ? reconcile(paths.map((path) => ({ path })), reconcileTracks) : null),
    [paths, reconcileTracks]
  );

  const pick = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    setPaths(relativePaths(Array.from(list)));
    setChosen(new Set());
    setTitles({});
    setResult(null);
    setError(null);
  }, []);

  /** A stable key per row — the file, or the track when there is no file. */
  const keyOf = (a: ReconcileAction) => a.file ?? `track:${a.trackId}`;
  const titleFor = (a: ReconcileAction) => titles[keyOf(a)] ?? a.proposedTitle ?? '';

  const toggle = (key: string) =>
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const apply = async () => {
    if (!plan) return;
    const actions = plan.actions
      .filter((a) => chosen.has(keyOf(a)) && titleFor(a).trim().length > 0)
      .map((a) =>
        a.kind === 'retitle'
          ? {
              kind: 'retitle' as const,
              trackId: a.trackId as string,
              fromTitle: a.currentTitle as string,
              toTitle: titleFor(a).trim(),
            }
          : { kind: 'create' as const, title: titleFor(a).trim() }
      );

    if (actions.length === 0) return;
    setBusy(true);
    try {
      setResult(
        await apiSend<ApplyResult>('/api/admin/release/reconcile', 'POST', { projectId, actions })
      );
      setChosen(new Set());
      setError(null);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decisions = plan?.actions.filter((a) => a.kind === 'retitle' || a.kind === 'create') ?? [];
  const agreed = plan?.actions.filter((a) => a.kind === 'link') ?? [];
  const missing = plan?.actions.filter((a) => a.kind === 'missing') ?? [];

  return (
    <div className="space-y-3">
      <SectionTitle
        hint="Point at a folder of audio. Nothing uploads — this compares names only, and writes only what you tick."
        action={
          <div className="flex gap-2">
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>
              {paths ? 'Scan another folder' : 'Scan a folder…'}
            </Button>
            {decisions.length > 0 && (
              <Button variant="primary" onClick={apply} disabled={busy || chosen.size === 0}>
                {busy ? 'Applying…' : `Apply ${chosen.size} change${chosen.size === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
        }
      >
        Sync names
      </SectionTitle>

      <input
        ref={inputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />

      {error && (
        <Panel className="p-3 border-red-900/60">
          <p className="text-red-300 text-xs">{error}</p>
        </Panel>
      )}

      {result && (
        <Panel className="p-3 border-emerald-900/50 space-y-1">
          {result.renamed.map((r) => (
            <p key={r} className="text-emerald-300 text-xs">renamed {r}</p>
          ))}
          {result.created.map((c) => (
            <p key={c} className="text-emerald-300 text-xs">created “{c}”</p>
          ))}
          {result.refused.map((r) => (
            <p key={r.title} className="text-amber-300 text-xs">skipped “{r.title}” — {r.reason}</p>
          ))}
          {result.renamed.length === 0 && result.created.length === 0 && result.refused.length === 0 && (
            <p className="text-[#b2a491] text-xs">Nothing changed.</p>
          )}
        </Panel>
      )}

      {!plan && (
        <EmptyState
          title="No folder scanned."
          body="Matches audio to the songs already here, or proposes a tracklist when the album is empty."
        />
      )}

      {plan && (
        <>
          <div className="flex flex-wrap gap-2">
            {plan.bulkCreate && <Chip tone="accent">album is empty — proposing a tracklist</Chip>}
            {agreed.length > 0 && <Chip tone="good">{agreed.length} already agree</Chip>}
            {decisions.length > 0 && <Chip tone="warn">{decisions.length} to decide</Chip>}
            {missing.length > 0 && (
              <Chip tone="neutral">
                {missing.length} song{missing.length === 1 ? '' : 's'} with no file
              </Chip>
            )}
          </div>

          {decisions.length === 0 ? (
            <Panel className="p-4 border-emerald-900/50">
              <p className="text-emerald-300 text-xs">
                Every file matches a song and every name agrees. Nothing to change.
              </p>
            </Panel>
          ) : (
            <Panel className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-xs">
                  <thead>
                    <tr className="border-b border-[#502d26]/60 text-[10px] uppercase tracking-wide text-[#726d6c]">
                      <th className="px-3 py-2 w-10"></th>
                      <th className="px-3 py-2 text-left">File</th>
                      <th className="px-3 py-2 text-left w-40">Track says</th>
                      <th className="px-3 py-2 text-left w-52">Set the title to</th>
                      <th className="px-3 py-2 text-left w-20">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((a) => {
                      const key = keyOf(a);
                      return (
                        <tr key={key} className="border-b border-[#502d26]/25 last:border-0">
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={chosen.has(key)}
                              onChange={() => toggle(key)}
                              disabled={busy}
                              className="accent-[#843c2d]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-[#ede8df] truncate max-w-[18rem]" title={a.file ?? ''}>
                              {a.file?.split('/').pop()}
                            </div>
                            <div className="text-[#726d6c] text-[10px]">{a.reason}</div>
                          </td>
                          <td className="px-3 py-2 text-[#b2a491]">
                            {a.currentTitle ?? <span className="text-[#726d6c]">— new song —</span>}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={titleFor(a)}
                              onChange={(e) => setTitles((t) => ({ ...t, [key]: e.target.value }))}
                              disabled={busy}
                              className="w-full rounded-lg border border-[#502d26]/60 bg-[#0d0c0a] px-2 py-1.5 text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Chip
                              tone={
                                a.kind === 'create' ? 'neutral' : a.confidence === 'weak' ? 'warn' : 'accent'
                              }
                            >
                              {a.kind === 'create' ? 'new' : a.confidence}
                            </Chip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {missing.length > 0 && (
            <details>
              <summary className="text-[#726d6c] text-xs cursor-pointer select-none">
                {missing.length} song{missing.length === 1 ? '' : 's'} in the tracklist with no file in this folder
              </summary>
              <ul className="mt-2 space-y-1">
                {missing.map((a) => (
                  <li key={a.trackId} className="text-[#b2a491] text-xs">• {a.currentTitle}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
