'use client';

/**
 * The delivery sheet — the thing the album actually ships on.
 *
 * Validation runs on every keystroke rather than on save, because the point is
 * not to report a verdict at the end: it is to stop a malformed ISRC from ever
 * being typed. Errors block the export; warnings never do, since a blank
 * identifier is the normal state before a distributor issues one.
 *
 * Editing is local until "Save". The route diffs, so a save writes only the
 * cells that changed — and it cannot touch the ship pointer at all.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildDistributorCsv, csvFilename, type CsvRelease, type CsvTrack } from '@/lib/release/distributorCsv';
import { validateRelease, type ValidationIssue } from '@/lib/release/releaseValidation';
import { apiFetch, apiSend } from '../components/api';
import { Button, Chip, Panel, SectionTitle, Spinner, formatDuration } from '../components/ui';

interface DeliveryPayload {
  release: (CsvRelease & { id: string; status: string; distributor: string | null }) | null;
  tracks: CsvTrack[];
}

/** Bare input in the admin palette — the grid needs a lot of these. */
function Cell({
  value,
  onChange,
  placeholder,
  invalid,
  align = 'left',
  width,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  align?: 'left' | 'right';
  width?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={width ? { width } : undefined}
      className={`w-full rounded-lg border bg-[#0d0c0a] px-2 py-1.5 text-xs text-[#ede8df]
        placeholder:text-[#4a4443] focus:outline-none focus:border-[#843c2d]
        ${align === 'right' ? 'text-right tabular-nums' : ''}
        ${invalid ? 'border-red-800/80' : 'border-[#502d26]/60'}`}
    />
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-[#726d6c] mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function DeliveryGrid({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DeliveryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const payload = await apiFetch<DeliveryPayload>(
        `/api/admin/release/delivery?projectId=${encodeURIComponent(projectId)}`
      );
      setData(payload);
      setDirty(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRelease = (field: keyof CsvRelease, value: string) => {
    setData((d) => (d?.release ? { ...d, release: { ...d.release, [field]: value } } : d));
    setDirty(true);
  };

  const setTrack = (id: string, field: keyof CsvTrack, value: string | number | null) => {
    setData((d) =>
      d ? { ...d, tracks: d.tracks.map((t) => (t.id === id ? { ...t, [field]: value } : t)) } : d
    );
    setDirty(true);
  };

  const validation = useMemo(() => {
    if (!data?.release) return null;
    return validateRelease(data.release, data.tracks);
  }, [data]);

  const issuesByTrack = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const issue of validation?.issues ?? []) {
      if (issue.severity !== 'error' || !issue.trackId) continue;
      const set = map.get(issue.trackId) ?? new Set<string>();
      set.add(issue.field);
      map.set(issue.trackId, set);
    }
    return map;
  }, [validation]);

  const bad = (trackId: string, field: string) => issuesByTrack.get(trackId)?.has(field) ?? false;

  const save = async () => {
    if (!data?.release) return;
    setSaving(true);
    try {
      const payload = await apiSend<DeliveryPayload>('/api/admin/release/delivery', 'PATCH', {
        projectId,
        release: data.release,
        tracks: data.tracks,
      });
      setData(payload);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Build the file in the browser and hand it over. The sheet is small, and a
   * server round trip would only add a way for the export to disagree with
   * what the grid just validated.
   */
  const exportCsv = () => {
    if (!data?.release) return;
    const csv = buildDistributorCsv(data.release, data.tracks);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename(data.release);
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error && !data) {
    return (
      <Panel className="p-4 border-red-900/60">
        <p className="text-red-300 text-sm">{error}</p>
      </Panel>
    );
  }
  if (!data) {
    return (
      <Panel className="p-8 flex justify-center">
        <Spinner />
      </Panel>
    );
  }
  if (!data.release) {
    return (
      <Panel className="p-6">
        <p className="text-[#b2a491] text-sm">
          No delivery release exists for this project yet.
        </p>
      </Panel>
    );
  }

  const r = data.release;
  const releaseErrors = new Set(
    (validation?.issues ?? []).filter((i) => i.severity === 'error' && !i.trackId).map((i) => i.field)
  );

  return (
    <div className="space-y-4">
      <SectionTitle
        hint="What the distributor receives. There is no API — this spreadsheet is the deliverable."
        action={
          <div className="flex items-center gap-2">
            {savedAt && !dirty && <span className="text-[#726d6c] text-[11px]">saved {savedAt}</span>}
            <Button onClick={save} disabled={saving || !dirty} variant={dirty ? 'primary' : 'ghost'}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Button>
            <Button
              onClick={exportCsv}
              disabled={!validation?.canExport}
              title={
                validation?.canExport
                  ? 'Download the delivery sheet'
                  : 'Fix the errors below before exporting'
              }
            >
              Export CSV ↓
            </Button>
          </div>
        }
      >
        The delivery sheet
      </SectionTitle>

      {error && (
        <Panel className="p-3 border-red-900/60">
          <p className="text-red-300 text-xs">{error}</p>
        </Panel>
      )}

      {/* ---- release-level fields ---- */}
      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Labelled label="Release title">
            <Cell value={r.title ?? ''} onChange={(v) => setRelease('title', v)} invalid={releaseErrors.has('title')} />
          </Labelled>
          <Labelled label="Artist">
            <Cell value={r.artist_name ?? ''} onChange={(v) => setRelease('artist_name', v)} invalid={releaseErrors.has('artist_name')} />
          </Labelled>
          <Labelled label="Label">
            <Cell value={r.label_name ?? ''} onChange={(v) => setRelease('label_name', v)} placeholder="self-released" />
          </Labelled>
          <Labelled label="UPC">
            <Cell
              value={r.upc ?? ''}
              onChange={(v) => setRelease('upc', v)}
              placeholder="issued by the distributor"
              invalid={releaseErrors.has('upc')}
            />
          </Labelled>
          <Labelled label="Release date">
            <Cell type="date" value={r.distribution_release_date ?? ''} onChange={(v) => setRelease('distribution_release_date', v)} invalid={releaseErrors.has('distribution_release_date')} />
          </Labelled>
          <Labelled label="Genre">
            <Cell value={r.genre ?? ''} onChange={(v) => setRelease('genre', v)} placeholder="Hip-Hop" />
          </Labelled>
          <Labelled label="© line (composition)">
            <Cell value={r.copyright_line ?? ''} onChange={(v) => setRelease('copyright_line', v)} placeholder="© 2026 Mani Odubo" />
          </Labelled>
          <Labelled label="℗ line (recording)">
            <Cell value={r.phonographic_line ?? ''} onChange={(v) => setRelease('phonographic_line', v)} placeholder="℗ 2026 Mani Odubo" />
          </Labelled>
        </div>
      </Panel>

      {/* ---- the tracks ---- */}
      <Panel className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-[#502d26]/60 text-[10px] uppercase tracking-wide text-[#726d6c]">
                <th className="px-3 py-2 text-left w-12">#</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left w-40">Artist</th>
                <th className="px-3 py-2 text-left w-36">ISRC</th>
                <th className="px-3 py-2 text-right w-20">Length</th>
                <th className="px-3 py-2 text-left w-44">Writers</th>
                <th className="px-3 py-2 text-center w-20">Master</th>
              </tr>
            </thead>
            <tbody>
              {data.tracks.map((t) => (
                <tr key={t.id} className="border-b border-[#502d26]/30 last:border-0">
                  <td className="px-3 py-1.5">
                    <Cell
                      value={String(t.track_number ?? '')}
                      onChange={(v) => setTrack(t.id, 'track_number', v === '' ? null : Number(v))}
                      align="right"
                      invalid={bad(t.id, 'track_number')}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Cell value={t.title ?? ''} onChange={(v) => setTrack(t.id, 'title', v)} invalid={bad(t.id, 'title')} />
                  </td>
                  <td className="px-3 py-1.5">
                    <Cell value={t.artist_name ?? ''} onChange={(v) => setTrack(t.id, 'artist_name', v)} invalid={bad(t.id, 'artist_name')} />
                  </td>
                  <td className="px-3 py-1.5">
                    <Cell
                      value={t.isrc ?? ''}
                      onChange={(v) => setTrack(t.id, 'isrc', v)}
                      placeholder="not issued"
                      invalid={bad(t.id, 'isrc')}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right text-[#726d6c] tabular-nums">
                    {formatDuration(t.duration_seconds)}
                  </td>
                  <td className="px-3 py-1.5">
                    <Cell
                      value={writersToText(t.composers)}
                      onChange={(v) => setTrack(t.id, 'composers', textToWriters(v))}
                      placeholder="Name; Name"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {t.audio_r2_key ? (
                      <Chip tone="good" title={t.audio_r2_key}>shipped</Chip>
                    ) : (
                      <Chip tone="warn" title="Flag a master on the song's piece above">none</Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---- what is wrong, and what is merely unfinished ---- */}
      {validation && <IssueList issues={validation.issues} canExport={validation.canExport} />}
    </div>
  );
}

function IssueList({ issues, canExport }: { issues: ValidationIssue[]; canExport: boolean }) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');

  if (issues.length === 0) {
    return (
      <Panel className="p-4 border-emerald-900/50">
        <p className="text-emerald-300 text-xs">
          The sheet is complete. Nothing is missing and nothing is malformed.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="p-4">
      <div className="flex items-center gap-2 mb-3">
        {errors.length > 0 && <Chip tone="bad">{errors.length} blocking</Chip>}
        {warns.length > 0 && <Chip tone="warn">{warns.length} to finish</Chip>}
        {canExport && <Chip tone="good">export allowed</Chip>}
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 mb-3">
          {errors.map((i, n) => (
            <li key={`e${n}`} className="text-red-300 text-xs">• {i.message}</li>
          ))}
        </ul>
      )}

      {warns.length > 0 && (
        <details>
          <summary className="text-amber-300/90 text-xs cursor-pointer select-none">
            {warns.length} thing{warns.length === 1 ? '' : 's'} still to fill in — these do not block the export
          </summary>
          <ul className="space-y-1 mt-2">
            {warns.map((i, n) => (
              <li key={`w${n}`} className="text-[#b2a491] text-xs">• {i.message}</li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

/** Writers are stored as a JSON array but typed as "A; B". */
function writersToText(raw: string | null): string {
  if (!raw) return '';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).join('; ');
  } catch {
    /* a plain string is fine */
  }
  return raw;
}

function textToWriters(text: string): string | null {
  const names = text.split(';').map((s) => s.trim()).filter(Boolean);
  return names.length > 0 ? JSON.stringify(names) : null;
}
