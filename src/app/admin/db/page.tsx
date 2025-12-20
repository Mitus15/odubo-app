"use client";
import { useEffect, useMemo, useState } from 'react';

function isReadOnly(sql: string) {
  return /^(\s*)(select|pragma)\b/i.test(sql || '');
}

export default function AdminDbPage() {
  const [sql, setSql] = useState<string>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1;");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenPresent, setTokenPresent] = useState<boolean>(true);

  useEffect(() => {
    // Light hint if no auth token is present (admin API expects authenticated request)
    try {
      const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      setTokenPresent(!!t);
    } catch {}
  }, []);

  async function runSql() {
    setRunning(true);
    setError(null);
  setResult(null);
  setRows(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/admin/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sql }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Request failed');
        return;
      }
      setResult(data);
      if (data?.kind === 'rows') setRows(data.rows || []);
    } catch (e: any) {
      setError(String(e?.message || 'Unknown error'));
    } finally {
      setRunning(false);
    }
  }

  async function applyFeaturedSingleton() {
    if (!confirm('Apply/ensure Featured singleton schema and seed row?')) return;
    setRunning(true);
    setError(null);
  setResult(null);
  setRows(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/admin/db/apply-featured-singleton', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
  const data: any = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || 'Failed'); return; }
      setResult(data);
    } catch (e: any) {
      setError(String(e?.message || 'Unknown error'));
    } finally {
      setRunning(false);
    }
  }

  async function applyMomentsSchema() {
    if (!confirm('Apply Moments schema (galleries, gallery_photos, events)?')) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setRows(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/admin/db/apply-moments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || 'Failed'); return; }
      setResult(data);
    } catch (e: any) {
      setError(String(e?.message || 'Unknown error'));
    } finally {
      setRunning(false);
    }
  }

  const canWrite = useMemo(() => !isReadOnly(sql), [sql]);

  return (
    <div className="w-full min-h-screen text-[#ede8df]">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Database</h1>
          {!tokenPresent && (
            <span className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-300 border border-red-600/30">No auth token in browser — login required</span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur p-4">
              <label className="text-sm font-semibold">SQL</label>
              <textarea
                className="mt-2 w-full h-48 rounded-lg bg-black/30 border border-white/20 p-3 font-mono text-sm"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="SELECT * FROM featured_pages LIMIT 1;"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="px-4 py-2 rounded-md bg-white/80 text-[#171616] font-semibold disabled:opacity-50"
                  onClick={runSql}
                  disabled={running}
                  title="Run the SQL"
                >
                  {running ? 'Running…' : (canWrite ? 'Run (write)' : 'Run (read)')}
                </button>
                {canWrite && (
                  <span className="text-xs text-white/70">This will modify the database</span>
                )}
                <button
                  className="ml-auto px-3 py-2 rounded-md bg-white/10 border border-white/20"
                  onClick={() => setSql("SELECT slug, title, is_published, cover_image_url, background_video_url FROM featured_pages LIMIT 1;")}
                >
                  Load Featured sample
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur p-4">
              <div className="text-sm font-semibold mb-2">Quick actions</div>
              <button
                className="w-full px-4 py-2 rounded-md bg-white/80 text-[#171616] font-semibold disabled:opacity-50"
                onClick={applyFeaturedSingleton}
                disabled={running}
              >
                Ensure Featured singleton
              </button>
              <div className="text-xs text-white/70 mt-2">Creates table and seed row if missing; safe to run repeatedly.</div>

              <div className="mt-4" />
              <button
                className="w-full px-4 py-2 rounded-md bg-white/80 text-[#171616] font-semibold disabled:opacity-50"
                onClick={applyMomentsSchema}
                disabled={running}
              >
                Apply Moments schema
              </button>
              <div className="text-xs text-white/70 mt-2">Creates galleries, gallery_photos, events tables and indexes if missing; idempotent.</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/15 bg-white/5 backdrop-blur p-4">
          <div className="text-sm font-semibold mb-2">Result</div>
          {error && (
            <div className="text-red-300 bg-red-600/10 border border-red-600/30 p-3 rounded-lg text-sm whitespace-pre-wrap">{error}</div>
          )}
          {!error && rows && Array.isArray(rows) && rows.length > 0 && (
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-white/70 border-b border-white/10">
                    {Object.keys(rows[0] || {}).map((k) => (
                      <th key={k} className="text-left px-2 py-1">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      {Object.keys(rows[0] || {}).map((k) => (
                        <td key={k} className="px-2 py-1 text-white/90 whitespace-pre">{String(r?.[k] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!error && result && (!rows || rows.length === 0) && (
            <pre className="text-xs whitespace-pre-wrap text-white/90">{JSON.stringify(result, null, 2)}</pre>
          )}
          {!error && !result && (
            <div className="text-white/60 text-sm">No result yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
