"use client";
import { useEffect, useState } from 'react';

export default function MomentsModeration({ galleryId }: { galleryId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('authToken')) : null;
  const [loading, setLoading] = useState(false);
  const [actionIds, setActionIds] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'hidden'>('all');
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  async function load() {
    if (!galleryId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/moments/list?galleryId=${encodeURIComponent(galleryId)}&limit=50`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include'
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error((data && data.error) ? data.error : 'Failed to load');
      setItems(data.photos || []);
      setSelected({});
    } catch (e) {
      console.error('Load moderation list failed', e);
      setBanner({ type: 'error', message: (e as any)?.message || 'Failed to load photos' });
    }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [galleryId]);

  function toggle(id: number) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function moderate(id: number, action: 'approve' | 'reject') {
    try {
      setActionIds(prev => ({ ...prev, [id]: true }));
      const res = await fetch('/api/moments/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id, action }),
        credentials: 'include'
      });
      if (!res.ok) {
        const data: any = await res.json().catch(() => ({}));
        throw new Error((data && data.error) ? data.error : 'Moderation failed');
      }
      load();
      setBanner({ type: 'success', message: `Photo ${action === 'approve' ? 'approved' : 'hidden'}.` });
    } catch (e) {
      console.error('Moderate failed', e);
      setBanner({ type: 'error', message: 'You need admin access to moderate.' });
    }
    finally { setActionIds(prev => ({ ...prev, [id]: false })); }
  }

  async function deletePhoto(id: number) {
    if (!confirm('Delete this photo permanently?')) return;
    try {
      setActionIds(prev => ({ ...prev, [id]: true }));
  const res = await fetch(`/api/moments/photos/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
      if (!res.ok) {
        const data: any = await res.json().catch(() => ({}));
        throw new Error((data && data.error) ? data.error : 'Delete failed');
      }
      load();
      setBanner({ type: 'success', message: 'Photo deleted.' });
    } catch (e) {
      console.error('Delete photo failed', e);
      setBanner({ type: 'error', message: 'You need admin access to delete photos.' });
    }
    finally { setActionIds(prev => ({ ...prev, [id]: false })); }
  }

  async function bulk(action: 'approve' | 'reject') {
    const ids = Object.keys(selected).filter(k => selected[Number(k)]).map(k => Number(k));
    try {
      ids.forEach(id => setActionIds(prev => ({ ...prev, [id]: true })));
      await Promise.all(ids.map(id => fetch('/api/moments/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id, action }),
        credentials: 'include'
      })));
      load();
      setBanner({ type: 'success', message: `Bulk ${action === 'approve' ? 'approve' : 'hide'} complete.` });
    } catch (e) {
      console.error('Bulk moderation failed', e);
      setBanner({ type: 'error', message: 'Bulk moderation requires admin access.' });
    }
    finally { ids.forEach(id => setActionIds(prev => ({ ...prev, [id]: false }))); }
  }

  const filteredItems = items.filter(i => {
    if (filter === 'approved') return i.moderated === 1;
    if (filter === 'pending') return i.moderated === null || i.moderated === undefined || i.moderated === 0;
    if (filter === 'hidden') return i.moderated === 2;
    return true;
  });

  return (
    <div>
      <h3 className="font-semibold mb-3">Moderation</h3>
      {banner && (
        <div className={`mb-3 rounded border px-3 py-2 text-sm ${banner.type === 'error' ? 'border-red-700 bg-red-900/30 text-red-200' : 'border-green-700 bg-green-900/30 text-green-200'}`}>
          <div className="flex justify-between items-start">
            <div>{banner.message}</div>
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-2">
          <button onClick={() => bulk('approve')} disabled={loading} className="px-3 py-1 bg-green-600 rounded disabled:opacity-40 flex items-center gap-1">
            Bulk Approve
          </button>
          <button onClick={() => bulk('reject')} disabled={loading} className="px-3 py-1 bg-red-600 rounded disabled:opacity-40 flex items-center gap-1">
            Bulk Hide
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto text-sm">
          <label>Filter:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="bg-[#171616] border border-[#3b3733] rounded px-2 py-1 text-[#ede8df]">
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="hidden">Hidden</option>
          </select>
          <span className="opacity-60">{filteredItems.length} / {items.length}</span>
        </div>
      </div>
      {loading && (
        <div className="mb-4 text-sm opacity-70 flex items-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#b2a491] border-t-transparent" /> Loading photos…
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredItems.map(i => {
          const busy = actionIds[i.id];
          return (
            <div key={i.id} className="bg-[#131212] border border-[#2a2725] rounded overflow-hidden flex flex-col">
              <div className="p-2 flex items-center justify-between gap-2">
                <input type="checkbox" disabled={busy} checked={!!selected[i.id]} onChange={() => toggle(i.id)} />
                <div className="text-xs text-[#b2a491] truncate max-w-[120px]">{i.user_name || 'Anonymous'}</div>
                {busy && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#b2a491] border-t-transparent" />}
              </div>
              <div className="aspect-[3/4] bg-black flex items-center justify-center overflow-hidden relative">
                <img src={i.thumbnail_url || i.r2_url} alt={i.original_filename || 'photo'} className="object-cover w-full h-full" />
                {i.moderated === 2 && (
                  <span className="absolute top-1 left-1 text-[10px] px-2 py-0.5 rounded bg-red-700/80 backdrop-blur border border-red-800 text-red-100">Hidden</span>
                )}
                {i.moderated === 1 && (
                  <span className="absolute top-1 right-1 text-[10px] px-2 py-0.5 rounded bg-emerald-700/80 backdrop-blur border border-emerald-800 text-emerald-100">Approved</span>
                )}
                {(i.moderated === null || i.moderated === undefined || i.moderated === 0) && (
                  <span className="absolute bottom-1 left-1 text-[10px] px-2 py-0.5 rounded bg-yellow-700/70 backdrop-blur border border-yellow-800 text-yellow-100">Pending</span>
                )}
              </div>
              <div className="flex gap-1 p-2 mt-auto">
                <button disabled={busy} className="px-2 py-1 bg-green-600 rounded text-xs disabled:opacity-40" onClick={() => moderate(i.id, 'approve')}>Approve</button>
                <button disabled={busy} className="px-2 py-1 bg-yellow-700 rounded text-xs disabled:opacity-40" onClick={() => moderate(i.id, 'reject')}>Hide</button>
                <button disabled={busy} className="ml-auto px-2 py-1 bg-red-700 rounded text-xs disabled:opacity-40" onClick={() => deletePhoto(i.id)}>Delete</button>
              </div>
            </div>
          );
        })}
        {!loading && filteredItems.length === 0 && (
          <div className="col-span-full text-sm opacity-60">No photos match this filter.</div>
        )}
      </div>
    </div>
  );
}
