'use client';

import { useEffect, useState } from 'react';

interface Option {
  handle: string;
  title: string;
  image: string | null;
}

/**
 * The piece the /links landing puts first. One choice, saved at once; "None"
 * shows the landing without a product. Change it with each release: the
 * piece worn in the current video.
 */
export default function FeaturedProductPicker() {
  const [products, setProducts] = useState<Option[]>([]);
  const [handle, setHandle] = useState<string>('');
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/featured-product')
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Sign in as an admin' : 'Could not load');
        return res.json() as Promise<{ handle: string | null; products: Option[] }>;
      })
      .then((data) => {
        setProducts(data.products);
        setHandle(data.handle || '');
        setState('idle');
      })
      .catch((e: Error) => {
        setMessage(e.message);
        setState('error');
      });
  }, []);

  const save = async (next: string) => {
    const previous = handle;
    setHandle(next);
    setState('saving');
    setMessage(null);
    try {
      const res = await fetch('/api/admin/featured-product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: next || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setState('saved');
      setTimeout(() => setState('idle'), 1600);
    } catch (e) {
      setHandle(previous);
      setMessage((e as Error).message);
      setState('error');
    }
  };

  const chosen = products.find((p) => p.handle === handle);

  return (
    <section className="glass-surface rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-14 h-14 rounded-lg bg-white/5 flex-shrink-0 overflow-hidden">
          {chosen?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={chosen.image} alt="" className="w-full h-full object-contain" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#ede8df]">Featured product</h2>
          <p className="text-xs text-[#b2a491] mt-0.5">
            First thing on <a href="/links" target="_blank" rel="noreferrer" className="underline underline-offset-2">/links</a>, where the bio link lands
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <select
          value={handle}
          onChange={(e) => save(e.target.value)}
          disabled={state === 'loading' || state === 'saving'}
          className="w-full sm:w-72 px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm disabled:opacity-50"
          aria-label="Featured product"
        >
          <option value="">None</option>
          {products.map((p) => (
            <option key={p.handle} value={p.handle}>{p.title}</option>
          ))}
        </select>
        <span className="text-xs w-14 text-[#b2a491]" aria-live="polite">
          {state === 'saving' ? 'Saving' : state === 'saved' ? 'Saved' : ''}
        </span>
      </div>
      {message && <p className="text-xs text-red-300/80 sm:w-full">{message}</p>}
    </section>
  );
}
