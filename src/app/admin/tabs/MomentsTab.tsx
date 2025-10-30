"use client";
import { useMemo, useState } from 'react';
import Link from 'next/link';

// Placeholder data types
type Gallery = {
  id: string;
  title: string;
  date: string;
  code: string;
  featured?: boolean;
};

export default function MomentsTab() {
  const [items, setItems] = useState<Gallery[]>(() => [
    { id: 'g1', title: 'Studio Launch Night', date: 'Jul 02, 2025', code: 'LAUNCH25', featured: true },
    { id: 'g2', title: 'Harmattan House', date: 'Dec 18, 2024', code: 'HARM24' },
    { id: 'g3', title: 'City Lights', date: 'Sep 10, 2024', code: 'LIGHTS24' },
  ]);
  const featuredCount = useMemo(() => items.filter(i => i.featured).length, [items]);

  function toggleFeatured(id: string) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, featured: !i.featured } : i)));
  }
  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      alert('Code copied: ' + code);
    } catch {
      alert('Unable to copy.');
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#ede8df]">Moments Galleries</h2>
          <p className="text-sm text-[#b2a491]">Create and curate event galleries. Featured count: {featuredCount}</p>
        </div>
        <CreateEditButton onCreate={(g) => setItems(prev => [g, ...prev])} />
      </div>

      {/* List */}
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((g) => (
          <article key={g.id} className="rounded-2xl overflow-hidden border border-[#3b3733] bg-[#1f1e1d]">
            <div className="h-24 bg-gradient-to-br from-[#502d26] to-[#6b4c3b]" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[#ede8df] font-medium">{g.title}</div>
                  <div className="text-xs text-[#b2a491] mt-0.5">{g.date}</div>
                </div>
                <button
                  onClick={() => toggleFeatured(g.id)}
                  className={"px-2 py-1 text-xs rounded border " + (g.featured ? 'bg-[#ede8df] text-[#171616] border-transparent' : 'bg-[#171616] text-[#ede8df] border-[#3b3733]')}
                >
                  {g.featured ? 'Featured' : 'Make Featured'}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => copyCode(g.code)} className="px-3 py-2 rounded bg-[#302927] text-[#ede8df] hover:bg-[#2a2626] text-sm">Copy Code</button>
                <Link href={`/moments/capture?galleryId=${g.id}`} className="px-3 py-2 rounded bg-[#ede8df] text-[#171616] text-center text-sm">Open Capture</Link>
                <button className="px-3 py-2 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] text-sm">View Gallery</button>
                <CreateEditButton small gallery={g} onUpdate={(nu) => setItems(prev => prev.map(it => it.id === nu.id ? nu : it))} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CreateEditButton({ onCreate, onUpdate, gallery, small }: { onCreate?: (g: Gallery) => void; onUpdate?: (g: Gallery) => void; gallery?: Gallery; small?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={(small ? 'px-3 py-2 text-sm' : 'px-4 py-2') + ' rounded bg-[#502d26] text-[#ede8df] hover:bg-[#6b4c3b]'}
      >
        {gallery ? 'Edit' : 'Create Gallery'}
      </button>
      {open && (
        <GalleryModal
          initial={gallery}
          onClose={() => setOpen(false)}
          onSubmit={(g) => {
            setOpen(false);
            if (gallery && onUpdate) onUpdate(g);
            if (!gallery && onCreate) onCreate(g);
          }}
        />
      )}
    </>
  );
}

function GalleryModal({ initial, onClose, onSubmit }: { initial?: Gallery; onClose: () => void; onSubmit: (g: Gallery) => void }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || '');
  const [code, setCode] = useState(initial?.code || 'NEWCODE');
  const [featured, setFeatured] = useState(!!initial?.featured);

  function submit() {
    const id = initial?.id || 'g' + Math.random().toString(36).slice(2, 7);
    onSubmit({ id, title, date, code, featured });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl border border-[#3b3733] bg-[#1f1e1d] p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#ede8df]">{initial ? 'Edit Gallery' : 'Create Gallery'}</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-[#b2a491]">Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2" />
          </label>
          <label className="block text-sm text-[#b2a491]">Date
            <input value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2" />
          </label>
          <label className="block text-sm text-[#b2a491]">Join Code
            <input value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2" />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#ede8df]">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Featured
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-[#302927] text-[#ede8df]">Cancel</button>
          <button onClick={submit} className="px-4 py-2 rounded bg-[#ede8df] text-[#171616]">Save</button>
        </div>
      </div>
    </div>
  );
}
