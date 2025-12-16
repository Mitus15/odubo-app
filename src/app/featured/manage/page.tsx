"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type FeaturedItem = {
  title: string;
  subtitle?: string;
  date_text?: string;
  venue?: string;
  moments_link?: string;
  cover_image_url?: string;
  background_video_url?: string;
  extra_links_json?: string;
  mode?: string; // 'event' | 'product' | 'music' | 'video' | 'app_update'
  product_handle?: string;
  product_price?: string;
  product_cta_text?: string;
  is_published?: number;
};

export default function FeaturedManageSingleton() {
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<string>('event');
  const [item, setItem] = useState<FeaturedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extraLinks, setExtraLinks] = useState<{ label: string; href: string }[]>([{ label: '', href: '' }]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  // Moments linkage
  const [galleries, setGalleries] = useState<any[]>([]);
  const [loadingGalleries, setLoadingGalleries] = useState(false);
  const [creatingGallery, setCreatingGallery] = useState(false);
  const [newGalleryTitle, setNewGalleryTitle] = useState('Moments');
  // Shopify products
  const [shopifyProducts, setShopifyProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Load data when mode changes
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace(`/login?next=${encodeURIComponent('/featured/manage')}`); return; }
    
    async function loadModeData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/featured-single?mode=${encodeURIComponent(currentMode)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        const data: any = await res.json();
        const it: FeaturedItem = data.item as FeaturedItem;
        setItem(it);
        if (it?.extra_links_json) {
          try { setExtraLinks(JSON.parse(it.extra_links_json)); } catch {}
        } else {
          setExtraLinks([{ label: '', href: '' }]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    
    loadModeData();
  }, [currentMode, router]);

  // Load galleries, products, and active mode once on mount
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    
    // Load moments galleries (admin only)
    setLoadingGalleries(true);
    fetch('/api/moments/galleries?limit=100', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(res => res.json())
      .then((data: any) => { if (data.galleries) setGalleries(data.galleries); })
      .catch(console.error)
      .finally(() => setLoadingGalleries(false));
    
    // Load Shopify products
    setLoadingProducts(true);
    fetch('/api/shopify/products')
      .then(res => res.json())
      .then((data: any) => { if (data.products) setShopifyProducts(data.products); })
      .catch(console.error)
      .finally(() => setLoadingProducts(false));
    
    // Load the currently active/published mode
    fetch('/api/featured-active-mode')
      .then(res => res.json())
      .then((data: any) => { if (data.mode) setActiveMode(data.mode); })
      .catch(console.error);
  }, []);

  async function saveMeta() {
    if (!item) return;
    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const body: any = {
        title: item.title,
        subtitle: item.subtitle,
        date_text: item.date_text,
        venue: item.venue,
        moments_link: item.moments_link,
        extra_links_json: JSON.stringify((extraLinks || []).filter(l => l.label && l.href)),
        mode: currentMode,
        product_handle: item.product_handle,
        product_price: item.product_price,
        product_cta_text: item.product_cta_text,
      };
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/featured-single', { method: 'PUT', headers, body: JSON.stringify(body) });
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
    fd.append('kind', kind);
    fd.append('mode', currentMode);
    try {
      kind === 'cover' ? setCoverUploading(true) : setBgUploading(true);
      const res = await fetch('/api/featured-single/upload', { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) throw new Error('Upload failed');
      const { url }: any = await res.json();
      setItem(prev => prev ? { ...prev, [kind === 'cover' ? 'cover_image_url' : 'background_video_url']: url } : prev);
    } finally {
      kind === 'cover' ? setCoverUploading(false) : setBgUploading(false);
    }
  }

  async function removeAsset(kind: 'cover' | 'background') {
    if (!confirm(`Remove ${kind === 'cover' ? 'cover image' : 'background video'}?`)) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const qs = new URLSearchParams({ kind, mode: currentMode }).toString();
    const res = await fetch(`/api/featured-single/asset?${qs}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) { alert('Failed to remove'); return; }
    setItem(prev => prev ? { ...prev, [kind === 'cover' ? 'cover_image_url' : 'background_video_url']: undefined } as any : prev);
  }

  const selectedGalleryId = useMemo(() => {
    // infer from moments_link if it looks like /moments/capture?galleryId=123
    const ml = item?.moments_link || '';
    const m = ml.match(/[?&]galleryId=(\d+)/);
    return m ? m[1] : '';
  }, [item?.moments_link]);

  // Event window is managed in Admin → Moments; no schedule editing here

  function setSelectedGallery(id: string) {
    if (!item) return;
    // Link Featured → Moments index with prefilled galleryId (and optional schedule)
    let link = '';
    if (id) {
      const g = galleries.find((gg: any) => String(gg.id) === String(id));
      const params = new URLSearchParams({ galleryId: String(id) });
      if (g?.starts_at) params.set('starts_at', g.starts_at);
      if (g?.ends_at) params.set('ends_at', g.ends_at);
      link = `/moments?${params.toString()}`;
    }
    setItem({ ...(item as any), moments_link: link });
  }

  // No-op: schedule editing moved to Admin → Moments

  async function createGalleryInline() {
    const title = (newGalleryTitle || '').trim();
    if (!title) return;
    try {
      setCreatingGallery(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/moments/create', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ title }) });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error || 'Failed to create'); return; }
      const code = data.code;
      // Resolve to full gallery (to get id)
      const joinRes = await fetch(`/api/moments/join?code=${encodeURIComponent(code)}`);
      const jData: any = await joinRes.json().catch(() => ({}));
      if (!joinRes.ok) { alert(jData?.error || 'Failed to resolve gallery'); return; }
      const g = jData.gallery;
      setGalleries((prev) => [{ id: g.id, code: g.code, title: g.title, starts_at: g.starts_at, ends_at: g.ends_at }, ...prev]);
      setSelectedGallery(String(g.id));
    } catch (e) {
      console.error(e);
      alert('Failed to create gallery');
    } finally {
      setCreatingGallery(false);
    }
  }

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#171616] text-[#ede8df]">Loading…</div>;
  if (!item) return <div className="min-h-screen grid place-items-center bg-[#171616] text-[#ede8df]">Not found</div>;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#0b0a0a] text-[#ede8df] px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6">
        <h1 className="text-2xl font-bold">Featured Page</h1>
        
        {/* Currently Live Mode Banner */}
        {activeMode && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/20 border border-green-500/40 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-sm">
              <strong className="text-green-300">Currently Live:</strong>{' '}
              <span className="font-semibold">{activeMode === 'app_update' ? 'App Update' : activeMode.charAt(0).toUpperCase() + activeMode.slice(1)}</span> mode is showing on{' '}
              <a href="/featured" target="_blank" className="underline hover:text-green-200">/featured</a>
            </span>
          </div>
        )}
        
        {/* Help Text */}
        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm text-blue-200">
          <strong>How it works:</strong> Select a mode to edit its content. Click "Publish to Featured" to make it live on the featured page. 
          Only ONE mode can be live at a time - publishing a mode will automatically unpublish the others.
        </div>

        {/* Mode Selector */}
        <div className="mt-6 p-4 rounded-lg border border-white/20 bg-white/5">
          <label className="block text-sm font-semibold mb-2">Content Mode</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {['event', 'product', 'music', 'video', 'app_update'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCurrentMode(mode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  currentMode === mode
                    ? 'bg-white/90 text-[#171616] shadow-lg'
                    : 'bg-white/10 border border-white/20 text-[#ede8df] hover:bg-white/15'
                }`}
              >
                {mode === 'app_update' ? 'App Update' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-white/60">
              Viewing: <span className="font-semibold">{currentMode.replace('_', ' ')}</span>
              {loading && <span className="ml-2">Loading...</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs">
                {activeMode === currentMode ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/20 text-green-300 border border-green-500/30">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <strong>LIVE</strong> on /featured
                  </span>
                ) : item.is_published ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    Published (not active)
                  </span>
                ) : (
                  <span className="text-white/40">Not Published</span>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!item) return;
                  const newState = item.is_published ? 0 : 1;
                  const confirmed = confirm(newState ? `Set ${currentMode} as the active Featured page?` : `Unpublish ${currentMode} from Featured page?`);
                  if (!confirmed) return;
                  
                  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                  try {
                    const res = await fetch('/api/featured-single', {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                      },
                      body: JSON.stringify({ mode: currentMode, is_published: newState })
                    });
                    if (!res.ok) throw new Error('Failed to update');
                    setItem({ ...item, is_published: newState });
                    // Update active mode state
                    if (newState) {
                      setActiveMode(currentMode);
                    } else if (activeMode === currentMode) {
                      setActiveMode(null);
                    }
                    alert(newState ? `${currentMode} is now live on the Featured page!` : `${currentMode} unpublished`);
                  } catch (e) {
                    alert('Failed to update publish status');
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  item.is_published
                    ? 'bg-white/10 border border-white/20 text-white/70 hover:bg-white/15'
                    : 'bg-green-500/90 text-white hover:bg-green-500 shadow-lg'
                }`}
              >
                {item.is_published ? 'Unpublish' : 'Publish to Featured'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            {currentMode === 'product' ? 'Product Name' : 'Title'}
            <input value={item.title} onChange={(e) => setItem({ ...(item as any), title: e.target.value })} className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
          </label>
          <label className="block text-sm">
            {currentMode === 'product' ? 'Release Date' : 'Date Text'}
            <input 
              type={currentMode === 'product' ? 'datetime-local' : 'text'}
              value={item.date_text || ''} 
              onChange={(e) => setItem({ ...(item as any), date_text: e.target.value })} 
              placeholder={currentMode === 'product' ? 'Release date/time' : 'e.g., November 15, 2025'}
              className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" 
            />
          </label>
          
          {/* Event-only fields */}
          {currentMode === 'event' && (
            <>
              <label className="block text-sm">Note
                <input value={item.subtitle || ''} onChange={(e) => setItem({ ...(item as any), subtitle: e.target.value })} className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
              </label>
              <label className="block text-sm">Venue
                <input value={item.venue || ''} onChange={(e) => setItem({ ...(item as any), venue: e.target.value })} className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
              </label>
            </>
          )}

          {/* Product Mode Fields */}
          {currentMode === 'product' && (
            <>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2">Select Product from Shopify</label>
                {loadingProducts ? (
                  <div className="text-xs text-white/60">Loading products...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {shopifyProducts.map((product) => (
                      <button
                        key={product.handle}
                        type="button"
                        onClick={() => {
                          setItem({
                            ...(item as any),
                            product_handle: product.handle,
                            product_price: `$${parseFloat(product.price).toFixed(2)}`,
                            title: product.title,
                          });
                        }}
                        className={`relative p-3 rounded-lg border transition-all text-left ${
                          item.product_handle === product.handle
                            ? 'border-white/60 bg-white/15 shadow-lg'
                            : 'border-white/20 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex gap-3 items-start">
                          {product.image && (
                            <img
                              src={product.image}
                              alt={product.title}
                              className="w-16 h-16 object-cover rounded-md border border-white/20"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{product.title}</div>
                            <div className="text-xs text-white/70 mt-0.5">
                              ${parseFloat(product.price).toFixed(2)} {product.currencyCode}
                            </div>
                            <div className="text-xs text-white/50 mt-0.5 truncate">
                              {product.handle}
                            </div>
                          </div>
                        </div>
                        {item.product_handle === product.handle && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-white/90 text-[#171616] rounded-full flex items-center justify-center text-xs font-bold">
                            ✓
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-xs text-white/60 mt-2">
                  CTA will automatically be "Pre-order" before release date, "Shop Now" after.
                </div>
              </div>
            </>
          )}

          {/* Event Mode Fields */}
          {currentMode === 'event' && (
          <div className="md:col-span-2">
            <div className="block text-sm font-semibold mb-1">Moments Gallery</div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <select
                  className="flex-1 rounded-md bg-white/10 border border-white/20 px-3 py-2"
                  value={selectedGalleryId}
                  onChange={(e) => setSelectedGallery(e.target.value)}
                >
                  <option value="">— None —</option>
                  {galleries.map((g: any) => (
                    <option key={g.id} value={String(g.id)}>{g.title} {g.code ? `(${g.code})` : ''}</option>
                  ))}
                </select>
                <a
                  href={item.moments_link || '#'}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!item.moments_link}
                  className={`px-3 py-2 rounded-md bg-white/10 border border-white/20 ${item.moments_link ? '' : 'pointer-events-none opacity-50'}`}
                >
                  Open
                </a>
              </div>
              <div className="text-xs text-white/70">When a gallery is selected, the Moments button on the Featured page links to the event. Before the start time it shows “RSVP” and routes to the RSVP page; once live it opens the Moments gallery.</div>
              {selectedGalleryId && (
                <div className="mt-3 rounded-md border border-white/20 bg-white/5 p-3">
                  <div className="text-xs font-semibold mb-1">Event Window</div>
                  <div className="text-xs text-white/70">
                    Event window (start/end) is managed in Admin → Moments. Open the Moments panel to set the window for this gallery.
                  </div>
                </div>
              )}
              <div className="mt-1 flex gap-2 items-center">
                <input value={newGalleryTitle} onChange={(e) => setNewGalleryTitle(e.target.value)} placeholder="New gallery title"
                  className="flex-1 rounded-md bg-white/10 border border-white/20 px-3 py-2" />
                <button type="button" onClick={createGalleryInline} disabled={creatingGallery}
                  className="px-3 py-2 rounded-md bg-white/80 text-[#171616] font-semibold">
                  {creatingGallery ? 'Creating…' : 'Create'}
                </button>
                {loadingGalleries && <span className="text-xs text-white/60">Loading…</span>}
              </div>
              <div className="mt-1">
                <label className="text-xs block">Link preview</label>
                <input value={item.moments_link || ''} readOnly className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white/80" />
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Extra Links/Buttons - Event mode only */}
        {currentMode === 'event' && (
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
        )}

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
          <a href={`/featured`} className="rounded-md bg-white/10 border border-white/20 px-4 py-2">View public page</a>
        </div>
      </div>
    </div>
  );
}
