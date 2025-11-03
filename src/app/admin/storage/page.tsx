"use client";
import { useEffect, useMemo, useState } from 'react';
import AdminNavigation from '@/components/AdminNavigation';

type R2Item = { key?: string | null; size?: number | null; lastModified?: string | Date | null };

export default function StorageAdminPage() {
  const [prefix, setPrefix] = useState<string>('');
  const [items, setItems] = useState<R2Item[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<string>('');
  const [tokenPresent, setTokenPresent] = useState<boolean>(true);

  useEffect(() => {
    // Fetch public base URL
    fetch('/api/admin/r2/base').then((r) => r.json()).then((d: any) => setBase(d?.base || '')); // non-blocking
    try { setTokenPresent(!!localStorage.getItem('token')); } catch {}
  }, []);

  function authHeaders() {
    try {
      const t = localStorage.getItem('token');
      return t ? { Authorization: `Bearer ${t}` } : {};
    } catch {
      return {} as Record<string, string>;
    }
  }

  async function list(token?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (prefix) params.set('prefix', prefix);
      if (token) params.set('token', token);
      const res = await fetch(`/api/admin/r2/list?${params.toString()}`, { headers: { ...authHeaders() } });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.error || 'List failed');
  setItems((prev) => (token ? [...prev, ...(data.items || [])] : data.items || []));
  setNextToken(data.nextToken || null);
    } catch (e: any) {
      setError(String(e?.message || 'List failed'));
    } finally {
      setLoading(false);
    }
  }

  function prettySize(bytes?: number | null) {
    if (!bytes && bytes !== 0) return '';
    const units = ['B','KB','MB','GB','TB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v = v / 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
  }

  async function deleteKey(key: string) {
    if (!confirm(`Delete ${key}?`)) return;
    const res = await fetch(`/api/admin/r2/object?key=${encodeURIComponent(key)}`, { method: 'DELETE', headers: { ...authHeaders() } });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) { alert(data?.error || 'Delete failed'); return; }
    setItems((list) => list.filter((i) => i.key !== key));
  }

  async function renameKey(oldKey: string) {
    const dest = prompt('Rename / Move to key:', oldKey);
    if (!dest || dest === oldKey) return;
    const res = await fetch('/api/admin/r2/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ source: oldKey, destination: dest }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data?.error || 'Move failed'); return; }
    setItems((list) => list.map((i) => (i.key === oldKey ? { ...i, key: dest } : i)));
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set('file', file);
    fd.set('prefix', prefix);
    const res = await fetch('/api/admin/r2/upload', { method: 'POST', headers: { ...authHeaders() }, body: fd as any });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) { alert(data?.error || 'Upload failed'); return; }
    // refresh list from start
    list(null);
  }

  const hasMore = useMemo(() => !!nextToken, [nextToken]);

  return (
    <div className="min-h-screen bg-[#0b0a0a] text-[#ede8df]">
      <AdminNavigation />
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Storage</h1>
          {base && <span className="text-xs text-white/60">Base: {base}</span>}
          {!tokenPresent && (
            <span className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-300 border border-red-600/30">No auth token in browser — login required</span>
          )}
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
            <div className="flex-1 w-full">
              <label className="text-sm font-semibold">Prefix</label>
              <input className="mt-1 w-full rounded bg-black/30 border border-white/20 p-2" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. featured/" />
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-md bg-white/80 text-[#171616] font-semibold disabled:opacity-50" onClick={() => list(null)} disabled={loading}> {loading ? 'Loading…' : 'List'} </button>
              <label className="px-4 py-2 rounded-md bg-white/10 border border-white/20 cursor-pointer">
                <input type="file" className="hidden" onChange={uploadFile} /> Upload
              </label>
            </div>
          </div>
          {error && <div className="mt-3 text-red-300 bg-red-600/10 border border-red-600/30 p-3 rounded text-sm">{error}</div>}
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-white/70 border-b border-white/10">
            <div className="col-span-8">Key</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-2">Actions</div>
          </div>
          {items.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/60">No objects listed yet.</div>
          )}
          {items.map((it) => (
            <div key={String(it.key)} className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 text-sm">
              <div className="col-span-8 break-all">{it.key}</div>
              <div className="col-span-2">{prettySize(it.size || 0)}</div>
              <div className="col-span-2 flex gap-2">
                {base && it.key && (
                  <a className="text-white/80 hover:underline" href={`${base}/${it.key}`} target="_blank" rel="noreferrer">Open</a>
                )}
                {it.key && (
                  <button className="text-white/80 hover:underline" onClick={() => renameKey(it.key!)}>Rename</button>
                )}
                {it.key && (
                  <button className="text-red-300 hover:text-red-200" onClick={() => deleteKey(it.key!)}>Delete</button>
                )}
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="px-4 py-3">
              <button className="px-4 py-2 rounded-md bg-white/10 border border-white/20" onClick={() => list(nextToken)} disabled={loading}>Load more</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
