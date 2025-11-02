"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Item = { slug: string; title: string; created_at?: string };

export default function FeaturedManageIndex() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace(`/login?next=${encodeURIComponent('/featured/manage')}`); return; }
    (async () => {
      try {
        const res = await fetch('/api/featured', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().then((x:any)=>x);
        setItems(data.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#0b0a0a] text-[#ede8df] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Featured Projects</h1>
          <Link href="/featured/manage/new" className="rounded-md bg-white/80 text-[#171616] px-3 py-2 font-semibold">+ New Project</Link>
        </div>
        {loading ? (
          <div className="mt-6">Loading…</div>
        ) : (
          <div className="mt-6 space-y-2">
            {items.map(it => (
              <div key={it.slug} className="flex items-center justify-between rounded-md bg-white/5 border border-white/15 px-4 py-3">
                <div>
                  <div className="font-semibold">{it.title}</div>
                  <div className="text-sm text-white/70">/{it.slug}</div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/featured/${it.slug}`} className="rounded-md bg-white/10 border border-white/20 px-3 py-2">View</Link>
                  <Link href={`/featured/manage/${it.slug}`} className="rounded-md bg-white/10 border border-white/20 px-3 py-2">Manage</Link>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-white/70">No featured projects yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
