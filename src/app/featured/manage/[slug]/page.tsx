"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type FeaturedItem = {
  slug: string;
  title: string;
  subtitle?: string;
  date_text?: string;
  time_text?: string;
  venue?: string;
  moments_link?: string;
  cover_image_url?: string;
  background_video_url?: string;
  extra_links_json?: string;
  is_published?: number;
};

export default function ManageFeaturedPage() {
  const routeParams = useParams();
  const slug = String((routeParams as any)?.slug || '').toLowerCase();
  const router = useRouter();
  const [item, setItem] = useState<FeaturedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extraLinks, setExtraLinks] = useState<{ label: string; href: string }[]>([{ label: '', href: '' }]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);

  useEffect(() => {
    // Require signed-in user (token stored in localStorage by existing auth flows)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace(`/login?next=${encodeURIComponent(`/featured/manage/${slug}`)}`); return; }
    (async () => {
      try {
        const res = await fetch(`/api/featured/${slug}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error('Not found');
  const data: any = await res.json();
  const it: FeaturedItem = data.item as FeaturedItem;
        setItem(it);
        if (it?.extra_links_json) {
          try { setExtraLinks(JSON.parse(it.extra_links_json)); } catch {}
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  async function saveMeta() {
    if (!item) return;
    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const body: any = {
        title: item.title,
        subtitle: item.subtitle,
        date_text: item.date_text,
        time_text: item.time_text,
        venue: item.venue,
        moments_link: item.moments_link,
        // Persist all custom buttons (label + href)
        extra_links_json: JSON.stringify((extraLinks || []).filter(l => l.label && l.href)),
      };
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/featured/${slug}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Save failed');
      alert('Saved');
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: 'cover' | 'background', file: File) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('slug', slug);
    fd.append('kind', kind);
    try {
      kind === 'cover' ? setCoverUploading(true) : setBgUploading(true);
      const res = await fetch('/api/featured/upload', { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json().then((x:any)=>x);
      setItem(prev => prev ? { ...prev, [kind === 'cover' ? 'cover_image_url' : 'background_video_url']: url } : prev);
    } finally {
      kind === 'cover' ? setCoverUploading(false) : setBgUploading(false);
    }
  }

  async function removeAsset(kind: 'cover' | 'background') {
    if (!confirm(`Remove ${kind === 'cover' ? 'cover image' : 'background video'}?`)) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const qs = new URLSearchParams({ kind }).toString();
    const res = await fetch(`/api/featured/${slug}/asset?${qs}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) { alert('Failed to remove'); return; }
    setItem(prev => prev ? { ...prev, [kind === 'cover' ? 'cover_image_url' : 'background_video_url']: undefined } as any : prev);
  }

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#171616] text-[#ede8df]">Loading…</div>;
  if (!item) return <div className="min-h-screen grid place-items-center bg-[#171616] text-[#ede8df]">Not found</div>;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#0b0a0a] text-[#ede8df] px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6">
        <h1 className="text-2xl font-bold">Manage: {item.title} <span className="text-white/60">({slug})</span></h1>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">Title
            <input value={item.title} onChange={(e) => setItem({ ...(item as any), title: e.target.value })} className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <label className="block text-sm">Note
            <input value={item.subtitle || ''} onChange={(e) => setItem({ ...(item as any), subtitle: e.target.value })} className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <label className="block text-sm">Date Text
            <input value={item.date_text || ''} onChange={(e) => setItem({ ...(item as any), date_text: e.target.value })} className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <label className="block text-sm">Time Text
            <input value={item.time_text || ''} onChange={(e) => setItem({ ...(item as any), time_text: e.target.value })} placeholder="e.g., 7:00 PM" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <label className="block text-sm">Venue
            <input value={item.venue || ''} onChange={(e) => setItem({ ...(item as any), venue: e.target.value })} className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <label className="block text-sm md:col-span-2">Moments Link
            <input value={item.moments_link || ''} onChange={(e) => setItem({ ...(item as any), moments_link: e.target.value })} className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold mb-2">Buttons</div>
          <div className="space-y-2">
            {extraLinks.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={l.label} onChange={(e) => setExtraLinks(prev => prev.map((p, idx) => idx === i ? { ...p, label: e.target.value } : p))} placeholder="Button label (e.g., Apple Music)" className="flex-1 rounded-md bg-white/10 border border-white/20 px-3 py-2" />
                <input value={l.href} onChange={(e) => setExtraLinks(prev => prev.map((p, idx) => idx === i ? { ...p, href: e.target.value } : p))} placeholder="https://" className="flex-[2] rounded-md bg-white/10 border border-white/20 px-3 py-2" />
                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-white/10 border border-white/20"
                  onClick={() => setExtraLinks(prev => prev.filter((_, idx) => idx !== i))}
                  disabled={extraLinks.length <= 1}
                  title="Remove button"
                >
                  ✖
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="mt-2 px-3 py-2 rounded-md bg-white/80 text-[#171616] font-semibold"
                onClick={() => setExtraLinks(prev => prev.concat({ label: '', href: '' }))}
              >
                + Add Button
              </button>
              <div className="text-xs text-white/70 mt-1">All buttons are custom. Moments is handled separately below.</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-semibold mb-2">Cover Image</div>
            {item.cover_image_url && <img src={item.cover_image_url} alt="cover" className="mb-2 rounded-lg border border-white/20 max-h-80 w-full object-cover" />}
            <div className="flex items-center gap-2">
              <input id="cover-input" type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { await upload('cover', f); } catch (err) { alert('Upload failed'); console.error(err); } finally { (e.target as HTMLInputElement).value=''; } } }} />
              <button type="button" onClick={() => document.getElementById('cover-input')?.click()} disabled={coverUploading} className="rounded-md bg-white/80 text-[#171616] px-3 py-2 font-semibold">
                {coverUploading ? 'Uploading…' : (item.cover_image_url ? 'Replace' : 'Upload')}
              </button>
              {item.cover_image_url && (
                <button type="button" onClick={() => removeAsset('cover')} className="rounded-md bg-white/10 border border-white/20 px-3 py-2">Remove</button>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Background Video</div>
            {item.background_video_url && <video src={item.background_video_url} controls className="mb-2 rounded-lg border border-white/20 w-full max-h-96" />}
            <div className="flex items-center gap-2">
              <input id="bg-input" type="file" accept="video/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { await upload('background', f); } catch (err) { alert('Upload failed'); console.error(err); } finally { (e.target as HTMLInputElement).value=''; } } }} />
              <button type="button" onClick={() => document.getElementById('bg-input')?.click()} disabled={bgUploading} className="rounded-md bg-white/80 text-[#171616] px-3 py-2 font-semibold">
                {bgUploading ? 'Uploading…' : (item.background_video_url ? 'Replace' : 'Upload')}
              </button>
              {item.background_video_url && (
                <button type="button" onClick={() => removeAsset('background')} className="rounded-md bg-white/10 border border-white/20 px-3 py-2">Remove</button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-2">
          <button onClick={saveMeta} disabled={saving} className="rounded-md bg-white/80 text-[#171616] px-4 py-2 font-semibold">{saving ? 'Saving…' : 'Save'}</button>
          <a href={`/featured/${slug}`} className="rounded-md bg-white/10 border border-white/20 px-4 py-2">View public page</a>
          <button
            onClick={async () => {
              if (!confirm('Delete this featured project? This will remove the uploaded cover/background files from storage.')) return;
              try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                const res = await fetch(`/api/featured/${slug}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                if (!res.ok) throw new Error('Delete failed');
                alert('Deleted');
                window.location.href = '/featured/manage';
              } catch (e) {
                console.error(e);
                alert('Failed to delete');
              }
            }}
            className="ml-auto rounded-md bg-red-600 text-white px-4 py-2 font-semibold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
