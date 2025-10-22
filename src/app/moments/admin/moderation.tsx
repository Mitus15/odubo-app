"use client";
import { useEffect, useState } from 'react';

export default function MomentsModeration({ galleryId }: { galleryId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  async function load() {
    const res = await fetch(`/api/moments/list?galleryId=${galleryId}&limit=50`);
    const data = (await res.json()) as any;
    setItems(data.photos || []);
    setSelected({});
  }

  useEffect(() => { load(); }, [galleryId]);

  function toggle(id: number) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function moderate(id: number, action: 'approve' | 'reject') {
    const res = await fetch('/api/moments/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    if (res.ok) load();
  }

  async function bulk(action: 'approve' | 'reject') {
    const ids = Object.keys(selected).filter(k => selected[Number(k)]).map(k => Number(k));
    await Promise.all(ids.map(id => fetch('/api/moments/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })));
    load();
  }

  return (
    <div>
      <h3 className="font-semibold mb-2">Moderation</h3>
      <div className="mb-3 flex gap-2">
        <button onClick={() => bulk('approve')} className="px-3 py-1 bg-green-600 rounded">Bulk Approve</button>
        <button onClick={() => bulk('reject')} className="px-3 py-1 bg-red-600 rounded">Bulk Reject</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map(i => (
          <div key={i.id} className="bg-black rounded overflow-hidden">
            <div className="p-2 flex items-center justify-between">
              <input type="checkbox" checked={!!selected[i.id]} onChange={() => toggle(i.id)} />
              <div className="text-sm text-[#b2a491]">{i.user_name || 'Anonymous'}</div>
            </div>
            <img src={i.thumbnail_url || i.r2_url} alt={i.original_filename || 'photo'} />
            <div className="flex gap-2 p-2">
              <button className="px-3 py-1 bg-green-600 rounded" onClick={() => moderate(i.id, 'approve')}>Approve</button>
              <button className="px-3 py-1 bg-red-600 rounded" onClick={() => moderate(i.id, 'reject')}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
