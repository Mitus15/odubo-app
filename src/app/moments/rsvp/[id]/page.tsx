"use client";
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export default function MomentsRsvpPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params?.id ? String(params.id) : '';
  const prefillEmail = search?.get('email') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gallery, setGallery] = useState<any | null>(null);
  const [email, setEmail] = useState(prefillEmail);
  const [name, setName] = useState('');
  const [ig, setIg] = useState('');
  const [igOptIn, setIgOptIn] = useState(true);
  const [phone, setPhone] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [offsets, setOffsets] = useState<number[]>([60, 15]);
  const [done, setDone] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [unsubDone, setUnsubDone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/moments/rsvp?galleryId=${encodeURIComponent(id)}${prefillEmail?`&email=${encodeURIComponent(prefillEmail)}`:''}`);
        const data: any = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(data?.error || 'Failed to load');
        setGallery(data.gallery);
        if (data.rsvp) {
          if (data.rsvp.email) setEmail(data.rsvp.email);
          if (data.rsvp.instagram_handle) setIg(String(data.rsvp.instagram_handle));
          if (typeof data.rsvp.instagram_opt_in === 'boolean') setIgOptIn(!!data.rsvp.instagram_opt_in);
          if (data.rsvp.phone) setPhone(String(data.rsvp.phone));
          if (typeof data.rsvp.sms_opt_in === 'boolean') setSmsOptIn(!!data.rsvp.sms_opt_in);
          try { const saved = Array.isArray(data.rsvp.reminder_offsets) ? data.rsvp.reminder_offsets : JSON.parse(data.rsvp.reminder_offsets || '[]'); setOffsets(saved); } catch {}
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, prefillEmail]);

  const startsAt = useMemo(() => gallery?.starts_at ? new Date(gallery.starts_at) : null, [gallery?.starts_at]);
  const endsAt = useMemo(() => gallery?.ends_at ? new Date(gallery.ends_at) : null, [gallery?.ends_at]);
  const beforeStart = startsAt ? Date.now() < +startsAt : false;
  const isOver = useMemo(() => endsAt && Date.now() > +endsAt, [endsAt]);

  function toggle(m: number) {
    setOffsets(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a,b) => a-b));
  }

  async function submit() {
  if (!id || (!email && !ig && !phone)) { setError('Enter email, Instagram, or phone'); return; }
    setSaving(true); setError(''); setDone(false);
    try {
  const res = await fetch('/api/moments/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ galleryId: Number(id), email: email || undefined, instagram_handle: ig || undefined, instagram_opt_in: igOptIn, phone: phone || undefined, sms_opt_in: smsOptIn, name, reminder_offsets: offsets }) });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save RSVP');
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function unsubscribe() {
    if (!id || (!email && !ig && !phone)) { setError('Enter email, Instagram, or phone'); return; }
    setUnsubscribing(true); setError(''); setUnsubDone(false);
    try {
      const body: any = { galleryId: Number(id) };
      if (email) body.email = email;
      else if (ig) body.instagram_handle = ig;
      else if (phone) body.phone = phone;
      const res = await fetch('/api/moments/rsvp/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to unsubscribe');
      setOffsets([]);
      setUnsubDone(true);
      setDone(false);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setUnsubscribing(false);
    }
  }

  if (loading) return <div className="min-h-[80vh] grid place-items-center text-[#ede8df]">Loading…</div>;
  if (!gallery) return <div className="min-h-[80vh] grid place-items-center text-[#ede8df]">Not found</div>;

  if (isOver) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#171616] via-[#1b1a19] to-[#171616] text-[#ede8df] flex items-center justify-center">
        <div className="max-w-md w-full px-6 text-center">
          <h1 className="text-2xl font-extrabold mb-4">{gallery.title}</h1>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-lg font-medium mb-2">This event has ended</p>
            <p className="text-sm text-[#cfc2ae] mb-6">RSVPs are closed, but you can view the photos!</p>
            <a 
              href={`/moments/gallery/${id}`}
              className="block w-full py-3 rounded-full bg-[#ede8df] text-[#171616] font-bold hover:bg-white transition-colors"
            >
              View Gallery
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#171616] via-[#1b1a19] to-[#171616] text-[#ede8df]">
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-extrabold">RSVP: {gallery.title || 'Event'}</h1>
        <div className="mt-1 text-sm text-[#cfc2ae]">{startsAt ? startsAt.toLocaleString() : 'Schedule TBA'}{endsAt ? ` — ${endsAt.toLocaleString()}` : ''}</div>
        <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">Your email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
            </label>
            <label className="text-sm">Name (optional)
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
            </label>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">Instagram (optional)
              <input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@yourhandle" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
            </label>
            <label className="text-xs flex items-center gap-2 mt-1">
              <input type="checkbox" checked={igOptIn} onChange={(e) => setIgOptIn(e.target.checked)} />
              <span>Consent to be tagged on Instagram</span>
            </label>
            <label className="text-sm">Phone (optional, E.164)
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15551234567" className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2" />
            </label>
            <label className="text-xs flex items-center gap-2 mt-1">
              <input type="checkbox" checked={smsOptIn} onChange={(e) => setSmsOptIn(e.target.checked)} />
              <span>Opt in to SMS reminders</span>
            </label>
          </div>
          <div className="mt-4 text-sm">Reminders</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1440, 360, 60, 15].map(m => (
              <button key={m} type="button" onClick={() => toggle(m)} className={`px-3 py-1.5 rounded-full text-xs border ${offsets.includes(m) ? 'bg-[#ff8a3d] border-[#ff8a3d] text-[#171616]' : 'bg-[#1f1a17]/70 border-white/10 text-[#efe9df]'}`}>
                {m === 1440 ? '24h before' : m === 360 ? '6h before' : m === 60 ? '1h before' : `${m}m before`}
              </button>
            ))}
          </div>

          {error && <div className="mt-4 p-3 rounded-lg border border-red-700/70 bg-red-900/30 text-red-200">{error}</div>}

          <div className="mt-5 flex items-center gap-3">
            <button onClick={submit} disabled={(!email && !ig && !phone) || saving} className="px-5 py-2.5 rounded-full bg-[#ede8df] text-[#171616] font-extrabold tracking-wide disabled:opacity-50">{saving ? 'Saving…' : done ? 'Saved' : 'Save RSVP'}</button>
            {beforeStart && <a href={`/moments?galleryId=${encodeURIComponent(String(id))}`} className="text-sm underline">Back to Moments</a>}
          </div>
          {done && <div className="mt-3 text-sm text-[#cfc2ae]">All set! Well remind you before it starts.</div>}

          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="text-sm font-semibold mb-2">Manage or Unsubscribe</div>
            <p className="text-xs text-[#cfc2ae] mb-3">To stop reminders for this event, click unsubscribe. You can re-enable later by saving new reminder times.</p>
            <button onClick={unsubscribe} disabled={unsubscribing || (!email && !ig && !phone)} className="px-4 py-2 rounded-full border border-red-500/60 bg-red-900/30 text-red-100 text-sm disabled:opacity-50">
              {unsubscribing ? 'Unsubscribing…' : 'Unsubscribe from reminders'}
            </button>
            {unsubDone && <div className="mt-2 text-xs text-[#cfc2ae]">Youre unsubscribed. Well stop sending reminders.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
