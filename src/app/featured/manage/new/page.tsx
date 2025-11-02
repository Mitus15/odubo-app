"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewFeaturedPage() {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [venue, setVenue] = useState('');
  const [dateText, setDateText] = useState('');
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace(`/login?next=${encodeURIComponent('/featured/manage/new')}`); return; }
  }, [router]);

  // If a slug is entered, check if it already exists so we can show a quick link to Manage
  useEffect(() => {
    const s = slug.trim().toLowerCase();
    let t: any;
    if (!s) { setExists(false); return; }
    t = setTimeout(async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(`/api/featured/${s}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        setExists(res.ok);
      } catch {
        setExists(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  async function create() {
    if (!slug || !title) return;
    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const body = { slug: slug.trim().toLowerCase(), title: title.trim(), subtitle: note, venue, date_text: dateText };
      const res = await fetch('/api/featured', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Create failed');
      router.replace(`/featured/manage/${slug.trim().toLowerCase()}`);
    } catch (e) {
      console.error(e);
      alert('Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#0b0a0a] text-[#ede8df] px-4 py-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6">
        <h1 className="text-2xl font-bold">New Featured Project</h1>
        <p className="mt-2 text-sm text-white/70">After creating, you&apos;ll go to the Manage page where you can upload the cover image and background video, and add custom buttons. Moments is handled separately.</p>
        <div className="mt-6 space-y-4">
          <label className="block text-sm">Slug
            <input value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder="catching-light" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <label className="block text-sm">Title
            <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Catching Light" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <label className="block text-sm">Note
            <input value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Short note/subtitle" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm">Venue
              <input value={venue} onChange={(e)=>setVenue(e.target.value)} placeholder="TRU Art Gallery" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
            </label>
            <label className="block text-sm">Date
              <input value={dateText} onChange={(e)=>setDateText(e.target.value)} placeholder="November 15, 2025" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
            </label>
          </div>
        </div>
        <div className="mt-6 flex gap-2 items-center">
          <button onClick={create} disabled={saving || !slug || !title} className="rounded-md bg-white/80 text-[#171616] px-4 py-2 font-semibold">{saving ? 'Creating…' : 'Create'}</button>
          {exists && (
            <a href={`/featured/manage/${slug.trim().toLowerCase()}`} className="rounded-md bg-white/10 border border-white/20 px-4 py-2">Go to Manage</a>
          )}
        </div>
      </div>
    </div>
  );
}
